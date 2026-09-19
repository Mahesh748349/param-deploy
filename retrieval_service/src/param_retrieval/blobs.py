import hashlib
import shutil
import tempfile
from contextlib import contextmanager
from pathlib import Path
from urllib.parse import urlsplit


class Blobs:
    """Immutable content-addressed snapshots, on disk/Drive or S3-compatible storage."""
    def __init__(self, root: str):
        self.remote = root.startswith("s3://")
        if self.remote:
            import boto3
            parsed = urlsplit(root)
            self.bucket, self.prefix = parsed.netloc, parsed.path.strip("/")
            self.client = boto3.client("s3")  # IAM/standard AWS environment credentials
        else:
            self.root = Path(root)
            self.root.mkdir(parents=True, exist_ok=True)

    def key(self, digest):
        return "/".join(x for x in [self.prefix, digest] if x)

    def put(self, source: Path, max_bytes: int) -> str:
        # Hash the very bytes copied into a snapshot, not a later read of a mutable file.
        before = source.stat()
        with tempfile.TemporaryDirectory() as directory:
            snapshot = Path(directory) / "snapshot"
            digest, size = hashlib.sha256(), 0
            with source.open("rb") as src, snapshot.open("wb") as dst:
                while block := src.read(1024 * 1024):
                    size += len(block)
                    if size > max_bytes:
                        raise ValueError("File exceeds configured upload limit")
                    digest.update(block)
                    dst.write(block)
            after = source.stat()
            if (before.st_size, before.st_mtime_ns) != (after.st_size, after.st_mtime_ns):
                raise ValueError("Source changed during snapshot; retry when the write completes")
            key = digest.hexdigest()
            if self.remote:
                from botocore.exceptions import ClientError
                try:
                    self.client.head_object(Bucket=self.bucket, Key=self.key(key))
                except ClientError as exc:
                    if str(exc.response["Error"]["Code"]) not in {"404", "NoSuchKey", "NotFound"}:
                        raise
                    self.client.upload_file(str(snapshot), self.bucket, self.key(key))
            elif not (self.root / key).exists():
                with tempfile.NamedTemporaryFile(dir=self.root, delete=False) as target:
                    temporary = Path(target.name)
                try:
                    shutil.copyfile(snapshot, temporary)
                    temporary.replace(self.root / key)
                finally:
                    temporary.unlink(missing_ok=True)
            return key

    @contextmanager
    def materialize(self, digest: str, suffix: str):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / ("source" + suffix)
            if self.remote:
                self.client.download_file(self.bucket, self.key(digest), str(target))
            else:
                shutil.copyfile(self.root / digest, target)
            yield target
