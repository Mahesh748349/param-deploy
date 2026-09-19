import argparse
import logging
import time

from .config import Settings
from .service import Service


def main():
    parser = argparse.ArgumentParser(description="Param retrieval: ordinary Python processes, no Docker")
    parser.add_argument("command", choices=["init", "scan", "worker", "watch", "status", "api"])
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    if args.command == "api":
        import uvicorn
        uvicorn.run("param_retrieval.api:create_app", factory=True, host="0.0.0.0", port=args.port)
        return
    service = Service(Settings())
    try:
        if args.command == "init":
            service.initialize()
        elif args.command == "status":
            print(service.state.status(service.settings.index_id))
        elif args.command == "scan":
            print("Sources registered:", len(service.scan(service.settings.source_root)))
        elif args.command == "watch":
            if not service.settings.source_root:
                raise ValueError("PARAM_SOURCE_ROOT is required for the watcher")
            while True:
                try:
                    service.scan(service.settings.source_root)
                except Exception:
                    logging.exception("Scan failed; existing indexed data remains available")
                time.sleep(service.settings.scan_seconds)
        else:
            while True:
                try:
                    worked = service.run_one()
                    service.state.collect(service.store, service.settings.index_id)
                    if not worked:
                        time.sleep(1)
                except Exception:
                    logging.exception("Worker storage failure; retrying")
                    time.sleep(5)
    except KeyboardInterrupt:
        pass
    finally:
        service.close()


if __name__ == "__main__":
    main()
