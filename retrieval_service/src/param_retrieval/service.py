import itertools
import json
import logging
import tempfile
import threading
import time
import uuid
from contextlib import contextmanager
from pathlib import Path

from .blobs import Blobs
from .config import Settings
from .embeddings import FastEmbedder
from .fusion import reciprocal_rank_fusion
from .parsers import IMAGE_SUFFIXES, PARSERS, parse
from .state import LostLease, State
from .vectors import VECTOR_ADAPTERS

log = logging.getLogger(__name__)


class Service:
    def __init__(self, settings: Settings, store=None, embedder=None, postprocessor=None):
        settings.prepare()
        self.settings = settings
        self.state = State(settings.state_url)
        self.blobs = Blobs(settings.blob_root)
        self.store = store or VECTOR_ADAPTERS[settings.vector_backend](settings)
        self.embedder = embedder or FastEmbedder(settings)
        self.postprocessor = postprocessor
        self._run_lock = threading.Lock()

    def initialize(self):
        self.store.ensure()
        return self

    def submit(self, path, source=None, sequence=None, force=False):
        path = Path(path)
        suffix = path.suffix.lower()
        if suffix not in PARSERS and suffix not in IMAGE_SUFFIXES:
            raise ValueError(f"Unsupported format: {suffix}")
        kind = "image" if suffix in IMAGE_SUFFIXES else "text"
        digest = self.blobs.put(path, self.settings.max_file_mb * 1024 * 1024)
        return self.state.enqueue(self.settings.dataset, self.settings.index_id,
            source or path.name, digest, suffix, kind, sequence, force)

    def submit_record(self, source, record, sequence):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "record.json"
            path.write_text(json.dumps(record, ensure_ascii=False, allow_nan=False), encoding="utf-8")
            return self.submit(path, source=source, sequence=sequence)

    def remove(self, source, sequence=None):
        # A durable tombstone. Old content is hidden on publication, then physically collected.
        return self.state.enqueue(self.settings.dataset, self.settings.index_id,
            source, None, "", "text", sequence)

    def scan(self, root):
        root = Path(root).resolve(strict=True)
        submitted = []
        for path in sorted(root.rglob("*")):
            if path.is_file() and not path.is_symlink() and path.suffix.lower() in PARSERS.keys() | IMAGE_SUFFIXES:
                submitted.append(self.submit(path, source=path.relative_to(root).as_posix()))
        # Missing files are not treated as deletions: interrupted Drive mounts must be harmless.
        return submitted

    def rebuild(self, from_index_id=None):
        """Queue immutable snapshots again after a store migration or index repair."""
        count = 0
        for item in self.state.sources(self.settings.dataset, from_index_id or self.settings.index_id):
            self.state.enqueue(self.settings.dataset, self.settings.index_id, item["source"],
                item["blob"], item["suffix"], item["kind"], item["sequence"], force=True)
            count += 1
        return count

    @contextmanager
    def lease(self, job):
        stop, lost = threading.Event(), threading.Event()
        def keep_alive():
            while not stop.wait(self.settings.lease_seconds / 3):
                try:
                    self.state.renew(job, self.settings.lease_seconds)
                except Exception:
                    lost.set()
                    return
        thread = threading.Thread(target=keep_alive, daemon=True)
        thread.start()
        try:
            yield lost
        finally:
            stop.set()
            thread.join(timeout=5)

    def run_one(self):
        # One worker loop per Service. Scale separate worker processes using PostgreSQL.
        with self._run_lock:
            job = self.state.claim(self.settings.index_id, self.settings.lease_seconds, self.settings.max_attempts)
            if job is None:
                return False
            try:
                with self.lease(job) as lost:
                    count = 0
                    if job["blob"] is not None:
                        with self.blobs.materialize(job["blob"], job["suffix"]) as path:
                            chunks = iter(parse(path, job["suffix"], self.settings))
                            size = self.settings.image_batch_size if job["kind"] == "image" else self.settings.batch_size
                            while batch := list(itertools.islice(chunks, size)):
                                if job["kind"] == "text":
                                    for chunk in batch:
                                        chunk.text = f"Source: {job['source'][:180]}; {chunk.locator[:100]}\n{chunk.text}"
                                if lost.is_set():
                                    raise LostLease("Lease renewal failed")
                                vectors = self.embedder.documents(job["kind"], batch)
                                if len(vectors) != len(batch):
                                    raise ValueError("Embedding count does not match the batch")
                                points = []
                                for chunk, vector in zip(batch, vectors):
                                    payload = {"dataset": job["dataset"], "index_id": job["index_id"],
                                        "doc_id": job["doc_id"], "revision": job["token"], "active": False,
                                        "source": job["source"], "locator": chunk.locator,
                                        "text": chunk.text, "attributes": chunk.attributes,
                                        "blob_id": job["blob"], "kind": job["kind"]}
                                    points.append({"id": str(uuid.uuid5(uuid.UUID(job["token"]), chunk.locator)),
                                                   "vector": vector, "payload": payload})
                                self.state.renew(job, self.settings.lease_seconds)
                                self.store.upsert(job["kind"], points)
                                count += len(points)
                                log.info("job=%s indexed=%d", job["id"], count)
                        if count == 0:
                            raise ValueError("No indexable content; use an explicit delete for removal")
                        self.state.renew(job, self.settings.lease_seconds)
                        self.store.activate(job["kind"], job["token"])
                    self.state.publish(job, count)
            except Exception as exc:
                self.state.fail(job, exc, self.settings.max_attempts)
                log.warning("job=%s attempt=%d failed: %s", job["id"], job["attempts"], type(exc).__name__)
            return True

    def drain(self, max_seconds=3600):
        deadline = time.monotonic() + max_seconds
        while time.monotonic() < deadline:
            worked = self.run_one()
            self.state.collect(self.store, self.settings.index_id)
            status = self.state.status(self.settings.index_id)
            if not status.get("queued") and not status.get("running"):
                return status
            if not worked:
                time.sleep(1)
        return self.state.status(self.settings.index_id)

    def retrieve(self, query, top_k=5, scope="text", process=False):
        if not query.strip() or len(query) > 4000 or not 1 <= top_k <= 50 or scope not in {"text", "image", "all"}:
            raise ValueError("Invalid query, top_k or scope")
        results, limited = {}, False
        for kind in (["text", "image"] if scope == "all" else [scope]):
            vector = self.embedder.query(kind, query)
            limit = max(64, top_k * 4)
            while True:
                branches = {"dense": self.store.search(kind, vector, self.settings.dataset, self.settings.index_id, limit)}
                if kind == "text":
                    branches["lexical"] = self.store.lexical_search(
                        query, self.settings.dataset, self.settings.index_id, limit)
                # Validate BOTH arms against one publication-state snapshot before fusion.
                active = self.state.active({p["doc_id"] for hits in branches.values() for p in hits})
                current = {name: [p for p in hits if active.get(p["doc_id"]) == p["revision"]]
                           for name, hits in branches.items()}
                needs_more = any(len(branches[name]) == limit and len(hits) < top_k
                                 for name, hits in current.items())
                if not needs_more or limit >= 1024:
                    limited |= needs_more and limit >= 1024
                    break
                limit = min(1024, limit * 2)
            valid = reciprocal_rank_fusion(current, self.settings.rrf_k) if kind == "text" else [
                {**p, "score_type": "cosine", "ranks": {"dense": rank},
                 "branch_scores": {"dense": p["score"]}}
                for rank, p in enumerate(current["dense"], 1)]
            results[kind + "_results"] = [{k: p[k] for k in
                ("id", "score", "source", "locator", "text", "attributes", "blob_id", "revision",
                 "score_type", "ranks", "branch_scores")}
                for p in valid[:top_k]]
        response = {"request_id": str(uuid.uuid4()), "query": query,
            "dataset": self.settings.dataset, "index_id": self.settings.index_id,
            "candidate_limit_reached": limited, **results}
        if process:
            if self.postprocessor is None:
                raise ValueError("No postprocessor configured")
            response["processed"] = self.postprocessor(query, response)
        return response

    def close(self):
        self.store.close()
        self.state.close()
