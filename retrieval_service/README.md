# Param ingestion and retrieval service

**Search-quality upgrade 3.1:** see [UPGRADE_SEARCH.md](UPGRADE_SEARCH.md) for reranking, optional filters, metadata backfill and calibrated relevance cutoffs. Existing vectors and state schema are preserved. Its ranking/rollout instructions supersede the original RRF-only notes below.

**Deploying the working Colab index? Start with [DEPLOYMENT.md](DEPLOYMENT.md).** Use `deploy.py` for guarded startup and `.env` support. Give the backend team [BACKEND_API.md](BACKEND_API.md), not this internal implementation guide.

All application source is included in the self-contained Colab notebook. No Docker is used or required.

## Start in Colab

1. Download `param_retrieval_final.ipynb` (no companion ZIP needed).
2. Open it in a fresh Colab runtime and run the cells in order; they write and install the embedded source.
3. Add these Colab secrets, with notebook access enabled:
   - `QDRANT_URL`: your existing cluster endpoint.
   - `QDRANT_API_KEY`: a database key permitted to create collections/indexes, write and delete points.
   - `STATE_DATABASE_URL`: `postgresql+psycopg://USER:PASSWORD@HOST/DB?sslmode=require`.
4. Run the cells in order. Google Drive still holds the original `param_prototype_data/param` folder.

The PostgreSQL database is an additional dependency. Qdrant stores search vectors; PostgreSQL stores durable jobs, source versions and publication state. This separation lets API and worker processes share state and lets the vector database change. The notebook intentionally uses this service configuration, not a temporary in-memory queue. SQLite remains available for local development and tests only.

The notebook contains readable source code, tests, settings, deployment commands and this guide. It can optionally export a deployment ZIP; that ZIP is an output, not a prerequisite.

## Hybrid text retrieval and upgrading the index

Text retrieval now queries two independent candidate lists: dense semantic vectors and a lexical index. Qdrant uses FastEmbed `Qdrant/bm25` sparse vectors with the Qdrant IDF modifier. Both representations are written into the same point in one upsert, so activation and deletion cover both. The alternate pgvector adapter uses PostgreSQL GIN full-text search with `ts_rank_cd` and a `simple` dictionary; that adapter's lexical score is not BM25. Its query matches any token, while the dense branch handles semantic matching.

After checking each branch against the active document revisions in PostgreSQL, the service deduplicates point IDs and applies equal-weight reciprocal-rank fusion: `sum(1 / (rrf_k + rank))`, with one-based ranks and `rrf_k=60`. It retrieves at least 64 candidates per arm (more for larger top-k); stale-result pressure expands candidates up to 1024. RRF is computed over these bounded candidate lists, not the entire corpus. A failed branch raises an error instead of silently pretending a dense-only response is hybrid. An empty lexical list legitimately falls back to the dense candidates.

Text `score` is now an RRF ranking score, **not a cosine score or probability**. Each result also includes `score_type`, `ranks` and `branch_scores` for inspection. Image search remains dense CLIP retrieval with cosine scores. Neither path calls a generative LLM. The API URL and request fields are unchanged, but consumers must not apply old cosine thresholds to the new text score.

**Upgrade once:** the default collection prefix is now `param_v3`, and the pipeline namespace has changed. Run the notebook's scan and process sections to build the new dense+sparse index. Unchanged files from the old pipeline are intentionally indexed again; old `param_v2` collections and state remain available. Only switch deployed API/worker configuration together after the new index is complete. Do not point this version at a legacy dense-only collection; initialization rejects it. Subsequent updates remain incremental.

BM25 is lexical, not exact substring matching; tokenizer/stemming/language choices affect identifiers and multilingual text. The default FastEmbed BM25 settings target English and use a fixed average document-length parameter. Qdrant IDF statistics are collection-wide, so retained revisions and other namespaces can affect ranking statistics until cleanup; use separate collection prefixes for independently tuned datasets. These statistics do not bypass dataset/index/revision result filters.

References: [Qdrant sparse BM25 and IDF](https://qdrant.tech/course/essentials/day-3/sparse-retrieval-demo/), [PostgreSQL text ranking](https://www.postgresql.org/docs/current/textsearch-controls.html).

## Components and ownership

| Concern | Module | Change required |
| --- | --- | --- |
| File formats | `parsers.py` | Add a parser to `PARSERS` for a new format |
| Embeddings | `embeddings.py` | Inject an `Embedder` or change configured model |
| Qdrant / pgvector | `vectors.py` | Environment configuration for included adapters |
| Another vector DB | `ports.py`, new adapter | Implement the dense and lexical store contract and register the class |
| Hybrid fusion | `fusion.py` | Tune `rrf_k` without rebuilding the index |
| Source snapshots | `blobs.py` | Directory/Drive path or `s3://bucket/prefix` |
| Durable queue/version state | `state.py` | PostgreSQL connection string |
| API hosting | `cli.py`, environment | Same Python commands on the new host |
| Optional LLM | `Service(postprocessor=...)` | Supply one callable, then use `process=True` internally |

Supported inputs: CSV, XLSX, JSON, JSONL, TXT, Markdown, DOCX, text PDFs, JPG, JPEG, PNG and WebP. Archives are ignored; ingest their extracted contents. CSV uses UTF-8 and a header row; Excel uses each sheet's first row as headings. Unusual encodings or layouts need a parser override, not manual inspection on every run. XLSX reads cached formula results; it does not calculate formulas. DOCX includes normal paragraph and table blocks; embedded objects are not interpreted. Scanned PDF pages requiring OCR fail explicitly. Images use CLIP visual embeddings; handwriting OCR is not included.

## Update guarantees

- Source identity is the dataset, index namespace and caller-supplied source key (or relative filename).
- Ingestion copies immutable content-addressed snapshots before enqueueing. Source edits cannot change a queued job's bytes.
- Re-submitting identical content returns its existing job. New content creates a new job; a change to a file reindexes that entire file. For high-frequency streams, submit one logical record per source key.
- Each worker attempt has a unique revision and renewable lease. PostgreSQL uses row locks with `SKIP LOCKED` to distribute jobs. Expired attempts cannot publish.
- Batches are staged before publication. Search validates every returned revision against PostgreSQL, so partial/uncommitted/retired content is not returned as current evidence.
- A failed update retains the previous completed version. Jobs retry with backoff up to five attempts; inspect and explicitly retry failed jobs after correcting the cause.
- API updates require a monotonically increasing `version` per source. Older or conflicting events receive HTTP 409. Without versions (filesystem scans), the latest accepted observation wins.
- Deletion is an explicit, versioned tombstone. Missing files do not silently delete vectors, which protects against incomplete filesystem/Drive mounts. A renamed file is a new source; explicitly delete the old key if desired.
- Old/failed vectors are cleaned after publication by a retryable garbage queue. Snapshots and job history are retained for recovery; choose a retention policy before long-term operation.

This is asynchronous, near-real-time ingestion: a 202 response means queued, not yet searchable. Latency depends on queue backlog, parsing and embedding time. Continuous updates require a continuously running worker. A Colab session cannot provide that service after disconnection.

Search is eventually consistent across the vector store and PostgreSQL. Version validation prevents stale results; bounded candidate expansion can temporarily return fewer results during heavy replacement/cleanup, reported by `candidate_limit_reached`. There is no distributed transaction across both databases. An in-flight read may reflect the snapshot just before a concurrent update commits.

## Python deployment (no Docker)

Use Python 3.12 or later for the tested environment. Unzip the package, create a virtual environment and install:

```sh
python -m venv .venv
# Activate .venv using your operating system's normal command.
python -m pip install ".[production]"
```

Configure the variables listed in `.env.example` in the hosting platform or process environment. The application does not automatically load `.env`. API and worker processes must use the same dataset, models, vector destination, state database and blob root.

For services on different machines use a private S3-compatible bucket for snapshots. A shared persistent filesystem also works. A Colab Drive mount is not automatically available to deployed workers. Use `AWS_ENDPOINT_URL_S3` for a compatible endpoint and normal AWS credentials/IAM. Moving from Drive to S3 requires copying existing content-addressed snapshots as well as changing the setting.

Initialize schema, collections and indexes once before starting services:

```sh
param-retrieval init
```

Start these as separate supervised Python processes:

```sh
param-retrieval api --port 8000
param-retrieval worker
```

An optional third process polls a mounted folder configured as `PARAM_SOURCE_ROOT`:

```sh
param-retrieval watch
```

The watcher hashes supported files every `PARAM_SCAN_SECONDS`. This is suitable for modest folders, not a millions-of-files change feed. For large or frequent updates, send files/records to the ingestion endpoints from your upstream application. A native Google Drive change-feed connector is not included; connect Drive notifications to a producer if needed.

Scale API replicas and worker processes separately with PostgreSQL state and shared snapshots. Qdrant-local and SQLite are for a single local runtime. Pre-download the public embedding models to each worker/API host's model cache before accepting traffic if cold-start latency matters. Choose memory based on measured model usage; a tiny free web instance may not fit both text and CLIP encoders. No GPU is required by this implementation.

Put the API behind TLS, enforce request body limits/timeouts and rate limits at the gateway, supervise processes, monitor queue age/failed jobs, and back up PostgreSQL, snapshots and vector indexes. The included library bounds file sizes but is not a sandbox for hostile document processing. Use a dedicated worker account and resource limits for public uploads. Schema evolution after this release needs database migrations; `create_all()` initializes missing tables, not existing-column migrations.

## Backend contract

Give the startup backend just your service URL and `PARAM_READ_KEY`. Keep `PARAM_INGEST_KEY` internal unless a designated ingestion producer needs it. Qdrant/database/storage credentials stay inside your service. The two application keys must differ.

```http
POST /v1/retrieve
Authorization: Bearer <retrieval-key>
Content-Type: application/json

{"query":"visitor sessions for color perception","top_k":5,"scope":"text"}
```

Scopes are `text`, `image`, and `all`. Text/image results remain separate because their scores are not comparable. Each result contains `id`, `score`, `source`, `locator`, `text`, `attributes`, `blob_id`, `revision`, `score_type`, `ranks` and `branch_scores`. Text scores are RRF ranks; image scores are cosine similarity; neither is a probability. No final generative LLM is called. `blob_id` is an internal immutable asset identifier, not a public image URL; a private asset-serving layer remains a separate integration.

For an update producer, using the ingestion key:

```http
PUT /v1/records
Authorization: Bearer <ingestion-key>
Content-Type: application/json

{"source":"sensor/123","version":2,"record":{"exhibit":"Kinetic Bug","duration_s":14}}
```

The response is `{ "job_id": "...", "status": "queued" }`. Poll `GET /v1/jobs/{job_id}`. Completed jobs report `status: complete` and a chunk count. `POST /v1/jobs/{job_id}/retry` retries a failed job.

File producers call `POST /v1/files?source=relative-name.csv&version=2` with a multipart field named `file`. Deletions use `POST /v1/deletions` with `{ "source": "sensor/123", "version": 3 }`. All these routes require the ingestion key. `GET /health` is liveness only; authenticated `GET /ready` checks storage connectivity.

Common identifier fields are omitted recursively from structured records. This is a configurable rule, not a complete PII detector: prose, filenames, images and uncommon column names may still contain personal information. Keep source snapshots and returned image references private. File contents are indexed as data, never executed as instructions. Any future LLM must treat retrieved material as untrusted context.

## Change the vector database or embedding model

The included adapters are Qdrant and pgvector. For pgvector, an administrator first installs the `vector` extension (version 0.8 or later). Change `PARAM_VECTOR_BACKEND=pgvector` and `PARAM_VECTOR_URL=postgresql+psycopg://...`. Rebuild the destination index before switching API traffic:

```python
old_index_id = service.settings.index_id
service.close()
new = Service(new_settings).initialize()
new.rebuild(from_index_id=old_index_id)  # reads existing snapshots and state
new.drain()
```

Keep the same state database and blob storage for this migration. A destination/model/config change creates a new index namespace. Rotating a vector key does not change it. A dimension change also needs a new `collection_prefix`. Reindexing is required: changing an environment variable cannot move vectors. Validate the new index, then cut over the API. Old indexes are retained; remove them explicitly after rollback is no longer needed. To repair an externally wiped index at the same URL, use `service.rebuild()`.

For a new, unsupported vector vendor, implement the `VectorStore` protocol and add one entry to `VECTOR_ADAPTERS`. Parsers, job handling and API contracts stay unchanged. The same rules for publication, filters, wait-for-write and idempotency must hold in that adapter.

## Add an LLM later

```python
def final_processing(query, retrieved):
    return my_llm_client.answer(query=query, evidence=retrieved)

service = Service(settings, postprocessor=final_processing)
result = service.retrieve("your query", process=True)
```

Alternatively, the startup backend can pass `/v1/retrieve` results to its own model. Neither approach requires changing ingestion. No LLM credentials or provider dependency are installed now. Numerical maxima, totals and averages still require an explicit analytics path; embedding a table does not calculate them.

## Verification and practical limits

```sh
python -m pip install ".[test]"
python -m pytest -q
```

The suite covers the real Qdrant local adapter with deterministic test embeddings: replacement, failure preservation, leases, concurrency, idempotency, ordered events, deletion, recovery, parsing, API authorization, and rebuilding. A pgvector contract test runs only when `PARAM_TEST_PGVECTOR_URL` is supplied. `tests/test_files.py` optionally validates the supplied Param files without uploading them. Unit/lifecycle checks are not a production load test; benchmark retrieval quality, throughput, concurrent readers and failure recovery on the actual managed databases before rollout.

The text index performs dense + lexical hybrid retrieval with RRF. Generic character chunking retains content across chunks but may require language/model-specific tuning; the embedding model's token window still applies. Image models provide approximate visual retrieval and do not reliably read handwriting. Files are ingested in bounded batches, though individual PDF/DOCX parser objects may use file-proportional memory. Retry starts a file attempt again; this release does not persist embedding-batch checkpoints.

Reference APIs: [Qdrant points](https://qdrant.tech/documentation/manage-data/points/), [FastEmbed](https://qdrant.github.io/fastembed/), [pgvector](https://github.com/pgvector/pgvector), [SQLAlchemy locking](https://docs.sqlalchemy.org/en/20/core/selectable.html#sqlalchemy.sql.expression.GenerativeSelect.with_for_update).
