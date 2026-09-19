"""Local encoders only: no generative LLM and no paid inference calls."""
import hashlib
import threading

import numpy as np


class FastEmbedder:
    def __init__(self, settings):
        self.settings, self.models = settings, {}
        self.lock = threading.Lock()

    def model(self, role):
        with self.lock:
            if role not in self.models:
                from fastembed import ImageEmbedding, TextEmbedding
                cls = ImageEmbedding if role == "image" else TextEmbedding
                name = {"text": self.settings.text_model, "image": self.settings.image_model,
                        "image_query": self.settings.image_query_model}[role]
                self.models[role] = cls(model_name=name, cache_dir=self.settings.model_cache,
                    threads=self.settings.threads, providers=["CPUExecutionProvider"])
            return self.models[role]

    def documents(self, kind, chunks):
        if kind == "image":
            from PIL import Image, ImageOps
            images = []
            for chunk in chunks:
                with Image.open(chunk.image) as image:
                    copy = ImageOps.exif_transpose(image).convert("RGB")
                    copy.thumbnail((1024, 1024))
                    images.append(copy)
            vectors = self.model(kind).embed(images, batch_size=self.settings.image_batch_size)
        else:
            vectors = self.model(kind).passage_embed([c.text for c in chunks], batch_size=self.settings.batch_size)
        return [v.tolist() for v in vectors]

    def query(self, kind, query):
        role = "text" if kind == "text" else "image_query"
        return next(iter(self.model(role).query_embed([query]))).tolist()


class TestEmbedder:
    """Deterministic fake for lifecycle tests; never selected by production configuration."""
    def __init__(self, size=8):
        self.size = size

    def query(self, kind, query):
        vector = np.zeros(self.size, dtype=float)
        for word in query.lower().split():
            vector[int(hashlib.sha256(word.encode()).hexdigest(), 16) % self.size] += 1
        vector[0] += 0.01
        return (vector / np.linalg.norm(vector)).tolist()

    def documents(self, kind, chunks):
        return [self.query(kind, c.text or "image") for c in chunks]
