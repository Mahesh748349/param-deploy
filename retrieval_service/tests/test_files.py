from pathlib import Path

from param_retrieval import Settings
from param_retrieval.parsers import parse


def test_parses_all_real_tabular_rows_and_pdf_without_upload():
    import pytest
    root = Path("C:/param")
    if not root.exists():
        pytest.skip("Original sample dataset is not available on this host")
    cfg = Settings()
    expected = {"engagement-sessions-2026-09-15.csv": 22722,
                "results (1).csv": 3526, "Physical Exhibit.xlsx": 772}
    for filename, row_count in expected.items():
        chunks = parse(root / filename, Path(filename).suffix, cfg)
        count = 0
        for chunk in chunks:
            count += 1
            assert not any(k in chunk.attributes for k in ["userName", "userId", "eventId", "sessionId"])
        assert count == row_count
    chunks = list(parse(root / "engagement-report-2026-09-15.pdf", ".pdf", cfg))
    assert len(chunks) >= 2
    assert any("page:2" in chunk.locator for chunk in chunks)
