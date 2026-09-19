import os
import pytest

from test_pipeline import service
from param_retrieval.fusion import reciprocal_rank_fusion


def test_rrf_deduplicates_and_uses_ranks_not_raw_scores():
    hits = reciprocal_rank_fusion({
        'dense': [{'id': 'a', 'score': 0.99}, {'id': 'b', 'score': 0.4}],
        'lexical': [{'id': 'b', 'score': 700}, {'id': 'c', 'score': 200}],
    })
    assert [p['id'] for p in hits] == ['b', 'a', 'c']
    assert hits[0]['score'] == pytest.approx(1 / 62 + 1 / 61)
    assert hits[0]['ranks'] == {'dense': 2, 'lexical': 1}


def test_lexical_only_candidate_reaches_final_results(service, monkeypatch):
    service.submit_record('record/1', {'value': 'ZXQ781'}, 1)
    service.run_one()
    monkeypatch.setattr(service.store, 'search', lambda *args: [])
    hit = service.retrieve('ZXQ781')['text_results'][0]
    assert hit['attributes']['value'] == 'ZXQ781'
    assert hit['ranks'] == {'lexical': 1}
    assert hit['score_type'] == 'rrf'


def test_no_keyword_overlap_still_returns_dense_results(service):
    service.submit_record('item', {'value': 'flower'}, 1)
    service.run_one()
    hit = service.retrieve('unseenword')['text_results'][0]
    assert hit['ranks'] == {'dense': 1}


def test_both_branches_merge_same_point_once(service):
    service.submit_record('item', {'value': 'flower'}, 1)
    service.run_one()
    hits = service.retrieve('flower')['text_results']
    assert len(hits) == 1
    assert hits[0]['ranks'] == {'dense': 1, 'lexical': 1}
    assert hits[0]['score'] == pytest.approx(2 / 61)


def test_lexical_filters_scope_and_retired_versions_before_gc(service, monkeypatch):
    service.submit_record('item', {'value': 'oldtoken'}, 1)
    service.run_one()
    service.submit_record('item', {'value': 'newtoken'}, 2)
    service.run_one()
    cfg = service.settings
    # Old sparse vectors can exist until GC, but cannot appear in final results.
    assert service.store.lexical_search('oldtoken', cfg.dataset, cfg.index_id, 10)
    assert not service.store.lexical_search('newtoken', 'other-dataset', cfg.index_id, 10)
    assert not service.store.lexical_search('newtoken', cfg.dataset, 'other-index', 10)
    monkeypatch.setattr(service.store, 'search', lambda *args: [])
    assert service.retrieve('oldtoken')['text_results'] == []
    assert service.retrieve('newtoken')['text_results']
    service.remove('item', sequence=3)
    service.run_one()
    assert service.retrieve('newtoken')['text_results'] == []
    service.state.collect(service.store, cfg.index_id)
    assert not service.store.lexical_search('newtoken', cfg.dataset, cfg.index_id, 10)


def test_sparse_failure_does_not_publish_partial_update(service, monkeypatch):
    first = service.submit_record('item', {'value': 'oldtoken'}, 1)
    service.run_one()
    def fail(*args, **kwargs):
        raise RuntimeError('sparse encoding failure')
    monkeypatch.setattr(service.store.sparse_encoder(), 'passage_embed', fail)
    job = service.submit_record('item', {'value': 'newtoken'}, 2)
    service.run_one()
    assert service.state.job(job['id'])['status'] == 'queued'
    assert service.state.active({first['doc_id']})[first['doc_id']] == service.state.job(first['id'])['token']


def test_legacy_dense_collection_rejected(service):
    from qdrant_client import models as m
    service.store.client.delete_collection(service.store.name('text'))
    service.store.client.create_collection(service.store.name('text'),
        vectors_config=m.VectorParams(size=8, distance=m.Distance.COSINE))
    with pytest.raises(ValueError, match='BM25/IDF'):
        service.store.ensure()


def test_expands_lexical_arm_even_when_dense_has_enough(service, monkeypatch):
    service.submit_record('item', {'value': 'flower'}, 1)
    service.run_one()
    cfg = service.settings
    hit = service.store.lexical_search('flower', cfg.dataset, cfg.index_id, 1)[0]
    retired = [{**hit, 'id': f'retired-{i}', 'revision': 'retired'} for i in range(64)]
    limits = []
    def lexical(query, dataset, index_id, limit):
        limits.append(limit)
        return (retired + [hit])[:limit]
    monkeypatch.setattr(service.store, 'lexical_search', lexical)
    result = service.retrieve('flower', top_k=1)['text_results'][0]
    assert limits == [64, 128]
    assert result['ranks'] == {'dense': 1, 'lexical': 1}


@pytest.mark.skipif(os.getenv('PARAM_TEST_REAL_BM25') != '1', reason='Opt-in: downloads public BM25 tokenizer assets')
def test_real_bm25_with_local_qdrant_and_publication(service, monkeypatch):
    from fastembed import SparseTextEmbedding
    service.store._sparse = SparseTextEmbedding('Qdrant/bm25',
        cache_dir=os.getenv('PARAM_TEST_BM25_CACHE', service.settings.model_cache))
    service.submit_record('garden', {'description': 'kinetic flower mechanism'}, 1)
    service.run_one()
    service.submit_record('space', {'description': 'rocket spacecraft mission'}, 1)
    service.run_one()
    hit = service.retrieve('flower')['text_results'][0]
    assert hit['source'] == 'garden' and hit['ranks']['lexical'] == 1
    monkeypatch.setattr(service.store, 'search', lambda *args: [])
    assert service.retrieve('rocket')['text_results'][0]['source'] == 'space'
    assert not service.retrieve('!!!')['text_results']
    service.submit_record('space', {'description': 'butterfly habitat'}, 2)
    service.run_one()
    assert not service.retrieve('rocket')['text_results']
    assert service.retrieve('butterfly')['text_results']
    service.remove('space', sequence=3)
    service.run_one()
    assert not service.retrieve('butterfly')['text_results']
