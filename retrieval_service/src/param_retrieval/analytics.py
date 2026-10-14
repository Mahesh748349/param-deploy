"""Deterministic telemetry calculations over complete, published structured rows."""
import calendar
import math
import re
from datetime import date, datetime

from pydantic import model_validator

from .filters import SearchFilters, filter_metadata, normalize_exhibit
from .intent import calculation_intent


class AggregateFilters(SearchFilters):
    date_from: date | None = None
    date_to: date | None = None

    @model_validator(mode="after")
    def ordered_dates(self):
        if self.date_from and self.date_to and self.date_from > self.date_to:
            raise ValueError("date_from must not be after date_to")
        return self


DURATION_FIELDS = {"durations": 1, "duration": 1, "durationsseconds": 1,
    "durationseconds": 1, "totalseconds": 1, "dwell": 1, "dwellseconds": 1,
    "dwells": 1, "durationmin": 60, "durationminutes": 60, "dwellminutes": 60,
    "durationhours": 3600, "sessionduration": 1}
PRESS_FIELDS = {"presses", "press", "interactions", "interactioncount", "buttonpresses"}


def field_key(value):
    return re.sub(r"[^a-z0-9]", "", value.casefold())


def numeric(value):
    if isinstance(value, bool) or value is None:
        return None
    try:
        result = float(str(value).replace(",", "").strip())
        return result if math.isfinite(result) else None
    except (ValueError, TypeError):
        return None


def row_metrics(attributes):
    result = {}
    # Prefer the explicitly named duration_s when aliases coexist in one row.
    for key in sorted(attributes, key=lambda key: field_key(key) != "durations"):
        name, value = field_key(key), numeric(attributes[key])
        if value is None:
            continue
        if name in DURATION_FIELDS and "duration" not in result:
            result["duration"] = value * DURATION_FIELDS[name]
        if name in PRESS_FIELDS and "presses" not in result:
            result["presses"] = value
    return result


def row_date(attributes):
    normalized = {field_key(key): value for key, value in attributes.items()}
    for key in ("startedat", "starttime", "timestamp", "date", "recordedat"):
        if normalized.get(key):
            try:
                return datetime.fromisoformat(str(normalized[key]).replace("Z", "+00:00")).date()
            except ValueError:
                continue
    return None


def date_bounds(query, filters):
    # A date in a filename identifies a source, not a requested date restriction.
    query = re.sub(r"\S+\.(?:csv|xlsx|jsonl?|pdf|docx|txt)\b", "", query, flags=re.I)
    dates = re.findall(r"\b\d{4}-\d{2}-\d{2}\b", query)
    if len(dates) > 2:
        raise ValueError("Use one ISO date or a range with two ISO dates.")
    start, end = filters.date_from, filters.date_to
    month = None
    if dates:
        try:
            start, end = date.fromisoformat(dates[0]), date.fromisoformat(dates[-1])
        except ValueError as exc:
            raise ValueError("Invalid date; use YYYY-MM-DD.") from exc
    else:
        months = "|".join(calendar.month_name[1:])
        matches = list(re.finditer(rf"\b({months})\s+(\d{{4}})\b", query, re.I))
        if len(matches) > 1:
            raise ValueError("Use two ISO dates to specify a range across multiple months.")
        month = matches[0] if matches else None
        if month:
            year = int(month[2])
            number = [name.casefold() for name in calendar.month_name].index(month[1].casefold())
            start, end = date(year, number, 1), date(year, number, calendar.monthrange(year, number)[1])
        elif re.search(rf"\b({months})\b", query, re.I):
            raise ValueError("Specify both the month and year, or use ISO dates.")
    if filters.date_from:
        start = max(start, filters.date_from) if start else filters.date_from
    if filters.date_to:
        end = min(end, filters.date_to) if end else filters.date_to
    if start and end and start > end:
        raise ValueError("The start date must not be after the end date.")
    if re.search(r"\b(today|yesterday|tomorrow|last|past|before|after|since|until)\b", query, re.I):
        raise ValueError("Use an explicit inclusive date range: YYYY-MM-DD to YYYY-MM-DD.")
    if re.search(r"\b(mondays?|tuesdays?|wednesdays?|thursdays?|fridays?|saturdays?|sundays?|weekends?|weekdays?|morning|afternoon|evening)\b", query, re.I):
        raise ValueError("Weekday and time-of-day filters are not supported; use ISO dates.")
    # Never silently ignore an unsupported named month or bare year.
    if re.search(r"\b(19|20)\d{2}\b", query) and not dates and not month:
        raise ValueError("Specify a full month and year, or ISO start and end dates.")
    return start, end


def summary(operation, values):
    if operation == "count":
        return len(values)
    if operation == "sum":
        return math.fsum(values)
    if operation == "average":
        return math.fsum(values) / len(values)
    return min(values) if operation == "min" else max(values)


def display_number(value):
    return f"{value:,.6f}".rstrip("0").rstrip(".")


def calculate(query, points, filters=None, max_records=200_000):
    if not query.strip():
        raise ValueError("Query must contain text.")
    filters = filters if isinstance(filters, AggregateFilters) else AggregateFilters.model_validate(filters or {})
    lowered = query.casefold()
    if re.search(r"\b(median|percentile|variance|trend|busiest|greater than|less than|longer than|shorter than|more than|fewer than|above|below|at least|at most)\b|\b(?:over|under)\s+\d", lowered):
        raise ValueError("Supported calculations: min, max, average, sum and count; use 'total interactions by exhibit' for exhibit comparisons.")
    if re.search(r"\bgallery\b|\b(?:in|at|from)\s+(?:whitefield|jayanagar)\b", lowered):
        raise ValueError("Gallery/location filters are not supported. Select a named exhibit, source or sheet.")
    operations, metric = calculation_intent(query)
    start, end = date_bounds(lowered, filters)

    rows, seen, entities = [], set(), {}
    for point in points:
        attributes = point.get("attributes") or {}
        if not attributes:
            continue
        locator = point.get("locator", "").split("|char:", 1)[0]
        key = (point["doc_id"], point["revision"], locator)
        if key in seen:
            continue
        seen.add(key)
        if len(seen) > max_records:
            raise ValueError("Calculation exceeds the configured record limit; narrow the source scope.")
        metadata = filter_metadata(point)
        sheet = metadata["sheet"]
        name = next((str(attributes[k]) for k in ("display_name", "exhibit_id", "exhibit", "station") if attributes.get(k)), sheet)
        entity = normalize_exhibit(name) if name else ""
        if entity:
            entities[entity] = name
        rows.append({"point": point, "attributes": attributes, "sheet": sheet,
                     "entity": entity, "name": name, "metrics": row_metrics(attributes)})

    # Match contiguous names and prefer the longest to distinguish station variants.
    normalized_query = normalize_exhibit(lowered)
    names = [entity for entity in entities if re.search(r"(?<!\w)" + re.escape(entity) + r"(?!\w)", normalized_query)]
    entity = normalize_exhibit(filters.exhibit) if filters.exhibit else (max(names, key=len) if names else None)
    source_names = sorted({row["point"].get("source", "") for row in rows})
    explicit_sources = [name for name in source_names if name.casefold() in lowered]
    source = filters.source or (max(explicit_sources, key=len) if explicit_sources else None)
    unknown_scope = re.search(r"\b(?:for|of|at)\s+(.+?)(?:\s+(?:in|from|during|between)\b|[?.]|$)", lowered)
    if not entity and not explicit_sources and unknown_scope:
        phrase = unknown_scope[1].strip()
        if not re.fullmatch(r"(?:the |all |unique |distinct )?(?:sessions?|runs?|records?|exhibits?|stations?|museum|dataset)", phrase):
            # Explicit unknown scopes must never fall back to museum-wide numbers.
            raise ValueError("Unrecognized scope. Select an exhibit/file/sheet filter explicitly.")
    sessions_only = metric == "sessions" or (metric in {"duration", "presses"} and
        re.search(r"\bsessions?\b", lowered) and not entity and not filters.sheet)
    selected, missing_dates = [], 0
    for row in rows:
        if source and row["point"].get("source") != source:
            continue
        if filters.sheet and row["sheet"] != filters.sheet:
            continue
        if entity and row["entity"] != entity:
            continue
        attrs = row["attributes"]
        is_session = ("session" in row["point"].get("source", "").casefold() or
            ("started_at" in attrs and "duration" in row["metrics"]))
        if sessions_only and not is_session:
            continue
        if metric in {"duration", "presses"} and metric not in row["metrics"]:
            continue
        if start or end:
            observed = row_date(attrs)
            if observed is None:
                missing_dates += 1
                continue
            if (start and observed < start) or (end and observed > end):
                continue
        selected.append(row)
    if missing_dates:
        raise ValueError(f"Cannot apply the date filter reliably: {missing_dates} scoped records have missing/invalid start dates.")
    scope = {"source": source, "sheet": filters.sheet, "exhibit": entities.get(entity, entity),
             "date_from": str(start) if start else None, "date_to": str(end) if end else None,
             "date_basis": "source calendar date of session/run start" if start or end else None}
    if not selected:
        return {"query": query, "exact": False, "records": 0, "scope": scope, "metrics": [],
                "answer": "No matching structured records were found for this calculation."}
    if metric == "exhibits":
        values = list({row["entity"] for row in selected if row["entity"]})
    else:
        values = [row["metrics"][metric] if metric in {"duration", "presses"} else 1 for row in selected]
    unit = "seconds" if metric == "duration" else metric
    metrics = []
    for operation in operations:
        value = summary(operation, values)
        extrema = [row for row in selected if metric in row["metrics"] and
                   row["metrics"][metric] == value] if operation in {"min", "max"} else []
        evidence = [{"source": row["point"]["source"], "locator": row["point"]["locator"],
                     "exhibit": row["name"], "value": value} for row in extrema[:20]]
        metrics.append({"operation": operation, "field": metric, "value": value,
            "unit": "records" if operation == "count" and metric in {"duration", "presses"} else unit,
            "records": len(values), "exhibits": sorted({row["name"] for row in extrema if row["name"]}),
            "evidence": evidence, "evidence_truncated": len(extrema) > 20,
            "formula": f"{display_number(math.fsum(values))} / {len(values):,}" if operation == "average" else operation})
    groups = []
    if re.search(r"\b(?:by|per|each)\s+exhibits?\b", lowered):
        for name in sorted({row["name"] for row in selected if row["name"]}):
            group = [row for row in selected if row["name"] == name]
            group_values = [name] if metric == "exhibits" else [row["metrics"][metric] if metric in {"duration", "presses"} else 1 for row in group]
            groups.append({"exhibit": name, "records": len(group),
                           "metrics": {op: summary(op, group_values) for op in operations}})
    answer = "; ".join(f"{item['operation'].title()} {metric}: {display_number(item['value'])} {item['unit']}" for item in metrics)
    response = {"query": query, "exact": True, "records": len(selected), "scope": scope,
        "sources": sorted({row["point"]["source"] for row in selected}), "metrics": metrics,
        "groups": groups, "answer": answer + f". Calculated from {len(selected):,} published structured records.",
        "interpretation": f"Interpreted as {', '.join(operations)} of {metric}; visit/run durations are measured in seconds." if metric == "duration" else f"Interpreted as {', '.join(operations)} of {metric}."}
    if len(metrics) == 1:
        response.update({key: metrics[0][key] for key in ("operation", "field", "value", "exhibits")})
    return response
