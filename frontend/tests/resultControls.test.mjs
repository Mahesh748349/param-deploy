import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFilters, changeFilters, showResultControls, sortRows } from '../src/resultControls.js';

const empty = { sheet: '', file: '', exhibit: '' };

test('changing file clears an incompatible sheet and sends the selected file', () => {
  const next = changeFilters({ ...empty, sheet: 'Engagement Sheet' }, 'file', 'Physical Exhibit.xlsx');
  assert.equal(next.sheet, '');
  assert.deepEqual(buildFilters(next), { source: 'Physical Exhibit.xlsx' });
});

test('changing sheet clears an incompatible file and keeps compatible file selections', () => {
  const next = changeFilters({ ...empty, file: 'Physical Exhibit.xlsx' }, 'sheet', 'Executive Report Sheet');
  assert.equal(next.file, '');
  assert.deepEqual(buildFilters(next), { source: 'engagement-report-2026-09-15.pdf' });
  const compatible = changeFilters({ ...empty, file: 'Physical Exhibit.xlsx' }, 'sheet', 'Kinetic Bug');
  assert.deepEqual(buildFilters(compatible), { source: 'Physical Exhibit.xlsx', sheet: 'Kinetic Bug' });
});

test('dynamic workbook sheets resolve their source without hardcoded names', () => {
  const hits = [{ source: 'new.xlsx', locator: 'sheet:New Station|row:2|char:0' }];
  const next = changeFilters({ ...empty, file: 'new.xlsx' }, 'sheet', 'New Station', hits);
  assert.equal(next.file, 'new.xlsx');
  assert.deepEqual(buildFilters(next), { source: 'new.xlsx', sheet: 'New Station' });
});

test('clearing controls and selecting all results do not add synthetic sheet filters', () => {
  assert.deepEqual(buildFilters(empty), {});
  assert.deepEqual(buildFilters({ ...empty, sheet: 'Result Sheet' }), {});
  const next = changeFilters({ ...empty, sheet: 'Kinetic Bug', exhibit: 'Kinetic Bug' }, 'sheet', '');
  assert.deepEqual(buildFilters(next), { exhibit: 'Kinetic Bug' });
});

test('empty and failed filtered searches retain controls and reset access', () => {
  assert.equal(showResultControls([], null, empty), false);
  assert.equal(showResultControls([], { text_results: [] }, empty), true);
  assert.equal(showResultControls([], null, { ...empty, sheet: 'Kinetic Bug' }), true);
});

const rows = [
  { record: { id: 'long' }, durationNum: 20, pressesNum: 2, exhibit: 'Zebra' },
  { record: { id: 'report' }, durationNum: null, pressesNum: null, exhibit: 'Report' },
  { record: { id: 'short' }, durationNum: 3, pressesNum: 9, exhibit: 'Alpha' }
];
const ids = result => result.map(row => row.record.id);

test('card records follow the same numeric order as table rows, with missing values last', () => {
  assert.deepEqual(ids(sortRows(rows, 'duration', 'asc')), ['short', 'long', 'report']);
  assert.deepEqual(ids(sortRows(rows, 'duration', 'desc')), ['long', 'short', 'report']);
  assert.deepEqual(ids(sortRows(rows, 'presses', 'desc')), ['short', 'long', 'report']);
  assert.deepEqual(ids(rows), ['long', 'report', 'short']);
});

test('relevance restores server order and station sorting uses names', () => {
  assert.deepEqual(ids(sortRows(rows, 'relevance', 'desc')), ids(rows));
  assert.deepEqual(ids(sortRows(rows, 'exhibit', 'asc')), ['short', 'report', 'long']);
});
