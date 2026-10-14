import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './app.js';

const env = { PARAM_SERVICE_URL: 'https://retrieval.test', PARAM_READ_KEY: 'read-test',
  SUPABASE_URL: 'https://auth.test', SUPABASE_ANON_KEY: 'public-test', ALLOWED_EMAILS: 'team@example.test' };
const json = (data, status = 200) => new Response(JSON.stringify(data), { status });
const verified = { email: 'team@example.test', email_confirmed_at: '2026-01-01' };

async function withApp(fn, handler, config = env) {
  const calls = [];
  const app = createApp(config, async (url, options) => {
    calls.push({ url, options });
    return handler(url, options);
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (path, body, headers = { Authorization: 'Bearer valid-test' }) => fetch(base + path, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
  try { await fn(post, calls); }
  finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
}

test('spoofed email is rejected without a bearer token', async () => {
  await withApp(async (post, calls) => {
    assert.equal((await post('/api/retrieve', { query: 'usage' }, { 'X-User-Email': verified.email })).status, 401);
    assert.equal(calls.length, 0);
  }, () => { throw new Error('Must not call upstream'); });
});

test('expired, unapproved and unverified accounts are rejected', async () => {
  for (const [reply, expected] of [[json({}, 401), 401], [json({ ...verified, email: 'outsider@test' }), 403],
    [json({ ...verified, email_confirmed_at: null }), 403]]) {
    await withApp(async post => assert.equal((await post('/api/retrieve', { query: 'usage' })).status, expected), () => reply);
  }
});

test('calculation routes proxy complete-data analytics with filters', async () => {
  await withApp(async (post, calls) => {
    for (const path of ['/api/aggregate', '/api/retrieve']) {
      const response = await post(path, { query: 'max duration for Kinetic Bug', filters: { sheet: 'Kinetic Bug' } });
      assert.equal(response.status, 200);
      const body = await response.json();
      assert.equal(body._aggregate.value, 30);
      assert.equal(body.text_results.length, 0);
    }
    const upstreamCalls = calls.filter(call => call.url.startsWith(env.PARAM_SERVICE_URL));
    assert.ok(upstreamCalls.every(call => call.url.endsWith('/v1/aggregate')));
    assert.equal(JSON.parse(upstreamCalls[0].options.body).filters.sheet, 'Kinetic Bug');
  }, url => json(url.includes('/auth/') ? verified : { exact: true, value: 30, metrics: [] }));
});

test('keyword-only retrieval hits survive and request filters are forwarded', async () => {
  await withApp(async (post, calls) => {
    const response = await post('/api/retrieve', { query: 'Kinetic Bug usage', top_k: 3, filters: { exhibit: 'Kinetic Bug' } });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.text_results[0].id, 'lexical-only');
    assert.equal(body._cutoff_applied, false);
    assert.equal(JSON.parse(calls.at(-1).options.body).top_k, 3);
  }, url => json(url.includes('/auth/') ? verified : {
    text_results: [{ id: 'lexical-only', branch_scores: { lexical: 2 }, ranks: { lexical: 1 } }], ranking: { min_score: null }
  }));
});

test('unsupported calculation errors are preserved as readable JSON', async () => {
  await withApp(async post => {
    const response = await post('/api/aggregate', { query: 'median duration' });
    assert.equal(response.status, 422);
    assert.equal((await response.json()).message, 'Median is unsupported');
  }, url => url.includes('/auth/') ? json(verified) : json({ detail: 'Median is unsupported' }, 422));
});

test('Gemini outage and missing key return source excerpts without invented metrics', async () => {
  for (const config of [env, { ...env, GEMINI_API_KEY: 'fake-test-key' }]) {
    await withApp(async post => {
      const response = await post('/api/synthesize', { query: 'What does the drawing show?', text_results: [{ text: 'invented client content' }] });
      assert.equal(response.status, 200);
      const body = await response.json();
      assert.equal(body.model, 'Source excerpts');
      assert.match(body.summary, /robot sketch/);
      assert.doesNotMatch(body.summary, /invented client content|1,329,443|743/);
    }, url => url.includes('/auth/') ? json(verified) : url.includes('generativelanguage') ? json({}, 503) :
      json({ text_results: [{ source: 'drawing.txt', locator: 'row:2', text: 'robot sketch' }] }), config);
  }
});

test('summary uses configurable Gemini and never exposes its key in the URL', async () => {
  await withApp(async (post, calls) => {
    const response = await post('/api/synthesize', { query: 'Describe the exhibit' });
    assert.equal((await response.json()).summary, 'Grounded answer');
    const google = calls.find(call => call.url.includes('generativelanguage'));
    assert.ok(google.url.includes('models/test-model:generateContent'));
    assert.ok(!google.url.includes('fake-test-key'));
  }, url => url.includes('/auth/') ? json(verified) : url.includes('generativelanguage') ?
    json({ candidates: [{ content: { parts: [{ text: 'Grounded answer' }] } }] }) :
    json({ text_results: [{ source: 'exhibit.txt', locator: 'line:1', text: 'exhibit' }] }),
  { ...env, GEMINI_API_KEY: 'fake-test-key', GEMINI_MODEL: 'test-model' });
});
