"""Conservative calculation intent mapping; no LLM or database access."""
import re


OPERATIONS = {
    "min": r"\b(min|minimum|lowest|shortest|smallest|briefest)\b",
    "max": r"\b(max|maximum|highest|longest|largest)\b",
    "average": r"\b(avg|average|mean|usually|typical|typically)\b",
    "sum": r"\b(sum|total|altogether|combined|overall time)\b|\bin all\b",
    "count": r"\b(count|how many|number of)\b",
}


def calculation_intent(query):
    lowered = query.casefold()
    operation_query = re.sub(r"\btotal seconds\b", "seconds", lowered)
    operations = [name for name, pattern in OPERATIONS.items() if re.search(pattern, operation_query)]
    if not operations and re.search(r"\btotal seconds\b", lowered):
        operations = ["sum"]
    if not operations:
        raise ValueError("Please specify average, longest/maximum, shortest/minimum, total or count.")
    count_phrase = bool(re.search(OPERATIONS["count"], lowered))
    if re.search(r"\b(?:how many|count(?: of)?|number of)\s+(?:distinct |unique )?(?:people|visitors|users)\b", lowered) and not re.search(r"\b(sessions?|visits?|runs?)\b", lowered):
        raise ValueError("Distinct visitor counts are not available. Ask for recorded session or run counts instead.")
    if re.search(r"\bwhich\s+(?:exhibit|station)\b.*\b(highest|lowest|most|least|busiest)\b", lowered):
        raise ValueError("For comparisons, ask for total interactions or average duration by exhibit.")

    duration = bool(re.search(r"\b(durations?|dwell|seconds?|minutes?|hours?|engaged time|engagement time|time spent|time did|spend|spent|stay|stayed)\b|\bhow\s+long\b", lowered))
    # Longest/shortest/typical visit means duration. A count of visits means sessions.
    visit_duration = bool(re.search(r"\b(visits?|sessions?|runs?)\b", lowered)) and not count_phrase and any(
        operation in operations for operation in ("min", "max", "average"))
    presses = bool(re.search(r"\b(press(?:es|ed)?|interactions?|button presses)\b", lowered))
    duration |= visit_duration and (not presses or bool(re.search(r"\b(longest|shortest|briefest)\b", lowered)))
    if duration and presses:
        raise ValueError("Ask for one metric per request: duration or interactions. Multiple operations on that metric are supported.")
    if presses and re.search(r"\b(?:and|,)\s+(?:total |count of )?sessions?\b", lowered):
        raise ValueError("Ask for interactions and session counts in separate requests.")
    metric = ("duration" if duration else "presses" if presses
        else "sessions" if re.search(r"\b(sessions?|visits?)\b", lowered)
        else "runs" if re.search(r"\b(runs?|records?)\b", lowered)
        else "exhibits" if re.search(r"\bexhibits?\b", lowered) else None)
    if metric is None:
        raise ValueError("Specify duration, presses/interactions, sessions, runs or exhibits.")
    # Presses/interactions are counts stored per record: "how many presses"
    # asks for their total, not for the number of numeric cells.
    if metric == "presses" and "count" in operations:
        operations = [operation for operation in operations if operation != "count"] or ["sum"]
    if metric in {"sessions", "runs", "exhibits"}:
        if any(operation not in {"count", "sum"} for operation in operations):
            raise ValueError("Use count or total for sessions, runs and exhibits.")
        operations = ["count"]
    return operations, metric
