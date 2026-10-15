import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

test('analytics card renders computed values, evidence and an empty scope honestly', async () => {
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
  try {
    const { default: Card } = await vite.ssrLoadModule('/src/components/AnalyticsMetricsCard.jsx');
    const analytics = { records: 22722, exact: true, sources: ['sessions.csv'], scope: { exhibit: 'Bug' },
      answer: 'Maximum duration: 1804.9 seconds.', metrics: [{ operation: 'max', field: 'duration',
        value: 1804.9, unit: 'seconds', exhibits: ['Bug'], evidence: [{ source: 'sessions.csv', locator: 'row:9', exhibit: 'Bug' }] }] };
    const html = renderToStaticMarkup(React.createElement(Card, { analytics }));
    assert.match(html, /1,804\.9/);
    assert.match(html, /row:9/);
    assert.match(html, /Bug/);
    assert.doesNotMatch(html, /743|100% Whole Dataset/);
    assert.equal(renderToStaticMarkup(React.createElement(Card, {})), '');
    const empty = renderToStaticMarkup(React.createElement(Card, { analytics: {
      records: 0, exact: false, metrics: [], answer: 'No matching structured records were found.' } }));
    assert.match(empty, /No matching structured records/);
    assert.doesNotMatch(empty, /1,329,443|743|167\.3/);
  } finally { await vite.close(); }
});

test('empty filtered results retain reset controls and relevance has no false min label', async () => {
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
  try {
    const { default: Stats } = await vite.ssrLoadModule('/src/components/ResultStats.jsx');
    const html = renderToStaticMarkup(React.createElement(Stats, {
      results: [], meta: { text_results: [] }, totalResultsCount: 0,
      selectedSheet: 'Kinetic Bug', sortField: 'relevance',
      setSortField() {}, setSortOrder() {}, onResetFilters() {}
    }));
    assert.match(html, /Reset Filters/);
    assert.match(html, /Sheet: Kinetic Bug/);
    assert.match(html, /Sort: Relevance/);
    assert.doesNotMatch(html, /Min at top|Max at top/);
  } finally { await vite.close(); }
});
