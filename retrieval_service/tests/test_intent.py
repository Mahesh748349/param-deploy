import pytest

from param_retrieval.intent import calculation_intent
from param_retrieval.analytics import calculate
from test_analytics import point


@pytest.mark.parametrize("query,operations,metric", [
    ("How long did visitors usually spend at the color perception exhibit?", ["average"], "duration"),
    ("What was the longest visit to the Kinetic Bug exhibit?", ["max"], "duration"),
    ("What was the shortest visit to Kinetic Flower?", ["min"], "duration"),
    ("What is the typical visit duration for color perception?", ["average"], "duration"),
    ("How much time did visitors spend altogether at color perception?", ["sum"], "duration"),
    ("How many visits were recorded at color perception?", ["count"], "sessions"),
    ("What were the average interactions per session?", ["average"], "presses"),
    ("How many times were buttons pressed in all?", ["sum"], "presses"),
    ("How many interactions were recorded?", ["sum"], "presses"),
    ("What was the maximum number of presses?", ["max"], "presses"),
    ("How many recorded runs did Kinetic Bug have?", ["count"], "runs"),
])
def test_natural_query_intents(query, operations, metric):
    assert calculation_intent(query) == (operations, metric)


def test_natural_queries_use_complete_exhibit_scope():
    rows = [point(20, "color-perception"), point(40, "color-perception", locator="row:3"),
            point(900, "color-perception-jayanagar", locator="row:4")]
    result = calculate("How long did visitors usually spend at the color perception exhibit?", rows)
    assert result["value"] == 30
    assert result["records"] == 2
    assert "average" in result["interpretation"]
    assert calculate("How much time did visitors spend altogether at color perception?", rows)["value"] == 60
    assert calculate("How many visits were recorded at color perception?", rows)["value"] == 2


def test_longest_workbook_visit_means_run_duration():
    rows = [{"doc_id": "book", "revision": "r", "source": "Physical Exhibit.xlsx",
             "locator": f"sheet:Kinetic Bug|row:{index}|char:0", "attributes": {"Total Seconds": value}}
            for index, value in enumerate([0.02, 93.492], 2)]
    result = calculate("What was the longest visit to the Kinetic Bug exhibit?", rows)
    assert result["value"] == 93.492 and result["records"] == 2


def test_ambiguous_duration_and_distinct_people_requests_are_not_guessed():
    with pytest.raises(ValueError, match="specify"):
        calculation_intent("How long did visitors spend at the exhibit?")
    with pytest.raises(ValueError, match="Distinct visitor"):
        calculation_intent("How many people used the exhibit?")
    with pytest.raises(ValueError, match="comparisons"):
        calculation_intent("Which exhibit had the highest total interactions?")


def test_formula_preserves_decimal_total_without_scientific_notation():
    result = calculate("average sum duration", [point(491304.2)])
    assert result["metrics"][0]["formula"] == "491,304.2 / 1"
    assert "491,304.2" in result["answer"]
    assert "e+" not in result["answer"]


def test_natural_interaction_count_sums_counts_rather_than_rows():
    result = calculate("How many interactions were recorded?", [point(10, presses=100), point(20, locator="row:3", presses=200)])
    assert result["value"] == 300 and result["records"] == 2
