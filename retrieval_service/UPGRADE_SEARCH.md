# Upgrade the hosted retrieval service — 3.1

## What changes, and what does not

| System | Impact |
| --- | --- |
| Supabase | Same state database and tables; no schema migration or data deletion. |
| Qdrant | Same param_v3 collections, dense/sparse vectors, IDs and namespace. Add keyword payload indexes and derived `_filter` metadata once. No embedding pass/re-ingestion. |
| Render/other Python host | Redeploy code and dependencies. The ONNX reranker downloads public weights and adds CPU/RAM/latency. Check host memory and timeout limits before rollout. |
| Website | Same endpoint, bearer key and existing query/top_k/scope fields. New optional filters. Ranking order changes; keep server order instead of sorting by RRF score. Support fewer/zero results. |
| Colab | No rerun or re-ingestion necessary. This bundle upgrades deployment; it does not replace the running notebook. |

No generative LLM is added. Dense+BM25 retrieve candidates; a MiniLM cross-encoder scores up to 64 fused candidates before returning top_k. Reranking/filter settings do not change index_id. Existing `score` and `score_type=rrf` remain unchanged for compatibility; `rerank_score` is a new field, and response `ranking.text` identifies the ordering method. Reranker scores are model-specific, not confidence probabilities.

## Safe rollout

1. Keep a Git commit/tag of the currently deployed version. Merge these retrieval service files into YOUR repository; do not overwrite unrelated website code. Do not upload `.env`, credentials, data or model caches. If your repo uses a service subdirectory, keep its existing Render root-directory setting and put these files there.

   The included GitHub Actions test workflow assumes the service is at the repository root. For a subdirectory, adjust its working-directory and pip cache dependency path, or merge the test steps into your existing CI.
2. Preserve current database URLs, dataset/model/chunk settings, application keys, collection prefix and PARAM_EXPECTED_INDEX_ID. New default settings are listed in `.env.example`; do not replace real values with placeholders. Build: `python -m pip install -r requirements.txt`.
3. First test in a staging service using the same index for read-only query comparisons. Use `PARAM_RERANK_ENABLED=false` if staging is not available until the metadata step below is complete. API start remains `python deploy.py api`; worker start remains `python deploy.py worker`.
4. From an environment with the SAME production settings, run `python deploy.py check`, then `python deploy.py backfill-filters` ONCE. This command intentionally writes only derived payload metadata in your configured dataset/index plus missing payload indexes during initialization. It does not regenerate or delete vectors. Keep the new API/worker version together; rerun backfill if an old worker wrote points during migration. The command is idempotent and reports progress. Filtered queries may miss older points until it completes—do not enable website filters until then.
5. Run `python deploy.py warmup` on the API host's persistent model cache. Set `PARAM_RERANK_ENABLED=true` and redeploy/start the API. Check actual memory, warm and cold latency, error rate, and the four test queries before switching traffic. A cache populated on a different host does not automatically populate this host.
6. Add filter controls to the website/backend when ready. Without filters, existing website requests still use hybrid search + reranking; there is NO automatic entity-to-filter inference.
7. Calibrate the cutoff below before enabling relevance pruning. Validate empty-result UI and rollback settings before handoff.

API startup creates missing payload indexes using your Qdrant key. Backfill also needs payload-write permission; normal queries do not. Existing snapshots and their storage location are unchanged. As before, an ingestion worker needs access to shared snapshots.

## Optional filters (AND across fields)

```json
{
  "query": "Kinetic Bug exhibit usage and session durations",
  "top_k": 5,
  "scope": "text",
  "filters": {
    "source": "Physical Exhibit.xlsx",
    "sheet": "Kinetic Bug",
    "exhibit": "Kinetic Bug"
  }
}
```

Any of those fields may be omitted. `source` is the exact stored relative filename/path; `sheet` is the exact worksheet title. `exhibit` compares case-insensitively with hyphens/underscores/spaces normalized, against exhibit_id, display_name, exhibit, and worksheet-title aliases. For example, `color-perception` and `color perception` match. General entity aliases are not inferred. PDFs without an exhibit attribute/worksheet do NOT pass an exhibit filter, even if their prose mentions that exhibit. Use a source filter to restrict the report-summary query instead:

```json
{"query":"Total interactions, sessions and engaged time", "top_k":5,
 "filters":{"source":"engagement-report-2026-09-15.pdf"}}
```

Filters are pushed into BOTH dense and lexical searches, alongside existing dataset/index/active constraints. Unknown filter keys return 422; filters cannot override dataset or security scope.

## Return fewer results: calibration, not a made-up score threshold

Reranking is on by default. `PARAM_RERANK_MIN_SCORE` is intentionally UNSET because no human-labeled evaluation set for your hosted data has been supplied. Without a cutoff, reranking improves ordering but does not claim to remove every irrelevant hit. Filters can already produce fewer/zero hits.

Create two JSONL files of real candidate query/text pairs with human labels. Include relevant and irrelevant examples, ambiguous near-matches (e.g. Kinetic Bug vs color-perception), unrelated queries, and all supported document types. Use at least 10 positive and 10 negative pairs in EACH split, with different queries between splits; more diverse labels give a more trustworthy estimate. Each line:

```json
{"query":"Kinetic Bug usage", "text":"paste a full actual candidate chunk here", "relevant":true}
```

Run `python calibrate_reranker.py calibration.jsonl validation.jsonl --precision 0.9`. It scores actual pairs, proposes a cutoff on the calibration split, and checks precision/recall on held-out queries. It does NOT invent labels or automatically change host settings. Only after reviewing both precision AND recall should you copy its candidate `PARAM_RERANK_MIN_SCORE` to Render's secret/environment settings. Recalibrate if model, scoring implementation or data domain changes. Scores may be negative; do not use RRF thresholds here. This pair-level check supplements, not replaces, end-to-end retrieval evaluation and recall@k testing.

Once configured, candidates below the reranker cutoff are omitted. top_k remains a maximum, and the API may return an empty list. The website should display "No sufficiently relevant evidence found" and the answer-writing LLM must not invent an answer from empty evidence.

## Rollback

Set PARAM_RERANK_ENABLED=false to restore RRF ordering without removing metadata or re-ingesting. Leave PARAM_RERANK_MIN_SCORE unset when disabling reranking. To roll back code, redeploy the prior commit; added `_filter` metadata is additive and ignored by old code. Keep the existing index settings. No database rollback is required.

Reference model API: https://qdrant.github.io/fastembed/
