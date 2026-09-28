import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const PARAM_SERVICE_URL = (process.env.PARAM_SERVICE_URL || 'https://param-retrieval.onrender.com').replace(/\/$/, '');
const PARAM_READ_KEY = process.env.PARAM_READ_KEY?.trim() || '';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY?.trim() || '';
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()) 
  : ['http://localhost:3000', 'http://127.0.0.1:3000'];

// Security: Hide Express header
app.disable('x-powered-by');

// Trust proxy for Render deployment (needed for rate limiter to see real client IPs)
app.set('trust proxy', 1);

// Security: Rate Limiting
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests',
    message: 'Too many search requests from this IP. Please wait a minute and try again.'
  }
});

// Security: CORS configuration
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (process.env.ALLOWED_ORIGINS) {
      if (ALLOWED_ORIGINS.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Cross-Origin Request Blocked by Security Policy'));
    }
    return callback(null, true);
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '1mb' }));
app.use('/api/', apiLimiter);

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${duration}ms)`);
  });
  next();
});

// Allowed team emails whitelist
const ALLOWED_EMAILS = [
  'mantriramitha.cs24@bmsce.ac.in',
  'mantriramitha17@gmail.com',
  'maheshx43a@gmail.com',
  'amitraksharmukherjee@gmail.com',
  'ml9079725@gmail.com'
].map(e => e.toLowerCase());

// Middleware to enforce authorized team email on API endpoints
function requireAuthorizedTeamEmail(req, res, next) {
  const userEmail = (req.headers['x-user-email'] || '').toLowerCase().trim();
  if (!userEmail || !ALLOWED_EMAILS.includes(userEmail)) {
    return res.status(403).json({
      error: 'Forbidden',
      message: '⛔ Unauthorized: Access is strictly restricted to designated team members only.'
    });
  }
  next();
}



/**
 * Health Check
 * GET /health or /api/health
 */
const handleHealth = async (req, res) => {
  const startTime = Date.now();
  let upstreamStatus = 'unknown';
  let upstreamLatency = null;
  let upstreamError = null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const upstreamRes = await fetch(`${PARAM_SERVICE_URL}/health`, {
      method: 'GET',
      signal: controller.signal
    });
    clearTimeout(timeout);

    upstreamLatency = Date.now() - startTime;
    upstreamStatus = upstreamRes.ok ? 'healthy' : `http_${upstreamRes.status}`;
  } catch (err) {
    upstreamLatency = Date.now() - startTime;
    upstreamStatus = 'unreachable_or_sleeping';
    upstreamError = err.message;
  }

  return res.json({
    status: 'online',
    service: 'param-retrieval-backend',
    timestamp: new Date().toISOString(),
    config: {
      has_read_key: Boolean(PARAM_READ_KEY),
      has_gemini_key: Boolean(GEMINI_API_KEY),
      upstream_url: PARAM_SERVICE_URL
    },
    upstream: {
      url: `${PARAM_SERVICE_URL}/health`,
      status: upstreamStatus,
      latency_ms: upstreamLatency,
      error: upstreamError
    }
  });
};

app.get('/health', handleHealth);
app.get('/api/health', handleHealth);

// Configurable relevance cutoff for reranked search results
const MIN_RERANK_SCORE = 0.0;

/**
 * Retrieve
 * POST /api/retrieve
 * Body: { query: string, top_k?: number, scope?: "text" | "image" | "all" }
 */
app.post('/api/retrieve', requireAuthorizedTeamEmail, async (req, res) => {
  const { query, top_k = 5, scope = 'text' } = req.body || {};

  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    return res.status(400).json({
      error: 'Invalid request',
      message: 'Query must contain non-whitespace text.'
    });
  }

  const cleanQuery = query.trim();
  if (cleanQuery.length > 4000) {
    return res.status(400).json({
      error: 'Invalid request',
      message: 'Query exceeds maximum allowed length of 4000 characters.'
    });
  }

  if (!PARAM_READ_KEY) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'PARAM_READ_KEY is not configured on the backend server.'
    });
  }

  const parsedTopK = parseInt(top_k, 10);
  const validatedTopK = isNaN(parsedTopK) ? 5 : Math.max(1, Math.min(50, parsedTopK));
  const validScopes = ['text', 'image', 'all'];
  const validatedScope = validScopes.includes(scope) ? scope : 'text';

  // For analytical/numerical queries, optimize retrieval text so BM25 searches for actual data/metrics
  // (e.g. "dwell duration across exhibits") rather than calculation meta-words ("what is the minimum, maximum, and average")
  const isAnalyticalQuery = /\b(minimum|maximum|average|highest|lowest|min|max|avg|sum|total|median|busiest)\b/i.test(cleanQuery);
  let searchTargetQuery = cleanQuery;
  let retrievalTopK = validatedTopK;

  if (isAnalyticalQuery) {
    const stripped = cleanQuery
      .replace(/\b(what\s+(is|are|was|were)\s+the|calculate\s+the|find\s+the|tell\s+me\s+the|minimum|maximum|average|highest|lowest|min|max|avg|and|or)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (stripped.length > 2) {
      searchTargetQuery = `${stripped} exhibit telemetry`;
    }
    // Fetch a richer sample of records so Gemini can compute min, max, average across multiple data points
    retrievalTopK = Math.max(validatedTopK, 12);
  }

  const startTime = Date.now();
  let upstreamData = null;
  let upstreamSuccess = false;
  let isTimeoutOccurred = false;

  // Wake up Render first if needed
  try {
    const wakeRes = await fetch(`${PARAM_SERVICE_URL}/health`, { method: 'GET' });
    if (!wakeRes.ok) await new Promise(r => setTimeout(r, 6000));
  } catch {
    await new Promise(r => setTimeout(r, 6000));
  }

  // Try upstream retrieval service with retries
  const MAX_RETRIES = 2;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => {
        isTimeoutOccurred = true;
        controller.abort();
      }, 25000);

      const upstreamResponse = await fetch(`${PARAM_SERVICE_URL}/v1/retrieve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${PARAM_READ_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query: searchTargetQuery,
          top_k: retrievalTopK,
          scope: validatedScope
        }),
        signal: controller.signal
      });

      clearTimeout(timeout);

      const rawText = await upstreamResponse.text();
      try {
        upstreamData = JSON.parse(rawText);
      } catch {
        upstreamData = { raw: rawText };
      }

      if (upstreamResponse.ok && (Array.isArray(upstreamData.text_results) || Array.isArray(upstreamData.results) || Array.isArray(upstreamData.image_results))) {
        upstreamSuccess = true;
        break;
      } else {
        console.warn(`[Retrieve] Attempt ${attempt}/${MAX_RETRIES} - Upstream HTTP ${upstreamResponse.status}.`);
        if (attempt < MAX_RETRIES) await new Promise(r => setTimeout(r, 3000 * attempt));
      }
    } catch (err) {
      if (err.name === 'AbortError') isTimeoutOccurred = true;
      console.warn(`[Retrieve] Attempt ${attempt}/${MAX_RETRIES} - Connection issue (${err.message}).`);
      if (attempt < MAX_RETRIES) await new Promise(r => setTimeout(r, 3000 * attempt));
    }
  }

  // Return live results from upstream with score cutoff filtering
  if (upstreamSuccess && upstreamData) {
    const latency = Date.now() - startTime;

    // Apply relevance score cutoff filtering
    if (Array.isArray(upstreamData.text_results)) {
      const initialCount = upstreamData.text_results.length;
      upstreamData.text_results = upstreamData.text_results.filter(r => {
        if (typeof r.rerank_score === 'number') {
          return r.rerank_score >= MIN_RERANK_SCORE;
        }
        return (r.score || 0) >= 0.012;
      });

      if (initialCount > 0 && upstreamData.text_results.length === 0) {
        upstreamData._notice = 'No records met the relevance cutoff for this query.';
      }
    }

    return res.json({
      ...upstreamData,
      _latency_ms: latency,
      _is_live: true,
      _cutoff_applied: true
    });
  }

  // Explicit 'Not retrieved' without any fallback
  const message = isTimeoutOccurred
    ? 'Not retrieved: The search request took too long to respond.'
    : 'Not retrieved: Upstream retrieval service could not be reached.';

  return res.status(504).json({
    error: 'Not retrieved',
    message,
    text_results: [],
    is_retrieved: false
  });
});

/**
 * Synthesize (Real RAG using Google Gemini with dynamic model resolution and strict factual grounding)
 * POST /api/synthesize
 * Body: { query: string, text_results: Array }
 */
app.post('/api/synthesize', requireAuthorizedTeamEmail, async (req, res) => {
  const { query, text_results } = req.body || {};

  const cleanQuery = typeof query === 'string' ? query.trim() : '';
  if (!cleanQuery) {
    return res.status(400).json({ error: 'Query cannot be empty.' });
  }

  // If no results or empty text_results, respond with "I don't know based on the provided records."
  if (!Array.isArray(text_results) || text_results.length === 0) {
    return res.json({
      query: cleanQuery,
      summary: "I don't know based on the provided records.",
      is_configured: true
    });
  }

  if (!GEMINI_API_KEY) {
    return res.json({
      query,
      summary: "⚠️ **Gemini API Key Required**\n\nTo enable real-time dynamic AI answers, add `GEMINI_API_KEY` to your environment variables in Render (or in `backend/.env` locally).\n\nYou can grab a free key in 30 seconds from **[aistudio.google.com](https://aistudio.google.com/)**.",
      is_configured: false
    });
  }

  try {
    // Format retrieved evidence chunks into structured context
    const evidenceContext = text_results.map((r, i) => {
      const attrs = r.attributes ? JSON.stringify(r.attributes) : '';
      return `[Record #${i + 1} from ${r.source} (${r.locator || 'row'})]:
Content: ${r.text}
Metadata: ${attrs}`;
    }).join('\n\n');

    const systemInstruction = `You are a data-analysis assistant for the Param Knowledge System. Your job is to answer user queries by analyzing and computing from the actual available dataset records provided, not by searching for keywords or returning records that merely contain words such as "maximum", "minimum", "average", "highest", "lowest", etc.

CORE RULES:
1. Understand the user's intent:
   - Identify what metric, column, entity, time period, category, or condition the user is asking about.
   - Do not treat the words in the query as search keywords.
   - Determine what calculation or comparison is actually required.

2. Perform the calculation on the data:
   - For MAX, inspect the relevant numerical values (e.g. duration_s, presses, interactions, sessions) and calculate the actual maximum.
   - For MIN, inspect the relevant numerical values and calculate the actual minimum.
   - For AVG, calculate the arithmetic mean using the relevant available values (sum / count).
   - For SUM, COUNT, MEDIAN, percentages, ratios, differences, trends, rankings, etc., perform the appropriate mathematical operation on the dataset records.
   - Never answer based only on a text search or matching rows containing the requested words.

3. Use the correct data scope:
   - Apply all filters mentioned by the user before calculating (e.g. specific exhibit station, date range, or gallery).
   - If the query contains multiple conditions, apply all of them.

4. Do not fabricate missing data:
   - Only use values that actually exist in the available dataset records.
   - Never infer, assume, estimate, or invent values unless the user explicitly asks for an estimate.

5. Handle insufficient data explicitly:
   - If the dataset records do not contain enough relevant information to answer the query accurately, respond:
     "Data insufficient to answer this query accurately."
     Then briefly explain what information is missing.
   - Do NOT return a guessed answer.
   - Do NOT use unrelated rows simply because they contain matching keywords.

6. Validate the result:
   Before answering, verify:
   - The correct metric/column was used (e.g. duration_s vs presses).
   - The correct rows/filters were applied.
   - The calculation was performed correctly.
   - Missing/null values were handled appropriately.
   - The result is supported by the available data.

7. Explain the calculation briefly:
   - When appropriate, show the relevant values or calculation (e.g. "Values found: 17.5s, 70.4s, 84.7s. Min: 17.5s, Max: 84.7s, Avg: (17.5 + 70.4 + 84.7) / 3 = 57.53s").

8. For comparisons:
   - If asked for highest/lowest groups or exhibits, calculate the relevant metric for every applicable group first, then compare the calculated results.

9. Irrelevant / Unsupported Queries:
   - If the query cannot be answered using the records or is unrelated to Param, state: "I don't know based on the provided records." or "Data insufficient to answer this query accurately."

10. Answer format:
    Give:
    - The calculated answer with key metrics in bold
    - The relevant values and entities
    - A short explanation of how it was calculated
    - If data is insufficient, clearly state "Data insufficient to answer this query accurately." with the reason.

CRITICAL INSTRUCTION:
SEARCHING FOR WORDS IS NOT DATA ANALYSIS.
Never answer a numerical query merely because a row, document, or field contains words such as "max", "min", "average", "highest", or "lowest".
For every numerical query, first identify the relevant data, apply the requested filters, perform the actual computation, validate the result, and only then provide the answer.
If the required data is unavailable or insufficient, explicitly say:
"Data insufficient to answer this query accurately."
Do not hallucinate or manufacture a result.`;

    const userMessage = `Database Records:
${evidenceContext}

User Question:
"${cleanQuery}"

Please provide a detailed, natural English answer to the user's question based strictly on the database records above:`;

    // Active models recommended by Google (gemini-3.6-flash and gemini-3.5-flash-lite)
    const candidateModels = [
      'models/gemini-3.6-flash',
      'models/gemini-3.5-flash-lite'
    ];

    let lastError = null;
    let answer = null;
    let usedModel = null;

    for (const modelPath of candidateModels) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 20000);

        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/${modelPath}:generateContent?key=${GEMINI_API_KEY}`;
        console.log(`[Gemini] Attempting ${modelPath}...`);

        const geminiRes = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: {
              parts: [{ text: systemInstruction }]
            },
            contents: [
              {
                role: "user",
                parts: [{ text: userMessage }]
              }
            ],
            generationConfig: {
              temperature: 0.25,
              maxOutputTokens: 2048
            }
          }),
          signal: controller.signal
        });

        clearTimeout(timeout);

        const rawResText = await geminiRes.text();
        let resData = {};
        try {
          resData = JSON.parse(rawResText);
        } catch {
          resData = { raw: rawResText };
        }

        if (!geminiRes.ok) {
          const errMsg = resData.error?.message || `Gemini API returned status ${geminiRes.status}`;
          console.warn(`[Gemini] ${modelPath} failed (${geminiRes.status}): ${errMsg}`);
          lastError = new Error(errMsg);
          // If high demand (503), rate limit (429), or not found (404), try next model
          if ([503, 429, 404].includes(geminiRes.status)) {
            continue;
          }
          throw lastError;
        }

        const candidateText = resData.candidates?.[0]?.content?.parts?.[0]?.text;
        if (candidateText) {
          // Guard: if Google returned a deprecation advisory as text, skip to next active model
          if (candidateText.includes('is no longer available') || candidateText.includes('Please update your code to use')) {
            console.warn(`[Gemini] ${modelPath} returned deprecation advisory text. Trying next model.`);
            continue;
          }
          answer = candidateText;
          usedModel = modelPath;
          break;
        }
      } catch (loopErr) {
        lastError = loopErr;
        console.warn(`[Gemini] Error with ${modelPath}:`, loopErr.message);
      }
    }

    if (!answer) {
      throw lastError || new Error('All candidate Gemini models failed to respond.');
    }

    return res.json({
      query,
      summary: answer,
      model: usedModel.replace(/^models\//, ''),
      is_configured: true
    });
  } catch (err) {
    console.error('[Synthesize Error]', err.message);
    return res.status(500).json({
      error: 'Gemini synthesis failed',
      message: err.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`Param Retrieval Backend listening on port ${PORT}`);
  console.log(`Upstream URL: ${PARAM_SERVICE_URL}`);
  console.log(`PARAM_READ_KEY configured: ${Boolean(PARAM_READ_KEY)}`);
  console.log(`GEMINI_API_KEY configured: ${Boolean(GEMINI_API_KEY)}`);
});
