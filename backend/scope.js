// Query scope is separate from ranking: a nearest neighbour need not answer a question.
const DEFAULT_TERMS = [
  'param', 'museum', 'exhibit', 'exhibits', 'visitor', 'visitors', 'engagement',
  'dwell', 'session', 'sessions', 'button presses', 'interactions', 'telemetry',
  'kinetic', 'color perception', 'colour perception', 'chromatic', 'puzzle',
  'optical illusion', 'peripheral fading', 'draw an innovator', 'drawing', 'drawings',
  'student sketch', 'student sketches', 'sketch', 'sketches', 'drew', 'drawn'
];

function normalize(value) {
  return String(value || '').replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
function containsPhrase(query, phrase) {
  return (` ${query} `).includes(` ${normalize(phrase)} `);
}

// Structured telemetry cannot explain unrelated concepts just because its vector
// is the nearest neighbour. Prose remains eligible for semantic matching.
const REQUEST_WORDS = new Set(('find information about show me a an the some few recorded records record mentioning '
  + 'what does say tell explain describe please can could you i want to know of for and or at in from '
  + 'visitor visitors activity usage visits visit sessions session exhibit exhibits data details involving').split(' '));
const stem = word => word.length > 4 && word.endsWith('s') ? word.slice(0, -1) : word;
export function filterEvidence(query, hits = []) {
  const terms = normalize(query).split(' ').filter(word => word.length > 2 && !REQUEST_WORDS.has(word)
    && !/^\d+$/.test(word)).map(stem);
  const reportRequest = /\breport\b/i.test(query);
  return hits.filter(hit => {
    if (!Object.keys(hit.attributes || {}).length) return true;
    const words = new Set(normalize([hit.source, hit.locator, hit.text,
      JSON.stringify(hit.attributes)].join(' ')).split(' ').map(stem));
    if (reportRequest && !words.has('report')) return false;
    return !terms.length || terms.some(term => words.has(term));
  });
}

export function queryScope(query, hits = [], configuredTerms) {
  const text = normalize(query);
  const terms = configuredTerms ? configuredTerms.split(',').map(term => term.trim()).filter(Boolean) : DEFAULT_TERMS;
  const aliases = hits.flatMap(hit => {
    const attrs = hit.attributes || {};
    return [attrs.exhibit_id, attrs.display_name, attrs.exhibit, attrs.station,
      hit.locator?.match(/^sheet:(.*?)\|row:/)?.[1], hit.source];
  }).filter(Boolean);
  const queryWords = new Set(text.split(' '));
  const inScope = [...terms, ...aliases].some(term => containsPhrase(text, term))
    || aliases.some(alias => {
      const words = new Set(normalize(alias).split(' ').filter(word => word.length > 3
        && !['source', 'sheet', 'csv', 'xlsx', 'json', 'report', 'sessions'].includes(word)));
      return [...words].filter(word => queryWords.has(word)).length >= 2;
    });
  if (!inScope) return { allowed: false, reason: 'outside_dataset_scope',
    message: 'This question is outside the indexed Param exhibit and visitor-data scope. No supported answer was found.' };

  // Telemetry alone cannot support recipes, construction, gameplay or other procedures.
  // Instruction questions require an actual instruction document, not a matching station name.
  const procedure = /\bhow\b.*\b(make|cook|bake|prepare|build|install|treat|fix|play|solve)\b/i.test(query);
  const instructionEvidence = hits.some(hit => Object.keys(hit.attributes || {}).length === 0
    && /\b(instructions?|recipe|step\s*1|first\b[\s\S]*\bthen)\b/i.test(hit.text || ''));
  if (procedure && !instructionEvidence) return { allowed: false, reason: 'no_instruction_evidence',
    message: 'The indexed records do not provide instructions for this question. No supported answer was found.' };
  return { allowed: true, reason: 'dataset_topic' };
}

export function parseGroundedAnswer(text, hits) {
  let result;
  try { result = JSON.parse(text); } catch { return null; }
  if (result.answerable !== true || typeof result.answer !== 'string' || !result.answer.trim()
      || !Array.isArray(result.citations) || !result.citations.length) return null;
  for (const citation of result.citations) {
    const hit = hits[citation.record - 1];
    if (!Number.isInteger(citation.record) || !hit || typeof citation.quote !== 'string'
        || citation.quote.trim().length < 12 || !hit.text.includes(citation.quote.trim())) return null;
  }
  return { answer: result.answer, citations: result.citations.map(citation => ({
    source: hits[citation.record - 1].source, locator: hits[citation.record - 1].locator,
    quote: citation.quote.trim()
  })) };
}
