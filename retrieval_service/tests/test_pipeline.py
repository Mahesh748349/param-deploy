import json
import os
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import update

from param_retrieval import Service, Settings
from param_retrieval.api import create_app
from param_retrieval.embeddings import TestEmbedder as FakeEmbedder
from param_retrieval.parsers import parse
from param_retrieval.state import LostLease, StaleEvent, jobs
from param_retrieval.vectors import QdrantStore, PgVectorStore


class FakeSparseEncoder:
    """Hash-token sparse vectors for offline lifecycle tests, NOT production BM25."""
    def passage_embed(self, texts, **kwargs):
        import hashlib
        import re
        from collections import Counter
        import numpy as np
        from fastembed.sparse.sparse_embedding_base import SparseEmbedding
        for text in texts:
            counts = Counter(int(hashlib.sha256(word.encode()).hexdigest()[:8], 16)
                             for word in re.findall(r'\w+', text.lower()))
            yield SparseEmbedding(indices=np.array(list(counts), dtype=np.int64),
                                  values=np.array(list(counts.values()), dtype=float))

    def query_embed(self, texts, **kwargs):
        return self.passage_embed(texts)


@pytest.fixture
def service(tmp_path):
    cfg = Settings(state_url=f"sqlite:///{tmp_path / 'state.db'}", blob_root=str(tmp_path / "blobs"),
        local_vector_path=str(tmp_path / "vectors"), model_cache=str(tmp_path / "cache"),
        text_dimension=8, image_dimension=8, batch_size=2, lease_seconds=15,
        read_key="read-test", ingest_key="write-test", rerank_enabled=False)
    svc = Service(cfg, store=QdrantStore(cfg, sparse_encoder=FakeSparseEncoder()), embedder=FakeEmbedder()).initialize()
    yield svc
    svc.close()


def source(tmp_path, name="data.csv", text="exhibit,duration\nflower,12\nbug,5\n"):
    path = tmp_path / name
    path.write_text(text, encoding="utf-8")
    return path


def test_unchanged_rerun_and_replacement(service, tmp_path):
    path = source(tmp_path)
    first = service.submit(path)
    assert service.run_one()
    assert service.state.job(first["id"])["count"] == 2
    assert service.submit(path)["id"] == first["id"]
    assert not service.run_one()
    path.write_text("exhibit,duration\nrocket,42\n")
    second = service.submit(path)
    assert second["id"] != first["id"]
    assert len(service.retrieve("flower")["text_results"]) == 2
    service.run_one()
    response = service.retrieve("rocket", top_k=10)
    assert len(response["text_results"]) == 1
    assert "rocket" in response["text_results"][0]["text"]
    service.state.collect(service.store, service.settings.index_id)
    assert service.store.client.count(service.store.name("text")).count == 1


def test_failed_update_preserves_old_version_and_retry(service, tmp_path):
    path = source(tmp_path)
    service.submit(path)
    service.run_one()
    path.write_text("exhibit,duration\nnew,1\nbroken,2,3\n")
    job = service.submit(path)
    service.run_one()
    assert service.state.job(job["id"])["status"] == "queued"
    assert len(service.retrieve("flower")["text_results"]) == 2
    with service.state.transaction() as conn:
        conn.execute(update(jobs).where(jobs.c.id == job["id"]).values(available=0))
    service.run_one()
    service.state.collect(service.store, service.settings.index_id)
    assert service.store.client.count(service.store.name("text")).count == 2


def test_immutable_snapshot(service, tmp_path):
    path = source(tmp_path)
    service.submit(path)
    path.write_text("exhibit,duration\nchanged_after_submission,99\n")
    service.run_one()
    assert "changed_after_submission" not in json.dumps(service.retrieve("flower"))


def test_ordering_and_duplicate_event(service):
    first = service.submit_record("sensor/12", {"temperature": 3}, 2)
    assert service.submit_record("sensor/12", {"temperature": 3}, 2)["id"] == first["id"]
    with pytest.raises(StaleEvent):
        service.submit_record("sensor/12", {"temperature": 1}, 1)
    with pytest.raises(StaleEvent):
        service.submit_record("sensor/12", {"temperature": 4}, 2)
    service.run_one()
    service.submit_record("sensor/12", {"temperature": 5}, 3)
    service.run_one()
    assert service.retrieve("temperature")["text_results"][0]["attributes"] == {"temperature": 5}


def test_newer_event_during_embedding_wins(service, tmp_path):
    path = source(tmp_path)
    first = service.submit(path, sequence=1)
    original = service.embedder.documents
    def submit_new(kind, batch):
        service.submit_record(path.name, {"exhibit": "newest"}, 2)
        service.embedder.documents = original
        return original(kind, batch)
    service.embedder.documents = submit_new
    service.run_one()
    assert service.state.job(first["id"])["status"] == "superseded"
    service.run_one()
    assert service.retrieve("newest")["text_results"][0]["attributes"] == {"exhibit": "newest"}


def test_delete_tombstone_and_no_resurrection(service):
    service.submit_record("record/1", {"value": "hello"}, 1)
    service.run_one()
    service.remove("record/1", sequence=2)
    service.run_one()
    assert service.retrieve("hello")["text_results"] == []
    with pytest.raises(StaleEvent):
        service.submit_record("record/1", {"value": "old"}, 1)


def test_expired_lease_cannot_publish(service):
    service.submit_record("record/1", {"value": 5}, 1)
    stale = service.state.claim(service.settings.index_id, 15, 5)
    with service.state.transaction() as conn:
        conn.execute(update(jobs).where(jobs.c.id == stale["id"]).values(lease=0))
    current = service.state.claim(service.settings.index_id, 15, 5)
    assert current["token"] != stale["token"]
    with pytest.raises(LostLease):
        service.state.publish(stale, 1)


def test_durable_pending_job_survives_restart(service):
    job = service.submit_record("pending", {"value": "persisted"}, 1)
    settings = service.settings
    service.close()
    other = Service(settings, store=QdrantStore(settings, sparse_encoder=FakeSparseEncoder()), embedder=FakeEmbedder()).initialize()
    try:
        other.run_one()
        assert other.state.job(job["id"])["status"] == "complete"
    finally:
        other.close()


def test_concurrent_claims_do_not_duplicate(service):
    for number in range(4):
        service.submit_record(f"item/{number}", {"value": number}, 1)
    with ThreadPoolExecutor(max_workers=4) as workers:
        results = list(workers.map(lambda _: service.state.claim(service.settings.index_id, 15, 5), range(4)))
    assert len({r["id"] for r in results}) == 4


def test_acknowledgement_loss_after_commit_does_not_remove_active(service):
    job = service.submit_record("item", {"value": "retained"}, 1)
    original = service.state.publish
    def commit_then_fail(claim, count):
        original(claim, count)
        raise OSError("simulated acknowledgement loss")
    service.state.publish = commit_then_fail
    service.run_one()
    service.state.collect(service.store, service.settings.index_id)
    assert service.state.job(job["id"])["status"] == "complete"
    assert len(service.retrieve("retained")["text_results"]) == 1


def test_rules_preserve_zero_and_nested_identifiers_are_removed(service, tmp_path):
    path = source(tmp_path, "mixed.jsonl", json.dumps({"nested": {"userName": "private"}, "zero": 0, "flag": False}) + "\n")
    chunks = list(parse(path, ".jsonl", service.settings))
    assert "private" not in chunks[0].text
    assert chunks[0].attributes["zero"] == 0
    assert chunks[0].attributes["flag"] is False


def test_long_documents_not_clipped(service, tmp_path):
    text = "begin " + "long " * 1500 + "unique ending"
    path = source(tmp_path, "long.txt", text)
    chunks = list(parse(path, ".txt", service.settings))
    assert len(chunks) > 1
    assert "unique ending" in chunks[-1].text


def test_json_array_streaming_and_spreadsheet_headers(service, tmp_path):
    path = source(tmp_path, "array.json", '[{"a":1},{"a":2}]')
    assert len(list(parse(path, ".json", service.settings))) == 2
    from openpyxl import Workbook
    book = Workbook()
    book.active.append(["name", "name", "value"])
    book.active.append(["private1", "private2", 0])
    target = tmp_path / "book.xlsx"
    book.save(target)
    chunk = next(parse(target, ".xlsx", service.settings))
    assert chunk.attributes == {"value": 0}


def test_api_auth_scopes_and_async_ingest(service):
    api = TestClient(create_app(service))
    assert api.post("/v1/retrieve", json={"query": "flower"}).status_code == 401
    assert api.put("/v1/records", headers={"Authorization": "Bearer read-test"},
        json={"source": "sensor", "version": 1, "record": {"value": 3}}).status_code == 401
    reply = api.put("/v1/records", headers={"Authorization": "Bearer write-test"},
        json={"source": "sensor", "version": 1, "record": {"value": 3}})
    assert reply.status_code == 202
    service.run_one()
    assert api.post("/v1/retrieve", headers={"Authorization": "Bearer read-test"},
        json={"query": "value"}).json()["text_results"]


def test_image_path_and_optional_postprocessor(service, tmp_path):
    from PIL import Image
    path = tmp_path / "drawing.png"
    Image.new("RGB", (10, 10), "blue").save(path)
    service.submit(path)
    service.run_one()
    response = service.retrieve("blue", scope="image")
    assert len(response["image_results"]) == 1
    service.postprocessor = lambda query, context: {"count": len(context["image_results"])}
    assert service.retrieve("blue", scope="image", process=True)["processed"]["count"] == 1


@pytest.mark.skipif(not os.getenv("PARAM_TEST_PGVECTOR_URL"), reason="Requires a real PostgreSQL + pgvector >=0.8 database")
def test_pgvector_adapter_contract(tmp_path):
    import uuid
    cfg = Settings(vector_backend="pgvector", vector_url=os.environ.get("PARAM_TEST_PGVECTOR_URL", ""),
                   collection_prefix="test_" + uuid.uuid4().hex[:8], text_dimension=8, image_dimension=8)
    store = PgVectorStore(cfg)
    store.ensure()
    try:
        revision = str(uuid.uuid4())
        store.upsert("text", [{"id": str(uuid.uuid4()), "vector": [1.0] + [0.0] * 7,
            "payload": {"dataset": "test", "index_id": "test", "revision": revision, "active": False,
                        "text": "unique widget"}}])
        assert not store.search("text", [1.0] + [0.0] * 7, "test", "test", 5)
        assert not store.lexical_search("widget", "test", "test", 5)
        store.activate("text", revision)
        assert len(store.search("text", [1.0] + [0.0] * 7, "test", "test", 5)) == 1
        assert len(store.lexical_search("absent widget", "test", "test", 5)) == 1
        assert not store.lexical_search("widget", "another", "test", 5)
        store.delete("text", revision)
        assert not store.search("text", [1.0] + [0.0] * 7, "test", "test", 5)
        assert not store.lexical_search("widget", "test", "test", 5)
    finally:
        from sqlalchemy import text
        with store.engine.begin() as conn:
            for kind in ["text", "image"]:
                conn.execute(text(f"DROP TABLE {store.name(kind)}"))
        store.close()
