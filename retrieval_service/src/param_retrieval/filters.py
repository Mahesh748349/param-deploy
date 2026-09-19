"""Derived, non-embedding metadata; can be backfilled without re-ingestion."""
import re
from pydantic import BaseModel, ConfigDict, Field


def normalize_exhibit(value):
    return re.sub(r'[-_\s]+', ' ', str(value).strip().casefold())


class SearchFilters(BaseModel):
    model_config = ConfigDict(extra='forbid')
    source: str | None = Field(None, min_length=1, max_length=1000)
    sheet: str | None = Field(None, min_length=1, max_length=300)
    exhibit: str | None = Field(None, min_length=1, max_length=300)

    def values(self):
        values = self.model_dump(exclude_none=True)
        if 'exhibit' in values:
            values['exhibit'] = normalize_exhibit(values['exhibit'])
        return values


def filter_metadata(payload):
    match = re.match(r'sheet:(.*?)\|row:', payload.get('locator', ''))
    sheet = match.group(1) if match else ''
    attrs = payload.get('attributes') or {}
    exhibits = [normalize_exhibit(attrs[k]) for k in ('exhibit_id', 'display_name', 'exhibit')
                if attrs.get(k) is not None]
    # Workbook sheet titles act as explicit exhibit aliases for sheet-organized data.
    if sheet:
        exhibits.append(normalize_exhibit(sheet))
    return {'source': payload.get('source', ''), 'sheet': sheet,
            'exhibit': sorted(set(exhibits)), 'version': 1}


def enrich_points(points):
    return [{**p, 'payload': {**p['payload'], '_filter': filter_metadata(p['payload'])}} for p in points]
