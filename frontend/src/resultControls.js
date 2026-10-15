const SHEET_SOURCES = {
  'Engagement Sheet': 'engagement-sessions-2026-09-15.csv',
  'Executive Report Sheet': 'engagement-report-2026-09-15.pdf',
  'Kinetic Bug': 'Physical Exhibit.xlsx',
  'Kinetic Flower': 'Physical Exhibit.xlsx'
};

function sheetSource(sheet, results = []) {
  return SHEET_SOURCES[sheet] || results.find(hit =>
    hit.locator?.match(/^sheet:(.*?)\|row:/)?.[1] === sheet)?.source;
}

// The most recently changed file/sheet wins; never silently send conflicting controls.
export function changeFilters(current, field, value, results = []) {
  const next = { ...current, [field]: value };
  if (field === 'file' && value && next.sheet && next.sheet !== 'Result Sheet'
      && sheetSource(next.sheet, results) !== value) next.sheet = '';
  if (field === 'sheet' && value && value !== 'Result Sheet' && next.file
      && sheetSource(value, results) !== next.file) next.file = '';
  return next;
}

export function buildFilters({ sheet, file, exhibit }) {
  const filters = {};
  if (file) filters.source = file;
  if (exhibit) filters.exhibit = exhibit;
  if (sheet === 'Engagement Sheet' || sheet === 'Executive Report Sheet') {
    filters.source = SHEET_SOURCES[sheet];
  } else if (sheet && sheet !== 'Result Sheet') filters.sheet = sheet;
  return filters;
}

export function showResultControls(results, meta, filters) {
  return Boolean(results.length || meta || filters.sheet || filters.file || filters.exhibit);
}

export function sortRows(rows, field, order) {
  if (field === 'relevance') return [...rows];
  return [...rows].sort((a, b) => {
    if (field === 'exhibit') {
      const compared = (a.exhibit || '').localeCompare(b.exhibit || '', undefined, { sensitivity: 'base' });
      return order === 'asc' ? compared : -compared;
    }
    const key = field === 'presses' ? 'pressesNum' : 'durationNum';
    const left = a[key], right = b[key];
    if (!Number.isFinite(left)) return Number.isFinite(right) ? 1 : 0;
    if (!Number.isFinite(right)) return -1;
    return order === 'asc' ? left - right : right - left;
  });
}
