"""CPU ONNX cross-encoder; scores relevance without generating an answer."""
import math
import threading


class Reranker:
    def __init__(self, settings):
        self.settings = settings
        self._model = None
        self._lock = threading.Lock()

    def model(self):
        if self._model is None:
            from fastembed.rerank.cross_encoder import TextCrossEncoder
            self._model = TextCrossEncoder(self.settings.rerank_model,
                cache_dir=self.settings.model_cache, threads=self.settings.threads,
                providers=['CPUExecutionProvider'])
        return self._model

    def scores(self, query, hits):
        if not hits:
            return []
        # Serialize model use/load to bound inference concurrency and memory.
        with self._lock:
            values = [float(v) for v in self.model().rerank(query,
                [p['text'] for p in hits], batch_size=self.settings.rerank_batch_size)]
        if len(values) != len(hits) or not all(math.isfinite(v) for v in values):
            raise RuntimeError('Reranker returned invalid scores')
        return values


def rerank_results(query, hits, reranker, threshold=None):
    scores = reranker.scores(query, hits)
    if len(scores) != len(hits) or not all(math.isfinite(v) for v in scores):
        raise RuntimeError('Reranker returned invalid scores')
    ranked = [{**hit, 'rerank_score': score} for hit, score in zip(hits, scores)
              if threshold is None or score >= threshold]
    return sorted(ranked, key=lambda p: (-p['rerank_score'], -p['score'], p['id']))
