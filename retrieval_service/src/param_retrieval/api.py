import secrets
import tempfile
import mimetypes
import re
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI, File, Header, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from .config import Settings
from .service import Service
from .state import StaleEvent
from .filters import SearchFilters
from .parsers import IMAGE_SUFFIXES
from .analytics import AggregateFilters


class RetrievalRequest(BaseModel):
    query: str = Field(min_length=1, max_length=4000)
    top_k: int = Field(5, ge=1, le=50)
    scope: str = Field("text", pattern="^(text|image|all)$")
    filters: SearchFilters | None = None


class AggregateRequest(BaseModel):
    query: str = Field(min_length=1, max_length=4000)
    filters: AggregateFilters | None = None


class RecordUpdate(BaseModel):
    source: str = Field(min_length=1, max_length=1000)
    version: int = Field(ge=1)
    record: dict


class SourceDelete(BaseModel):
    source: str = Field(min_length=1, max_length=1000)
    version: int = Field(ge=1)


def create_app(service=None):
    svc = service or Service(Settings())
    cfg = svc.settings
    if not cfg.read_key or not cfg.ingest_key or cfg.read_key == cfg.ingest_key:
        raise ValueError("Configure distinct PARAM_READ_KEY and PARAM_INGEST_KEY")

    def authenticate(expected):
        def check(authorization: str = Header(default="")):
            if not secrets.compare_digest(authorization, "Bearer " + expected):
                raise HTTPException(401, "Invalid credentials")
        return check

    read_access = Depends(authenticate(cfg.read_key))
    write_access = Depends(authenticate(cfg.ingest_key))

    @asynccontextmanager
    async def lifespan(app):
        # Run `param-retrieval init` separately before the API starts.
        yield
        svc.close()

    app = FastAPI(title="Param Retrieval", version="3.1", lifespan=lifespan,
                  docs_url=None, redoc_url=None, openapi_url=None)

    @app.get("/health")
    def health():
        return {"status": "alive"}

    @app.get("/ready", dependencies=[read_access])
    def ready():
        try:
            svc.state.status(cfg.index_id)
            # A lightweight query confirms configured collections and connectivity.
            svc.store.search("text", [1.0] + [0.0] * (cfg.text_dimension - 1), cfg.dataset, cfg.index_id, 1)
            published_sources = len(svc.state.active_sources(cfg.dataset, cfg.index_id))
        except Exception:
            raise HTTPException(503, "Storage is unavailable")
        return {"status": "ready", "index_id": cfg.index_id, "published_sources": published_sources}

    @app.post("/v1/retrieve", dependencies=[read_access])
    def retrieve(body: RetrievalRequest):
        try:
            return svc.retrieve(body.query, body.top_k, body.scope, filters=body.filters)
        except ValueError as exc:
            raise HTTPException(422, str(exc))

    @app.post("/v1/aggregate", dependencies=[read_access])
    def aggregate(body: AggregateRequest):
        try:
            return svc.aggregate(body.query, body.filters)
        except ValueError as exc:
            raise HTTPException(422, str(exc))
        except RuntimeError as exc:
            raise HTTPException(409, str(exc))

    @app.get("/v1/blobs/{blob_id}", dependencies=[read_access])
    def image_blob(blob_id: str):
        if not re.fullmatch(r"[a-f0-9]{64}", blob_id):
            raise HTTPException(404, "Image not found")
        suffix = svc.state.active_image_suffix(blob_id, cfg.dataset, cfg.index_id)
        if suffix not in IMAGE_SUFFIXES:
            raise HTTPException(404, "Image not found")

        def stream_image():
            with svc.blobs.materialize(blob_id, suffix) as path:
                with path.open("rb") as source:
                    while block := source.read(1024 * 1024):
                        yield block

        return StreamingResponse(stream_image(), media_type=mimetypes.guess_type("image" + suffix)[0],
            headers={"Cache-Control": "private, max-age=300", "X-Content-Type-Options": "nosniff"})

    @app.post("/v1/files", dependencies=[write_access], status_code=202)
    def ingest_file(file: UploadFile = File(...), source: str = Query(min_length=1, max_length=1000),
                    version: int = Query(ge=1)):
        # Bounded disk copy; the reverse proxy should enforce the same body-size limit.
        suffix = Path(file.filename or "").suffix.lower()
        with tempfile.TemporaryDirectory() as directory:
            path, total = Path(directory) / ("upload" + suffix), 0
            with path.open("wb") as target:
                while block := file.file.read(1024 * 1024):
                    total += len(block)
                    if total > cfg.max_file_mb * 1024 * 1024:
                        raise HTTPException(413, "File too large")
                    target.write(block)
            try:
                job = svc.submit(path, source, version)
            except StaleEvent as exc:
                raise HTTPException(409, str(exc))
            except ValueError as exc:
                raise HTTPException(422, str(exc))
        return {"job_id": job["id"], "status": job["status"]}

    @app.put("/v1/records", dependencies=[write_access], status_code=202)
    def update_record(body: RecordUpdate):
        try:
            job = svc.submit_record(body.source, body.record, body.version)
        except StaleEvent as exc:
            raise HTTPException(409, str(exc))
        except ValueError as exc:
            raise HTTPException(422, str(exc))
        return {"job_id": job["id"], "status": job["status"]}

    @app.post("/v1/deletions", dependencies=[write_access], status_code=202)
    def delete_source(body: SourceDelete):
        try:
            job = svc.remove(body.source, body.version)
        except StaleEvent as exc:
            raise HTTPException(409, str(exc))
        return {"job_id": job["id"], "status": job["status"]}

    @app.get("/v1/jobs/{job_id}", dependencies=[write_access])
    def job_status(job_id: str):
        job = svc.state.job(job_id)
        if not job or job["index_id"] != cfg.index_id:
            raise HTTPException(404, "Job not found")
        return {k: job[k] for k in ("id", "status", "count", "attempts", "error")}

    @app.post("/v1/jobs/{job_id}/retry", dependencies=[write_access], status_code=202)
    def retry(job_id: str):
        job_status(job_id)
        svc.state.retry(job_id)
        return job_status(job_id)

    return app
