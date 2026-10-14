# Retrieval API — backend handoff

## 3.1 additions (existing requests remain valid)

Optional request `filters`: `{"source":"Physical Exhibit.xlsx","sheet":"Kinetic Bug","exhibit":"Kinetic Bug"}`. Fields are optional, combined with AND, and require the operator's one-time metadata backfill before use. Source/sheet are exact; exhibit normalizes case, spaces, hyphens and underscores. Filters are NOT inferred from the query automatically. See UPGRADE_SEARCH.md for semantics.

Text hits now include `rerank_score` when reranking is enabled. Keep server result order. Existing `score` still means RRF and should retain that label, but it no longer determines final order. Response `ranking.text` is `reranker` or `rrf`. Reranker scores are not confidence probabilities. Once the operator sets a calibrated cutoff, top_k is a maximum: fewer/zero results are normal. Never pad with unrelated hits; show a no-evidence state when empty. Existing UI can ignore the added fields if it preserves result order.

The service owner supplies an HTTPS base URL and one retrieval key privately. Do not expose the key in frontend/browser code. Call from your backend. Database credentials are not needed.

## Request

```http
POST /v1/retrieve
Authorization: Bearer <retrieval-key>
Content-Type: application/json

{"query":"visitor interactions involving color perception","top_k":5,"scope":"text"}
```

Query must contain non-whitespace text and be at most 4000 characters. top_k is 1–50, default 5. scope is text (default), image, or all. With all, top_k applies separately to each result list.

Example response (illustrative, not a captured response):

```json
{
  "request_id": "generated-request-uuid",
  "query": "visitor interactions involving color perception",
  "dataset": "param",
  "index_id": "configured-index-id",
  "candidate_limit_reached": false,
  "text_results": [{
    "id": "chunk-uuid",
    "score": 0.03278688524590164,
    "score_type": "rrf",
    "ranks": {"dense": 1, "lexical": 1},
    "branch_scores": {"dense": 0.78, "lexical": 4.2},
    "source": "engagement-sessions-2026-09-15.csv",
    "locator": "row:42|char:0",
    "text": "Source text for the matching session...",
    "attributes": {"exhibit_id": "color-perception"},
    "blob_id": "private-snapshot-hash",
    "revision": "published-revision-uuid"
  }]
}
```

Text retrieval is dense + lexical search with reciprocal-rank fusion. Scores are NOT confidence percentages; do not apply cosine thresholds to RRF scores. A hit may occur in one or both branches. Image results use cosine similarity and appear separately under image_results. Only requested result lists are present. There can be fewer than top_k hits, or an empty list. candidate_limit_reached indicates candidate filtering hit its expansion cap. blob_id is private provenance, not a public image URL.

`/v1/retrieve` performs retrieval, without final LLM generation or numerical analytics. Your backend may use evidence directly or pass it to its own LLM, treating retrieved text as untrusted input. Relevant rows are not guaranteed to be numerical maxima, totals or averages.

## Complete-data calculations

`POST /v1/aggregate` uses the same retrieval bearer key. Example:

```json
{"query":"min max average sum dwell duration across all sessions","filters":{"source":"engagement-sessions-2026-09-15.csv"}}
```

This scans published structured row payloads in the vector store, validates their revisions against PostgreSQL, deduplicates split chunks from the same row, and computes numeric values independently of `top_k`. It needs no snapshot files or model inference. No re-ingestion is needed for existing indexed records.

Supported operations: min, max, average, sum and count, including several operations on one metric. Metrics: duration (normalized to seconds), presses/interactions, session/run counts, unique exhibit counts. `by exhibit` adds per-exhibit calculations. Workbook sheet names identify physical exhibits.

Optional filters: source, sheet, exhibit, date_from and date_to (YYYY-MM-DD). Named month/year and inclusive ISO date ranges are supported in the query. Dates use the source calendar date of the session/run start, without guessing a timezone. Missing scoped dates make a date-filtered calculation fail explicitly. Unknown scopes and unsupported conditions return 422. If publication changes during a scan, return 409 and retry.

Responses include `exact`, `records`, `scope`, `sources`, `metrics`, and min/max source evidence. An empty scope returns `exact:false`, not a fabricated zero. Exactness means arithmetic over the complete matching published structured rows; it does not certify input-data accuracy. Repeated records in different source files are distinct records. PDF report prose is searchable but is not parsed into structured numeric rows by this endpoint.

`PARAM_AGGREGATE_MAX_RECORDS` bounds each scan (default 200,000). This is suitable for the current dataset; large-scale frequent analytics should use a dedicated structured SQL table/materialized views. Workers and snapshot storage are still required for ingestion, rebuilding and image assets.

## Errors and health

- 401: missing/invalid bearer key.
- 422: invalid request.
- Storage/model failures can return 5xx; apply bounded retries/backoff to search requests and log request context without secrets. Configure a timeout based on measured cold/warm latency.
- GET /health: unauthenticated liveness.
- GET /ready: retrieval key required; basic storage readiness, not model warmup.

## Updates (only for a separately authorized producer)

The normal retrieval key cannot write. With the separate ingestion key:

- PUT /v1/records: {"source":"sensor/123","version":1,"record":{"value":14}}
- POST /v1/files?source=report.csv&version=1: multipart field file.
- POST /v1/deletions: {"source":"sensor/123","version":2}
- GET /v1/jobs/{job_id}: inspect asynchronous job status.
- POST /v1/jobs/{job_id}/retry: retry a failed job.

Writes return 202 with job_id/status. This means accepted, not yet searchable. Versions must increase per stable source key; conflicting/older updates return 409. File uploads above the configured maximum return 413. A running worker is required. Preserve idempotency by reusing the same version and content when retrying an uncertain submission.
