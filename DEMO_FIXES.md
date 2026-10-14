# Demo readiness changes

The branch combines the latest upstream website with the retrieval deployment service. It has not been pushed or deployed.

Earlier handover documents and the upstream PDF describe older implementations; use this note and BACKEND_API.md for the corrected behavior.

## What changed

- Replaced hard-coded website analytics with full-data calculations over published structured database payloads. Added the missing authenticated `/api/aggregate` proxy and automatic routing of calculation queries.
- Calculations support multiple min/max/average/sum operations, session/run/exhibit counts, exact exhibit/file/sheet filters, month/year or ISO date ranges, and per-exhibit breakdowns. Unknown/unsupported filters fail explicitly. Split row chunks count once. In-flight publication changes ask the caller to retry.
- Removed website gates that rejected lexical-only matches; the retrieval service owns any calibrated relevance cutoff.
- Backend verifies Supabase bearer tokens and confirmed, approved email accounts; spoofed email headers no longer authorize access.
- Gemini is optional and configurable. Missing keys/outages show retrieved excerpts instead of invented telemetry. The backend obtains summary evidence itself. No model API is used for arithmetic.
- UI shows actual record counts, source scope and extrema locators. It can display calculations without requiring search hits. Search/summary cancellation prevents stale responses from replacing newer results.
- The website health check now checks storage readiness as well as process liveness, and detects an empty published index.

## Before deployment

1. Add `SUPABASE_URL` and `SUPABASE_ANON_KEY` (or `SUPABASE_PUBLISHABLE_KEY`) to the **Node backend's** Render environment, using the same project/public key as the frontend. Do not use a service-role key. Keep `PARAM_READ_KEY` and `PARAM_SERVICE_URL` as configured.
2. Set `ALLOWED_ORIGINS=https://param-search-studio.netlify.app` on the Node backend. Optional `GEMINI_MODEL` defaults to `gemini-2.5-flash`; no Gemini key is required for retrieval/calculation.
3. Deploy all three components from this combined branch or merge these fixes into their existing deployment branches. Python Render root: `retrieval_service`, install `requirements.txt`, start `python deploy.py api`. Node Render root: `backend`, build `npm ci`, start `npm start`. Netlify base: `frontend`, build `npm ci && npm run build`, publish `dist`.
4. Preserve existing Python `PARAM_*` index/database settings. Keep `PARAM_RERANK_ENABLED=false` on the small Render instance unless RAM has been increased. These corrections do not change index identity or require re-embedding.
5. If source/sheet/exhibit retrieval filters on the old index lack derived `_filter` metadata, use the documented one-time `python deploy.py backfill-filters`. This is a database write; do it only as a deliberate deployment step. Aggregate filters work from original payloads without that backfill.

Snapshots and a running worker are still needed to ingest updates/rebuild/serve image files. Free-host cold starts and external outages remain possible. Numerical calculations currently cover recognized structured telemetry fields, not arbitrary PDF tables, OCR, unrestricted SQL, medians or free-form conditions.

## Local verification

Verified locally: 44 Python tests passed (3 optional integrations skipped), 7 backend tests passed, 1 frontend rendering test passed, and the production frontend build succeeded. Static checks completed with warnings; they are not a live deployment test.

- Python: `python -m pytest -q` from `retrieval_service`.
- Backend: `npm test` from `backend` (mocked hosted dependencies).
- Frontend: `npm test`, `npm run build` and `npm run lint` from `frontend`.

The real CSV regression checks 22,722 sessions, maximum 1,804.9 seconds, sum 3,802,203.6 seconds and average 167.33578030103 seconds. It is skipped on machines without `C:/param`.

## Suggested demo queries and original-file checks

- `visitor interactions involving color perception`: source evidence, not an aggregate.
- `max dwell duration across all sessions`: 1,804.9 seconds.
- `total sessions`: 22,722.
- `total interactions across all sessions`: 1,329,443.
- `max interactions across all sessions`: 1,051 presses (the old 279 constant was incorrect).
- `min max average duration for Kinetic Bug`: 362 runs; min 0.02 seconds, max 93.492 seconds, average about 7.751655 seconds.
- `min max average duration for Kinetic Flower`: 410 runs; min 0.02 seconds, max 82.761 seconds, average about 5.563266 seconds.

These checks apply to the supplied original files. Updated published data must produce updated values rather than retain these benchmarks.

After deployment: authenticate, check `/api/ready`, run the known maximum query and the Kinetic Bug/date/count tests, and verify the website and `/v1/aggregate` agree. Local verification does not establish live-cloud correctness.
