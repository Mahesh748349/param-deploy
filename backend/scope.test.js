import test from 'node:test';
import assert from 'node:assert/strict';
import { queryScope, parseGroundedAnswer } from './scope.js';

test('scope allows museum questions and station aliases without numeric score gates', () => {
  const hit = { attributes: { exhibit_id: 'traffic-gallery-sign-game' }, source: 'sessions.csv' };
  assert.equal(queryScope('traffic sign game usage', [hit]).allowed, true);
  assert.equal(queryScope('visitor engagement', []).allowed, true);
  assert.equal(queryScope('TacTile', [{ attributes: { exhibit_id: 'TacTile' } }]).allowed, true);
  assert.equal(queryScope('how to make pizza', []).allowed, false);
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
