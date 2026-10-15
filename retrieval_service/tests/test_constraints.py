import pytest
from param_retrieval.constraints import validate_record_query
from test_pipeline import service


@pytest.mark.parametrize('query', [
    'Show me Kinetic Flower usage records from September 12, 2026.',
    'Kinetic Flower records on 2026-09-12', 'visits on 12/09/2026',
    'visits yesterday', 'usage last week', 'sessions from 2026',
    'visits in Sep', 'records on 12 September 2026',
])
def test_record_dates_are_never_silently_ignored(query):
    with pytest.raises(ValueError, match='Date-filtered record search is not supported'):
        validate_record_query(query)


@pytest.mark.parametrize('query', [
    'Show Kinetic Flower records', 'May I see Kinetic Bug visits?',
    'engagement-report-2026-09-15.pdf',
])
def test_normal_queries_and_dated_filenames_remain_searchable(query):
    validate_record_query(query)


def test_service_refuses_dates_before_embedding_or_retrieving(service):
    with pytest.raises(ValueError, match='Date-filtered record search'):
        service.retrieve('Kinetic Flower on September 12, 2026')
