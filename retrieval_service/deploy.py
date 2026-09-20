"""Plain-Python deployment entry point; no Docker required."""
import argparse
import logging
import os
import time

from dotenv import load_dotenv
from param_retrieval import Service, Settings


def main():
    load_dotenv()  # Hosting environment variables take precedence over local .env.
    parser = argparse.ArgumentParser()
    parser.add_argument('command', choices=['check', 'api', 'worker', 'warmup', 'backfill-filters'])
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
    cfg = Settings()
    expected = os.getenv('PARAM_EXPECTED_INDEX_ID', '').strip()
    if not expected or expected != cfg.index_id:
        raise SystemExit(f'Index mismatch: calculated {cfg.index_id}. Set PARAM_EXPECTED_INDEX_ID '
                         'to the index_id printed in Colab and copy the exact notebook settings.')
    if not cfg.state_url.startswith('postgresql+psycopg://') or not cfg.vector_url:
        raise SystemExit('Set production PostgreSQL and vector database URLs.')
    if not cfg.read_key or not cfg.ingest_key or cfg.read_key == cfg.ingest_key:
        raise SystemExit('Set distinct retrieval and ingestion keys.')
    svc = Service(cfg)
    try:
        svc.initialize()
        print('Index:', cfg.index_id, 'Jobs:', svc.state.status(cfg.index_id), flush=True)
        if args.command == 'api':
            import uvicorn
            from param_retrieval.api import create_app
            uvicorn.run(create_app(svc), host='0.0.0.0', port=int(os.getenv('PORT', '8000')))
        elif args.command == 'warmup':
            svc.embedder.model('text')
            if cfg.vector_backend == 'qdrant':
                svc.store.sparse_encoder()
            if svc.reranker:
                svc.reranker.scores('warmup', [{'text': 'warmup passage'}])
            if os.getenv('PARAM_WARM_IMAGES', 'false').lower() == 'true':
                svc.embedder.model('image')
                svc.embedder.model('image_query')
            print('Model warmup complete.', flush=True)
        elif args.command == 'backfill-filters':
            print('Backfilled:', svc.store.backfill_filters())
        elif args.command == 'worker':
            while True:
                try:
                    worked = svc.run_one()
                    svc.state.collect(svc.store, cfg.index_id)
                    if not worked:
                        time.sleep(1)
                except Exception:
                    logging.exception('Worker failure; retrying in five seconds')
                    time.sleep(5)
    except KeyboardInterrupt:
        pass
    finally:
        svc.close()


if __name__ == '__main__':
    main()
