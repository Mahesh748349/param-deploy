"""Reject unsupported record-search dates instead of treating them as keywords."""
import re


def validate_record_query(query):
    text = re.sub(r"\S+\.(?:csv|xlsx?|jsonl?|pdf|docx|txt)\b", "", query, flags=re.I)
    months = r"(?:jan(?:uary)?|feb(?:ruary)?|march|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)"
    if re.search(
        rf"\b(?:\d{{4}}[-/]\d{{2}}[-/]\d{{2}}|\d{{1,2}}/\d{{1,2}}/\d{{2,4}}|"
        r"today|yesterday|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b|"
        r"\b(?:last|past|this)\s+(?:week|month|year|\d+\s+days?)\b|"
        rf"\b(?:in|during|from|since|before|after)\s+(?:19|20)\d{{2}}\b|"
        rf"\b{months}\s+\d|\b\d{{1,2}}\s+{months}\b|"
        rf"\b(?:in|during|from|on|since|before|after)\s+{months}\b",
        text, re.I,
    ):
        raise ValueError("Date-filtered record search is not supported yet. Remove the date to search records, "
                         "or request a calculation using an explicit ISO date (YYYY-MM-DD).")
