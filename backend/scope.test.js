import test from 'node:test';
import assert from 'node:assert/strict';
import { queryScope, parseGroundedAnswer, filterEvidence } from './scope.js';

test('scope allows museum questions and station aliases without numeric score gates', () => {
  const hit = { attributes: { exhibit_id: 'traffic-gallery-sign-game' }, source: 'sessions.csv' };
  assert.equal(queryScope('traffic sign game usage', [hit]).allowed, true);
  assert.equal(queryScope('visitor engagement', []).allowed, true);
  assert.equal(queryScope('TacTile', [{ attributes: { exhibit_id: 'TacTile' } }]).allowed, true);
  assert.equal(queryScope('how to make pizza', []).allowed, false);
});

test('concept and report requests do not turn unrelated telemetry into supporting evidence', () => {
  const bug = { source: 'Physical Exhibit.xlsx', locator: 'sheet:Kinetic Bug|row:2',
    text: 'Total Seconds: 30', attributes: { 'Total Seconds': 30 } };
  for (const query of ['Find information about optical illusions and peripheral fading.',
    'Find records mentioning Chromatic puzzle latency.', 'What does the engagement report say about visitor activity?']) {
    assert.deepEqual(filterEvidence(query, [bug]), [], query);
  }
  assert.deepEqual(filterEvidence('Show me a few recorded visits to Kinetic Bug.', [bug]), [bug]);
  const prose = { source: 'guide.pdf', text: 'An optical illusion can involve peripheral fading.' };
  assert.deepEqual(filterEvidence('Find information about optical illusions and peripheral fading.', [bug, prose]), [prose]);
  const report = { source: 'engagement-report.pdf', text: 'TOTAL INTERACTIONS 1,329,443' };
  assert.deepEqual(filterEvidence('engagement report', [bug, report]), [report]);
});

test('dataset topic configuration can be extended without a denylist of unrelated subjects', () => {
  assert.equal(queryScope('turbine maintenance', [], 'turbine,maintenance').allowed, true);
});

test('support quotes must occur in the actual record', () => {
  const hit = { source: 'guide.pdf', locator: 'page:1', text: 'Visitors use this exhibit to explore colours.' };
  const answer = { answerable: true, answer: 'The exhibit explores colours.',
    citations: [{ record: 1, quote: 'explore colours.' }] };
  assert.equal(parseGroundedAnswer(JSON.stringify(answer), [hit]).citations[0].source, 'guide.pdf');
  assert.equal(parseGroundedAnswer('unstructured answer', [hit]), null);
});
