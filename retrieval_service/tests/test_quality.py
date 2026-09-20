import os
import pytest
from fastapi.testclient import TestClient
from test_pipeline import service
from param_retrieval.api import create_app
from param_retrieval.filters import filter_metadata, SearchFilters
from param_retrieval.reranking import rerank_results


def seed(service):
    service.submit_record('bug.json', {'exhibit': 'Kinetic Bug', 'value': 'usage duration'}, 1)
    service.run_one()
    service.submit_record('color.json', {'exhibit_id': 'color-perception', 'value': 'usage duration'}, 1)
    service.run_one()


def test_filters_restrict_both_arms(service):
    seed(service)
    cfg = service.settings
    filters = SearchFilters(exhibit='kinetic-bug', source='bug.json').values()
    args = (cfg.dataset, cfg.index_id, 10)
    dense = service.store.search('text', service.embedder.query('text', 'usage'), *args, filters=filters)
    lexical = service.store.lexical_search('usage', *args, filters=filters)
    assert len(dense) == len(lexical) == 1
    assert dense[0]['source'] == lexical[0]['source'] == 'bug.json'
    assert not service.retrieve('usage', filters={'exhibit': 'missing'})['text_results']


def test_sheet_filters_on_legacy_points_after_backfill(service):
    from openpyxl import Workbook
    import tempfile
    from pathlib import Path
    with tempfile.TemporaryDirectory() as folder:
        path = Path(folder) / 'sheets.xlsx'
        book = Workbook()
        book.active.title = 'Kinetic Bug'
        for sheet in [book.active, book.create_sheet('Kinetic Flower')]:
            sheet.append(['duration'])
            sheet.append([10])
        book.save(path)
        service.submit(path)
        service.run_one()
    before = service.retrieve('duration')['text_results']
    ids = [p['id'] for p in before]
    service.store.client.delete_payload(service.store.name('text'), ['_filter'], ids, wait=True)
    assert not service.retrieve('duration', filters={'sheet': 'Kinetic Bug'})['text_results']
    assert service.store.backfill_filters() == 2
    assert service.store.backfill_filters() == 2  # idempotent and no vector replacement
    after = service.retrieve('duration', filters={'sheet': 'Kinetic Bug'})['text_results']
    assert len(after) == 1 and 'sheet:Kinetic Bug|' in after[0]['locator']
    assert after[0]['id'] in ids


class FakeReranker:
    def scores(self, query, hits):
        return [3.0 if p['source'] == 'bug.json' else -4.0 for p in hits]


def test_reranking_cutoff_returns_fewer_or_zero_and_preserves_rrf(service):
    seed(service)
    old = {p['id']: p['score'] for p in service.retrieve('usage')['text_results']}
    service.reranker = FakeReranker()
    service.settings.rerank_min_score = 1.0
    result = service.retrieve('usage', top_k=5)
    assert len(result['text_results']) == 1
    hit = result['text_results'][0]
    assert hit['source'] == 'bug.json' and hit['rerank_score'] == 3.0
    assert hit['score'] == old[hit['id']] and hit['score_type'] == 'rrf'
    service.settings.rerank_min_score = 4.0
    assert service.retrieve('usage')['text_results'] == []


def test_api_optional_filters_and_invalid_fields(service):
    seed(service)
    client = TestClient(create_app(service))
    headers = {'Authorization': 'Bearer read-test'}
    assert len(client.post('/v1/retrieve', headers=headers, json={'query': 'usage'}).json()['text_results']) == 2
    response = client.post('/v1/retrieve', headers=headers,
        json={'query': 'usage', 'filters': {'exhibit': 'Kinetic Bug'}})
    assert response.status_code == 200
    assert [p['source'] for p in response.json()['text_results']] == ['bug.json']
    assert client.post('/v1/retrieve', headers=headers,
        json={'query': 'usage', 'filters': {'dataset': 'other'}}).status_code == 422


def test_query_settings_do_not_change_index_identity(service):
    changed = service.settings.model_copy(update={'rerank_enabled': True, 'rerank_min_score': 2.1,
                                                 'rerank_candidates': 100})
    assert changed.index_id == service.settings.index_id


def test_nonfinite_scores_rejected():
    class Broken:
        def scores(self, query, hits):
            return [float('nan')]
    with pytest.raises(RuntimeError):
        rerank_results('test', [{'text': 'test'}], Broken())


@pytest.mark.skipif(os.getenv('PARAM_TEST_REAL_RERANKER') != '1', reason='Opt-in public reranker download')
def test_real_reranker_prefers_explicit_exhibit(service):
    from param_retrieval.reranking import Reranker
    service.settings.model_cache = os.environ.get('PARAM_TEST_RERANK_CACHE', service.settings.model_cache)
    ranker = Reranker(service.settings)
    values = ranker.scores('Kinetic Bug exhibit usage duration', [
        {'text': 'Source Physical Exhibit.xlsx sheet:Kinetic Bug duration 93 seconds'},
        {'text': 'Source engagement-sessions.csv exhibit_id color-perception duration 15 seconds'}])
    assert len(values) == 2 and values[0] > values[1]
