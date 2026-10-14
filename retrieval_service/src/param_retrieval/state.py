"""Durable jobs and publication state. PostgreSQL for services; SQLite for one local worker."""
import hashlib
import time
import uuid
from contextlib import contextmanager

from sqlalchemy import (BigInteger, Column, Float, Index, Integer, MetaData, String,
                        Table, Text, and_, create_engine, delete, insert, or_, select, update)
from sqlalchemy.exc import IntegrityError

metadata = MetaData()
documents = Table("pr_documents", metadata,
    Column("id", String(64), primary_key=True),
    Column("dataset", String(200), nullable=False),
    Column("index_id", String(40), nullable=False),
    Column("source", Text, nullable=False),
    Column("sequence", BigInteger),
    Column("desired", String(36)),
    Column("active", String(36)),
    Column("kind", String(10), nullable=False))
jobs = Table("pr_jobs", metadata,
    Column("id", String(36), primary_key=True),
    Column("doc_id", String(64), nullable=False),
    Column("index_id", String(40), nullable=False),
    Column("blob", String(64)),
    Column("suffix", String(15), nullable=False),
    Column("kind", String(10), nullable=False),
    Column("status", String(20), nullable=False),
    Column("attempts", Integer, nullable=False, default=0),
    Column("available", Float, nullable=False),
    Column("lease", Float, nullable=False, default=0),
    Column("token", String(36)),
    Column("count", Integer, default=0),
    Column("error", Text),
    Column("created", Float, nullable=False))
garbage = Table("pr_garbage", metadata,
    Column("revision", String(36), primary_key=True),
    Column("kind", String(10), nullable=False),
    Column("index_id", String(40), nullable=False))
Index("pr_jobs_poll", jobs.c.index_id, jobs.c.status, jobs.c.available)
Index("pr_doc_namespace", documents.c.dataset, documents.c.index_id)


class StaleEvent(ValueError):
    pass


class LostLease(RuntimeError):
    pass


class State:
    def __init__(self, url: str):
        self.engine = create_engine(url, pool_pre_ping=True,
            connect_args={"timeout": 30, "check_same_thread": False} if url.startswith("sqlite") else {})
        metadata.create_all(self.engine)

    @contextmanager
    def transaction(self):
        with self.engine.begin() as conn:
            if self.engine.dialect.name == "sqlite":
                conn.exec_driver_sql("BEGIN IMMEDIATE")
            yield conn

    @staticmethod
    def document_id(dataset, index_id, source):
        return hashlib.sha256(f"{dataset}\0{index_id}\0{source}".encode()).hexdigest()

    def enqueue(self, dataset, index_id, source, blob, suffix, kind, sequence=None, force=False):
        doc_id = self.document_id(dataset, index_id, source)
        for attempt in range(3):
            try:
                with self.transaction() as conn:
                    doc = conn.execute(select(documents).where(documents.c.id == doc_id)
                                       .with_for_update()).mappings().first()
                    prior = None
                    if doc and doc["desired"]:
                        prior = conn.execute(select(jobs).where(jobs.c.id == doc["desired"])).mappings().one()
                    same = prior and prior["blob"] == blob and prior["suffix"] == suffix
                    if doc and doc["sequence"] is not None:
                        if sequence is None or sequence < doc["sequence"]:
                            raise StaleEvent("Update is older than the accepted source version")
                        if sequence == doc["sequence"] and not same:
                            raise StaleEvent("The same source version has different content")
                    if same and not force:
                        if sequence is not None:
                            conn.execute(update(documents).where(documents.c.id == doc_id).values(sequence=sequence))
                        return dict(prior)
                    job_id, now = str(uuid.uuid4()), time.time()
                    if not doc:
                        conn.execute(insert(documents).values(id=doc_id, dataset=dataset,
                            index_id=index_id, source=source, kind=kind, sequence=sequence))
                    conn.execute(insert(jobs).values(id=job_id, doc_id=doc_id, index_id=index_id,
                        blob=blob, suffix=suffix, kind=kind, status="queued", attempts=0,
                        available=now, lease=0, created=now, count=0))
                    conn.execute(update(documents).where(documents.c.id == doc_id).values(
                        desired=job_id, sequence=sequence))
                    if prior and prior["status"] == "queued":
                        conn.execute(update(jobs).where(jobs.c.id == prior["id"]).values(status="superseded"))
                    return dict(conn.execute(select(jobs).where(jobs.c.id == job_id)).mappings().one())
            except IntegrityError:
                if attempt == 2:
                    raise

    def _garbage(self, conn, revision, kind, index_id):
        if revision and not conn.execute(select(garbage.c.revision).where(garbage.c.revision == revision)).first():
            conn.execute(insert(garbage).values(revision=revision, kind=kind, index_id=index_id))

    def claim(self, index_id, lease_seconds, max_attempts):
        now = time.time()
        with self.transaction() as conn:
            query = select(jobs).where(jobs.c.index_id == index_id, or_(
                and_(jobs.c.status == "queued", jobs.c.available <= now),
                and_(jobs.c.status == "running", jobs.c.lease < now)))
            job = conn.execute(query.order_by(jobs.c.created).with_for_update(skip_locked=True)
                               .limit(1)).mappings().first()
            if not job:
                return None
            self._garbage(conn, job["token"], job["kind"], index_id)
            if job["attempts"] >= max_attempts:
                conn.execute(update(jobs).where(jobs.c.id == job["id"]).values(
                    status="failed", error="Lease expired; retry limit reached"))
                return None
            token = str(uuid.uuid4())
            conn.execute(update(jobs).where(jobs.c.id == job["id"]).values(
                token=token, lease=now + lease_seconds, status="running", attempts=job["attempts"] + 1))
            result = dict(job)
            result.update(token=token, attempts=job["attempts"] + 1)
            doc = conn.execute(select(documents).where(documents.c.id == job["doc_id"])).mappings().one()
            result.update(source=doc["source"], dataset=doc["dataset"])
            return result

    def renew(self, job, seconds):
        now = time.time()
        with self.transaction() as conn:
            result = conn.execute(update(jobs).where(jobs.c.id == job["id"],
                jobs.c.token == job["token"], jobs.c.status == "running", jobs.c.lease >= now)
                .values(lease=now + seconds))
            if result.rowcount != 1:
                raise LostLease("Worker no longer owns this attempt")

    def publish(self, job, count):
        # This transaction is the publication boundary; queries validate against it.
        with self.transaction() as conn:
            doc = conn.execute(select(documents).where(documents.c.id == job["doc_id"])
                               .with_for_update()).mappings().one()
            current = conn.execute(select(jobs).where(jobs.c.id == job["id"]).with_for_update()).mappings().one()
            if current["token"] != job["token"] or current["status"] != "running" or current["lease"] < time.time():
                raise LostLease("Expired attempt cannot publish")
            if doc["desired"] != job["id"]:
                self._garbage(conn, job["token"], job["kind"], job["index_id"])
                status = "superseded"
            else:
                self._garbage(conn, doc["active"], doc["kind"], job["index_id"])
                revision = job["token"] if job["blob"] is not None else None
                conn.execute(update(documents).where(documents.c.id == doc["id"]).values(
                    active=revision, kind=job["kind"]))
                status = "complete"
            conn.execute(update(jobs).where(jobs.c.id == job["id"]).values(status=status, count=count, error=None))

    def fail(self, job, error, max_attempts):
        with self.transaction() as conn:
            current = conn.execute(select(jobs).where(jobs.c.id == job["id"]).with_for_update()).mappings().one()
            # A commit may succeed even if its acknowledgement is lost. Never delete that revision.
            if current["status"] == "complete":
                return
            self._garbage(conn, job["token"], job["kind"], job["index_id"])
            if current["token"] == job["token"] and current["status"] == "running":
                conn.execute(update(jobs).where(jobs.c.id == job["id"]).values(
                    status="failed" if job["attempts"] >= max_attempts else "queued",
                    available=time.time() + min(60, 2 ** job["attempts"]), lease=0,
                    token=None, error=str(error)[:400]))

    def active(self, doc_ids):
        if not doc_ids:
            return {}
        with self.engine.connect() as conn:
            return dict(conn.execute(select(documents.c.id, documents.c.active)
                                     .where(documents.c.id.in_(doc_ids))).all())

    def job(self, job_id):
        with self.engine.connect() as conn:
            result = conn.execute(select(jobs).where(jobs.c.id == job_id)).mappings().first()
            return dict(result) if result else None

    def active_image_suffix(self, blob, dataset, index_id):
        with self.engine.connect() as conn:
            suffix = conn.execute(select(jobs.c.suffix).join(documents, documents.c.active == jobs.c.token)
                .where(documents.c.dataset == dataset, documents.c.index_id == index_id,
                       documents.c.kind == "image", jobs.c.kind == "image", jobs.c.blob == blob,
                       jobs.c.status == "complete").limit(1)).scalar_one_or_none()
            return suffix

    def active_sources(self, dataset, index_id):
        with self.engine.connect() as conn:
            rows = conn.execute(select(documents.c.id, documents.c.source, documents.c.active.label("revision"), jobs.c.blob, jobs.c.suffix)
                .join(jobs, and_(jobs.c.token == documents.c.active, jobs.c.doc_id == documents.c.id))
                .where(documents.c.dataset == dataset, documents.c.index_id == index_id,
                       documents.c.active.is_not(None), jobs.c.status == "complete", jobs.c.blob.is_not(None)))
            return [dict(row._mapping) for row in rows]

    def status(self, index_id):
        from sqlalchemy import func
        with self.engine.connect() as conn:
            return dict(conn.execute(select(jobs.c.status, func.count()).where(jobs.c.index_id == index_id)
                                     .group_by(jobs.c.status)).all())

    def retry(self, job_id):
        with self.transaction() as conn:
            conn.execute(update(jobs).where(jobs.c.id == job_id, jobs.c.status == "failed")
                         .values(status="queued", attempts=0, available=time.time()))

    def sources(self, dataset, index_id):
        """Keyset pages keep reindexing bounded, even for large source catalogs."""
        last = ""
        while True:
            with self.engine.connect() as conn:
                rows = conn.execute(select(documents.c.id, documents.c.source, documents.c.sequence,
                    jobs.c.blob, jobs.c.suffix, jobs.c.kind).join(jobs, jobs.c.id == documents.c.desired)
                    .where(documents.c.dataset == dataset, documents.c.index_id == index_id, documents.c.id > last)
                    .order_by(documents.c.id).limit(500)).mappings().all()
            if not rows:
                return
            for row in rows:
                yield dict(row)
            last = rows[-1]["id"]

    def collect(self, store, index_id):
        with self.engine.connect() as conn:
            pending = conn.execute(select(garbage).where(garbage.c.index_id == index_id).limit(100)).mappings().all()
        for item in pending:
            # This revision can never be reused: every claimed attempt has a fresh UUID.
            with self.engine.connect() as conn:
                if conn.execute(select(documents.c.id).where(documents.c.active == item["revision"])).first():
                    continue
            store.delete(item["kind"], item["revision"])
            with self.transaction() as conn:
                conn.execute(delete(garbage).where(garbage.c.revision == item["revision"]))

    def close(self):
        self.engine.dispose()
