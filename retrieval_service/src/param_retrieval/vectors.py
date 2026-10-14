"""Two production-store adapters behind the same narrow interface."""
import json
import re
import threading
from .filters import enrich_points, filter_metadata


class QdrantStore:
    def __init__(self, settings, sparse_encoder=None):
        from qdrant_client import QdrantClient
        self.settings = settings
        self._sparse = sparse_encoder
        self._sparse_lock = threading.Lock()
        self.client = QdrantClient(url=settings.vector_url, api_key=settings.vector_key or None,
                                   timeout=120) if settings.vector_url else QdrantClient(path=settings.local_vector_path)

    def name(self, kind):
        return f"{self.settings.collection_prefix}_{kind}"

    def ensure(self):
        from qdrant_client import models as m
        for kind, size in [("text", self.settings.text_dimension), ("image", self.settings.image_dimension)]:
            name = self.name(kind)
            if not self.client.collection_exists(name):
                sparse = {"bm25": m.SparseVectorParams(modifier=m.Modifier.IDF)} if kind == "text" else None
                self.client.create_collection(name, vectors_config=m.VectorParams(size=size, distance=m.Distance.COSINE),
                                              sparse_vectors_config=sparse)
            config = self.client.get_collection(name)
            if getattr(config.config.params.vectors, "size", None) != size:
                raise ValueError(f"{name}: embedding dimensions changed; use a new collection prefix")
            if kind == "text":
                sparse = (config.config.params.sparse_vectors or {}).get("bm25")
                if sparse is None or sparse.modifier != m.Modifier.IDF:
                    raise ValueError(f"{name}: BM25/IDF index missing; use param_v3 and reingest")
            if self.settings.vector_url:
                for field in ["dataset", "index_id", "doc_id", "revision", "active",
                              "_filter.source", "_filter.sheet", "_filter.exhibit"]:
                    if field not in (config.payload_schema or {}):
                        schema = m.PayloadSchemaType.BOOL if field == "active" else m.PayloadSchemaType.KEYWORD
                        self.client.create_payload_index(name, field, schema, wait=True)

    @staticmethod
    def revision_filter(revision):
        from qdrant_client import models as m
        return m.Filter(must=[m.FieldCondition(key="revision", match=m.MatchValue(value=revision))])

    def upsert(self, kind, points):
        from qdrant_client import models as m
        points = enrich_points(points)
        if kind == "text":
            sparse = list(self.sparse_encoder().passage_embed(
                [p["payload"]["text"] for p in points], batch_size=self.settings.batch_size))
            if len(sparse) != len(points):
                raise ValueError("Sparse embedding count does not match batch")
            points = [{**p, "vector": {"": p["vector"], "bm25": m.SparseVector(
                indices=v.indices.tolist(), values=v.values.tolist())}} for p, v in zip(points, sparse)]
        self.client.upsert(self.name(kind), points=[m.PointStruct(**p) for p in points], wait=True)

    def sparse_encoder(self):
        with self._sparse_lock:
            if self._sparse is None:
                from fastembed import SparseTextEmbedding
                self._sparse = SparseTextEmbedding(model_name="Qdrant/bm25",
                    cache_dir=self.settings.model_cache, threads=self.settings.threads)
            return self._sparse

    @staticmethod
    def scope_filter(dataset, index_id, filters=None):
        from qdrant_client import models as m
        values = {"dataset": dataset, "index_id": index_id, "active": True}
        values.update({"_filter." + k: v for k, v in (filters or {}).items()})
        return m.Filter(must=[m.FieldCondition(key=k, match=m.MatchValue(value=v)) for k, v in values.items()])

    def backfill_filters(self):
        from qdrant_client import models as m
        total = 0
        scope = m.Filter(must=[m.FieldCondition(key=k, match=m.MatchValue(value=v))
            for k, v in {'dataset': self.settings.dataset, 'index_id': self.settings.index_id}.items()])
        for kind in ('text', 'image'):
            offset = None
            while True:
                points, offset = self.client.scroll(self.name(kind), scroll_filter=scope,
                    limit=128, offset=offset, with_payload=True, with_vectors=False)
                operations = [m.SetPayloadOperation(set_payload=m.SetPayload(
                    payload={'_filter': filter_metadata(p.payload)}, points=[p.id])) for p in points]
                if operations:
                    self.client.batch_update_points(self.name(kind), operations, wait=True)
                total += len(points)
                print(f'Filter metadata: {total} points processed', flush=True)
                if offset is None:
                    break
        return total

    def lexical_search(self, query, dataset, index_id, limit, filters=None):
        from qdrant_client import models as m
        vector = next(iter(self.sparse_encoder().query_embed([query])))
        if len(vector.indices) == 0:
            return []
        scope = self.scope_filter(dataset, index_id, filters)
        points = self.client.query_points(self.name("text"), using="bm25",
            query=m.SparseVector(indices=vector.indices.tolist(), values=vector.values.tolist()),
            query_filter=scope, limit=limit, with_payload=True).points
        return [{"id": str(p.id), "score": p.score, **p.payload} for p in points]

    def activate(self, kind, revision):
        self.client.set_payload(self.name(kind), {"active": True}, self.revision_filter(revision), wait=True)

    def delete(self, kind, revision):
        from qdrant_client import models as m
        self.client.delete(self.name(kind), m.FilterSelector(filter=self.revision_filter(revision)), wait=True)

    def search(self, kind, vector, dataset, index_id, limit, filters=None):
        from qdrant_client import models as m
        scope = self.scope_filter(dataset, index_id, filters)
        points = self.client.query_points(self.name(kind), query=vector, query_filter=scope,
                                         limit=limit, with_payload=True).points
        return [{"id": str(p.id), "score": p.score, **p.payload} for p in points]

    def close(self):
        self.client.close()

    def iter_records(self, dataset, index_id):
        """Read complete text payloads, without embeddings or a top-k limit."""
        offset = None
        while True:
            points, offset = self.client.scroll(self.name("text"),
                scroll_filter=self.scope_filter(dataset, index_id), limit=256,
                offset=offset, with_payload=True, with_vectors=False)
            for point in points:
                yield {**point.payload, "id": str(point.id)}
            if offset is None:
                break


class PgVectorStore:
    def __init__(self, settings):
        from sqlalchemy import create_engine
        self.settings = settings
        self.engine = create_engine(settings.vector_url, pool_pre_ping=True)

    def name(self, kind):
        if kind not in {"text", "image"}:
            raise ValueError("Invalid vector kind")
        return f"{self.settings.collection_prefix}_{kind}"

    def ensure(self):
        from sqlalchemy import text
        # An administrator must install pgvector >= 0.8 before using this adapter.
        with self.engine.begin() as conn:
            for kind, size in [("text", self.settings.text_dimension), ("image", self.settings.image_dimension)]:
                table = self.name(kind)  # validated configuration; never user SQL
                conn.execute(text(f"CREATE TABLE IF NOT EXISTS {table} (id uuid PRIMARY KEY, "
                    f"embedding vector({size}) NOT NULL, payload jsonb NOT NULL, dataset text NOT NULL, "
                    "index_id text NOT NULL, revision uuid NOT NULL, active boolean NOT NULL)"))
                actual = conn.execute(text("SELECT format_type(a.atttypid, a.atttypmod) "
                    "FROM pg_attribute a WHERE a.attrelid = to_regclass(:table) AND a.attname='embedding'"),
                    {"table": table}).scalar_one()
                if actual != f"vector({size})":
                    raise ValueError("Embedding dimensions changed; use a new collection prefix")
                conn.execute(text(f"CREATE INDEX IF NOT EXISTS {table}_scope ON {table}(dataset,index_id,active)"))
                conn.execute(text(f"CREATE INDEX IF NOT EXISTS {table}_revision ON {table}(revision)"))
                conn.execute(text(f"CREATE INDEX IF NOT EXISTS {table}_ann ON {table} "
                                  "USING hnsw (embedding vector_cosine_ops)"))
                if kind == "text":
                    conn.execute(text(f"CREATE INDEX IF NOT EXISTS {table}_lexical ON {table} "
                        "USING gin (to_tsvector('simple', coalesce(payload->>'text','')))"))

    def upsert(self, kind, points):
        from sqlalchemy import text
        points = enrich_points(points)
        table = self.name(kind)
        sql = text(f"INSERT INTO {table} (id,embedding,payload,dataset,index_id,revision,active) "
            "VALUES (CAST(:id AS uuid),CAST(:vector AS vector),CAST(:payload AS jsonb),"
            ":dataset,:index_id,CAST(:revision AS uuid),:active) ON CONFLICT(id) DO UPDATE SET "
            "embedding=EXCLUDED.embedding,payload=EXCLUDED.payload,active=EXCLUDED.active")
        values = [{"id": p["id"], "vector": json.dumps(p["vector"]),
                   "payload": json.dumps(p["payload"]), **{key: p["payload"][key]
                    for key in ("dataset", "index_id", "revision", "active")}} for p in points]
        with self.engine.begin() as conn:
            conn.execute(sql, values)

    def activate(self, kind, revision):
        from sqlalchemy import text
        with self.engine.begin() as conn:
            conn.execute(text(f"UPDATE {self.name(kind)} SET active=true WHERE revision=CAST(:r AS uuid)"), {"r": revision})

    def delete(self, kind, revision):
        from sqlalchemy import text
        with self.engine.begin() as conn:
            conn.execute(text(f"DELETE FROM {self.name(kind)} WHERE revision=CAST(:r AS uuid)"), {"r": revision})

    @staticmethod
    def filter_sql(filters):
        clauses, params = [], {}
        for key, value in (filters or {}).items():
            if key not in {'source', 'sheet', 'exhibit'}:
                raise ValueError('Unsupported filter')
            params['filter_' + key] = json.dumps({key: [value] if key == 'exhibit' else value})
            clauses.append(f"payload->'_filter' @> CAST(:filter_{key} AS jsonb)")
        return ''.join(' AND ' + clause for clause in clauses), params

    def backfill_filters(self):
        from sqlalchemy import text
        total = 0
        for kind in ('text', 'image'):
            last = '00000000-0000-0000-0000-000000000000'
            while True:
                with self.engine.begin() as conn:
                    rows = conn.execute(text(f'SELECT id,payload FROM {self.name(kind)} '
                        'WHERE dataset=:d AND index_id=:i AND id>CAST(:last AS uuid) ORDER BY id LIMIT 128'),
                        {'d': self.settings.dataset, 'i': self.settings.index_id, 'last': last}).mappings().all()
                    for row in rows:
                        conn.execute(text(f"UPDATE {self.name(kind)} SET payload=jsonb_set(payload, '{{_filter}}', "
                            "CAST(:value AS jsonb)) WHERE id=CAST(:id AS uuid)"),
                            {'value': json.dumps(filter_metadata(row['payload'])), 'id': str(row['id'])})
                if not rows:
                    break
                last = str(rows[-1]['id'])
                total += len(rows)
                print(f'Filter metadata: {total} points processed', flush=True)
        return total

    def search(self, kind, vector, dataset, index_id, limit, filters=None):
        from sqlalchemy import text
        clause, params = self.filter_sql(filters)
        with self.engine.begin() as conn:
            conn.execute(text("SET LOCAL hnsw.iterative_scan = 'strict_order'"))
            rows = conn.execute(text(f"SELECT id,payload,1-(embedding <=> CAST(:v AS vector)) AS score "
                f"FROM {self.name(kind)} WHERE dataset=:d AND index_id=:i AND active=true {clause} "
                "ORDER BY embedding <=> CAST(:v AS vector) LIMIT :n"),
                {"v": json.dumps(vector), "d": dataset, "i": index_id, "n": limit, **params}).mappings()
            return [{**row["payload"], "id": str(row["id"]), "score": float(row["score"])} for row in rows]

    def close(self):
        self.engine.dispose()

    def lexical_search(self, query, dataset, index_id, limit, filters=None):
        """Postgres native lexical ranking (not BM25); fusion stays backend-independent."""
        from sqlalchemy import text
        words = re.findall(r"\w+", query, flags=re.UNICODE)
        if not words:
            return []
        document = "to_tsvector('simple', coalesce(payload->>'text',''))"
        clause, params = self.filter_sql(filters)
        with self.engine.begin() as conn:
            rows = conn.execute(text(f"SELECT id,payload,ts_rank_cd({document}, q) AS score "
                f"FROM {self.name('text')}, websearch_to_tsquery('simple', :query) q "
                f"WHERE dataset=:d AND index_id=:i AND active=true {clause} AND {document} @@ q "
                "ORDER BY score DESC, id LIMIT :n"),
                {"query": " OR ".join(words), "d": dataset, "i": index_id, "n": limit, **params}).mappings()
            return [{**row["payload"], "id": str(row["id"]), "score": float(row["score"])} for row in rows]

    def iter_records(self, dataset, index_id):
        from sqlalchemy import text
        last = "00000000-0000-0000-0000-000000000000"
        while True:
            with self.engine.connect() as conn:
                rows = conn.execute(text(f"SELECT id,payload FROM {self.name('text')} "
                    "WHERE dataset=:d AND index_id=:i AND active=true "
                    "AND id>CAST(:last AS uuid) ORDER BY id LIMIT 256"),
                    {"d": dataset, "i": index_id, "last": last}).mappings().all()
            if not rows:
                break
            for row in rows:
                yield {**row["payload"], "id": str(row["id"])}
            last = str(rows[-1]["id"])


VECTOR_ADAPTERS = {"qdrant": QdrantStore, "pgvector": PgVectorStore}
