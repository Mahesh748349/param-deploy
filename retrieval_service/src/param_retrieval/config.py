import hashlib
import json
from pathlib import Path
from urllib.parse import urlsplit

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """All infrastructure choices live here or in PARAM_* environment variables."""
    model_config = SettingsConfigDict(env_prefix="PARAM_", extra="ignore")
    dataset: str = "param"
    state_url: str = "sqlite:///param-state.db"
    blob_root: str = "./param-blobs"  # directory OR s3://bucket/prefix
    vector_backend: str = "qdrant"
    vector_url: str = ""  # Qdrant URL OR postgresql+psycopg://... for pgvector
    vector_key: str = ""
    local_vector_path: str = "./param-vectors"
    collection_prefix: str = Field("param_v3", pattern=r"^[a-z][a-z0-9_]{0,30}$")
    model_cache: str = "./model-cache"
    text_model: str = "BAAI/bge-small-en-v1.5"
    image_model: str = "Qdrant/clip-ViT-B-32-vision"
    image_query_model: str = "Qdrant/clip-ViT-B-32-text"
    text_dimension: int = 384
    image_dimension: int = 512
    batch_size: int = Field(128, ge=1, le=1024)
    image_batch_size: int = Field(8, ge=1, le=64)
    threads: int = Field(2, ge=1, le=32)
    lease_seconds: int = Field(180, ge=15)
    max_attempts: int = Field(5, ge=1)
    max_file_mb: int = Field(100, ge=1)
    chunk_chars: int = Field(1000, ge=100, le=1600)
    chunk_overlap: int = Field(100, ge=0, le=99_999)
    pipeline_version: str = "3.0-hybrid"
    rrf_k: int = Field(60, ge=1)
    rerank_enabled: bool = True
    rerank_model: str = "Xenova/ms-marco-MiniLM-L-6-v2"
    rerank_candidates: int = Field(64, ge=50, le=200)
    rerank_batch_size: int = Field(8, ge=1, le=64)
    rerank_min_score: float | None = Field(None, allow_inf_nan=False)
    read_key: str = ""
    ingest_key: str = ""
    source_root: str = ""
    scan_seconds: int = Field(30, ge=5)
    blocked_fields: tuple[str, ...] = (
        "name", "username", "user_id", "userid", "email", "email_address",
        "phone", "phone_number", "mobile", "address", "sessionid", "eventid",
        "session_id", "event_id", "user_name", "first_name", "last_name",
    )

    @property
    def index_id(self) -> str:
        # Pipeline/model changes create a new logical index; never silently mix vectors.
        target = urlsplit(self.vector_url)
        destination = f"{target.scheme}://{target.hostname}:{target.port}{target.path}" if self.vector_url else str(Path(self.local_vector_path).resolve())
        values = [self.pipeline_version, self.text_model, self.image_model,
                  self.image_query_model, self.text_dimension, self.image_dimension,
                  self.chunk_chars, self.chunk_overlap, self.blocked_fields,
                  self.vector_backend, destination, self.collection_prefix]
        return hashlib.sha256(json.dumps(values).encode()).hexdigest()[:20]

    def prepare(self):
        if self.chunk_overlap >= self.chunk_chars:
            raise ValueError("chunk_overlap must be smaller than chunk_chars")
        Path(self.model_cache).mkdir(parents=True, exist_ok=True)
