# Deploy your existing Colab index (no Docker)

This bundle is for hosting, not an extra dependency for your notebook. It contains the same hybrid retrieval implementation as the normal Colab notebook. No secrets, source documents, model weights or database snapshots are included. Deployment has not been performed for you.

## 1. Capture the existing index settings

In your working Colab session, run this non-secret diagnostic:

```python
print('EXPECTED INDEX:', service.settings.index_id)
for name in ('dataset', 'collection_prefix', 'pipeline_version', 'text_model',
             'image_model', 'image_query_model', 'text_dimension', 'image_dimension',
             'chunk_chars', 'chunk_overlap', 'blocked_fields'):
    print(name, getattr(service.settings, name))
```

The supplied defaults match the delivered notebook. If you changed any of these, configure the matching PARAM_* settings on BOTH the API and worker. Copy QDRANT_URL exactly from your Colab secret: changing an explicit port or trailing slash changes this implementation's index identity even if it resolves to the same server. Keep your existing Supabase state database. Do not scan or rebuild merely to deploy.

## 2. Configure secrets

Unzip this folder and install Python 3.11+ (3.12 is a suitable deployment baseline). Create a virtual environment if running on your own machine. Install from the bundle root:

```sh
python -m pip install -r requirements.txt
```

Use your host's environment/secret settings, or copy `.env.example` to `.env` locally. `deploy.py` loads a local `.env`; never commit it. Set:

| Deployment setting | Value |
| --- | --- |
| PARAM_STATE_URL | Existing Colab STATE_DATABASE_URL (percent-encoded password) |
| PARAM_VECTOR_URL | Exact Colab QDRANT_URL |
| PARAM_VECTOR_KEY | Colab QDRANT_API_KEY |
| PARAM_EXPECTED_INDEX_ID | Index ID printed above |
| PARAM_READ_KEY | New random retrieval key |
| PARAM_INGEST_KEY | Different random producer key |
| PARAM_BLOB_ROOT | Shared persistent directory or private s3://bucket/prefix |
| PARAM_MODEL_CACHE | Writable model cache path on each host |

Generate each application key with `python -c "import secrets; print(secrets.token_urlsafe(32))"` in a private terminal and store the output in your secret manager. These are keys you create, not Qdrant keys. Do not put them in the backend guide or commit them. The deployment wrapper refuses to start if the calculated index ID differs from Colab.

## 3. Preserve snapshots

Copy the CONTENTS of Drive's `param_prototype_data/service_snapshots` to the configured shared snapshot directory or private bucket prefix, retaining the exact hash filenames. Verify transferred file contents/checksums and keep the Drive copies until validation is complete. The deployment machine cannot use `/content/drive/...`.

If API and worker are on different machines, both need the same private S3-compatible bucket, or a genuinely shared filesystem (two unrelated disks do not count). S3 uses standard AWS credentials/IAM; compatible providers can use AWS_ENDPOINT_URL_S3. Model caches can be separate. The snapshot copy is not a vector re-ingestion.

For existing text search only, snapshot bytes are not read: text and metadata are already in Qdrant. But do not enable ingestion/rebuild workflows until shared snapshot storage is configured and the existing snapshots have been transferred. Images return private blob IDs; serving actual images is a separate asset integration.

The corrected `/v1/aggregate` endpoint also reads indexed structured payloads, so analytics does not require local snapshot copies. Updating sources, rebuilding indexes and serving images still require persistent shared snapshot storage.

## 4. Start the service

From the bundle root, with environment settings applied:

```sh
python deploy.py check
python deploy.py warmup
```

Check that the printed index ID matches Colab and job counts are as expected. Warmup caches text and BM25 assets; set PARAM_WARM_IMAGES=true to cache both CLIP models too. No paid model API or Hugging Face token is required for the public models.

Start as TWO separate supervised processes (do not run sequentially in one terminal):

```sh
python deploy.py api
```

```sh
python deploy.py worker
```

The API uses the host's PORT variable, default 8000. For a Python hosting platform, the build command is `python -m pip install -r requirements.txt`, web start command is `python deploy.py api`, worker start command is `python deploy.py worker`, and liveness path is `/health`. No Dockerfile is used. Hosting plan selection is separate: do not assume a free plan supports a continuous worker, sufficient RAM for all encoders, or persistent storage. Measure memory/latency before selecting capacity.

Place the public API behind HTTPS; limit request sizes/rates and set timeouts at the gateway. Keep worker and storage private. Monitor job failures/queue age and back up state, snapshots and vectors. The API does not start a background worker itself. Folder polling is optional, not enabled here; producers can push updates via API.

## 5. Validate before handoff

- GET /health succeeds; GET /ready with retrieval authorization succeeds and shows the expected index ID.
- POST /v1/retrieve returns the same relevant source evidence as Colab.
- Missing/incorrect keys are rejected; retrieval key cannot write records.
- With your ingestion key, add a temporary source such as deployment-check/unique-id, poll its job to completion, then update it with a higher version and delete it with a higher version. Confirm obsolete evidence disappears. Do not use an existing source key for this check.
- Restart API and worker; confirm search still works and queued jobs survive.
- Measure actual query latency and memory with expected traffic. Live-cloud reliability and quality are not established by local tests.

Finally give the backend team only BACKEND_API.md, your HTTPS base URL and PARAM_READ_KEY through a secure channel. The service URL does not exist until you host it.

## Local tests

```sh
python -m pip install ".[test]"
python -m pytest -q
```

Tests use real local Qdrant with deterministic dense/sparse encoders. PARAM_TEST_REAL_BM25=1 enables a real BM25 tokenizer check. PARAM_TEST_PGVECTOR_URL enables the live PostgreSQL/pgvector contract test against a dedicated test database.
