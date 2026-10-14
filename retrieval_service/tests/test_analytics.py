"""Calculation correctness, scope and publication tests (no model downloads)."""
import asyncio
import csv
from pathlib import Path

import httpx
import pytest

from param_retrieval.analytics import calculate
from param_retrieval.api import create_app
from test_pipeline import service


def point(value=10, exhibit="Bug", source="sessions.csv", locator="row:2|char:0", **attributes):
    return {"id": locator, "doc_id": source, "revision": "revision", "source": source,
            "locator": locator, "attributes": {"exhibit_id": exhibit, "duration_s": value,
                "started_at": "2026-09-10T12:00:00+00:00", **attributes}}


def test_all_operations_and_chunk_deduplication():
    rows = [point(0), point(20, locator="row:3|char:0"), point(20, locator="row:3|char:900")]
    result = calculate("min max average sum dwell duration across all sessions", rows)
    assert result["records"] == 2
    assert {item["operation"]: item["value"] for item in result["metrics"]} == {
        "min": 0, "max": 20, "average": 10, "sum": 20}
    assert result["metrics"][0]["exhibits"] == ["Bug"]


def test_longest_entity_match_and_unknown_scope():
    rows = [point(10, "color-perception"), point(100, "color-perception-jayanagar", locator="row:3")]
    assert calculate("average duration for color-perception-jayanagar", rows)["value"] == 100
    with pytest.raises(ValueError, match="scope"):
        calculate("maximum duration for Missing", rows)
    assert calculate("maximum duration", rows, {"exhibit": "Missing"})["records"] == 0


def test_workbook_sheet_names_and_explicit_filters():
    rows = [point(500, "Other")]
    rows.append({"id": "sheet", "doc_id": "book", "revision": "revision",
        "source": "Physical Exhibit.xlsx", "locator": "sheet:Kinetic Bug|row:2|char:0",
        "attributes": {"Total Seconds": 30, "Start Time": "2026-09-10T12:00:00"}})
    assert calculate("maximum session duration for Kinetic Bug", rows)["value"] == 30
    result = calculate("average duration", rows, {"source": "Physical Exhibit.xlsx", "sheet": "Kinetic Bug"})
    assert result["value"] == 30 and result["exhibits"] == []
    assert result["scope"]["sheet"] == "Kinetic Bug"


def test_session_counts_and_date_scope():
    rows = [point(10), point(20, locator="row:3", started_at="2026-08-10T12:00:00Z")]
    assert calculate("total sessions", rows)["value"] == 2
    assert calculate("count sessions in September 2026", rows)["value"] == 1
    assert calculate("average duration from 2026-09-01 to 2026-09-30", rows)["value"] == 10
    assert calculate("sum duration", rows, {"date_from": "2026-09-01"})["value"] == 10
    assert calculate("sum duration in September 2026", rows, {"date_from": "2026-09-15"})["records"] == 0
    with pytest.raises(ValueError):
        calculate("average duration last week", rows)
    with pytest.raises(ValueError):
        calculate("average duration in 2026", rows)
    with pytest.raises(ValueError):
        calculate("average duration in September", rows)
    with pytest.raises(ValueError):
        calculate("average duration on Mondays", rows)
    with pytest.raises(ValueError):
        calculate("average duration in Whitefield", rows)


def test_missing_dates_and_unsupported_queries_fail_explicitly():
    with pytest.raises(ValueError, match="invalid start dates"):
        calculate("average duration in September 2026", [point(started_at="invalid")])
    with pytest.raises(ValueError, match="Supported calculations"):
        calculate("median dwell duration", [point()])
    with pytest.raises(ValueError):
        calculate("average duration greater than 10 seconds", [point()])
    with pytest.raises(ValueError, match="one metric"):
        calculate("max duration and interactions", [point()])


def test_numeric_units_invalid_values_and_group_totals():
    rows = [point("nan", presses=2), point(True, locator="row:3", presses=4)]
    assert calculate("sum duration", rows)["records"] == 0
    result = calculate("total interactions by exhibit", rows)
    assert result["value"] == 6
    assert result["groups"][0]["metrics"]["sum"] == 6
    rows = [point("", duration_min=2)]
    assert calculate("max dwell duration", rows)["value"] == 120


def test_maximum_matches_all_tied_exhibits_and_record_limit():
    rows = [point(10, "A"), point(10, "B", locator="row:3")]
    assert calculate("max duration", rows)["exhibits"] == ["A", "B"]
    with pytest.raises(ValueError, match="limit"):
        calculate("max duration", rows, max_records=1)


def test_aggregates_use_published_vectors_without_snapshot_access(service):
    service.submit_record("sessions/a", {"exhibit": "Bug", "duration_s": 10}, 1)
    service.run_one()
    service.submit_record("sessions/a", {"exhibit": "Bug", "duration_s": 20}, 2)
    assert service.aggregate("max duration")["value"] == 10
    service.run_one()
    service.blobs.materialize = lambda *args: pytest.fail("Analytics must not read snapshot files")
    assert service.aggregate("sum duration")["value"] == 20
    assert service.aggregate("count sessions")["value"] == 1
    service.remove("sessions/a", 3)
    service.run_one()
    assert service.aggregate("sum duration")["records"] == 0


def test_publication_change_returns_retry_error(service, monkeypatch):
    service.submit_record("sessions/a", {"duration_s": 1}, 1)
    service.run_one()
    original = service.state.active_sources
    calls = []
    def changing(*args):
        calls.append(1)
        return original(*args) if len(calls) == 1 else []
    monkeypatch.setattr(service.state, "active_sources", changing)
    with pytest.raises(RuntimeError, match="retry"):
        service.aggregate("sum duration")


def test_aggregate_http_auth_and_validation(service):
    async def check():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=create_app(service)), base_url="http://test") as client:
            assert (await client.post("/v1/aggregate", json={"query": "sum duration"})).status_code == 401
            headers = {"Authorization": "Bearer read-test"}
            assert (await client.post("/v1/aggregate", headers=headers,
                json={"query": "sum duration", "filters": {"date_from": "bad-date"}})).status_code == 422
            response = await client.post("/v1/aggregate", headers=headers, json={"query": "sum duration"})
            assert response.status_code == 200 and response.json()["exact"] is False
    asyncio.run(check())


def test_real_session_csv_ground_truth():
    path = Path("C:/param/engagement-sessions-2026-09-15.csv")
    if not path.exists():
        pytest.skip("Optional original dataset not available")
    with path.open(encoding="utf-8-sig", newline="") as handle:
        rows = [{**point(source=path.name, locator=f"row:{index}"), "attributes": row}
                for index, row in enumerate(csv.DictReader(handle), 2)]
    result = calculate("min max average sum dwell duration across all sessions", rows)
    values = {item["operation"]: item["value"] for item in result["metrics"]}
    assert result["records"] == 22722
    assert values == pytest.approx({"min": 0, "max": 1804.9, "average": 167.33578030103, "sum": 3802203.6})
    assert calculate("total sessions", rows)["value"] == 22722
    assert calculate("average duration for color-perception", rows)["value"] == pytest.approx(406.708774834437)
    assert calculate("max interactions across all sessions", rows)["value"] == 1051
    assert calculate("total interactions across all sessions", rows)["value"] == 1329443


def test_count_units_unique_groups_and_source_in_query():
    rows = [point(10), point(20, locator="row:3")]
    assert calculate("count duration", rows)["metrics"][0]["unit"] == "records"
    assert calculate("count unique exhibits by exhibit", rows)["groups"][0]["metrics"]["count"] == 1
    assert calculate("max duration for sessions.csv", rows)["value"] == 20
    dated = [point(20, source="engagement-sessions-2026-09-15.csv")]
    assert calculate("max duration for engagement-sessions-2026-09-15.csv", dated)["value"] == 20
