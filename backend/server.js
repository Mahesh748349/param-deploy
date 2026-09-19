import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const PARAM_SERVICE_URL = (process.env.PARAM_SERVICE_URL || 'https://param-retrieval.onrender.com').replace(/\/$/, '');
const PARAM_READ_KEY = process.env.PARAM_READ_KEY?.trim() || '';
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()) 
  : ['http://localhost:3000', 'http://127.0.0.1:3000'];

// Security: Hide Express header
app.disable('x-powered-by');

// Trust proxy for Render deployment (needed for rate limiter to see real client IPs)
app.set('trust proxy', 1);

// Security: Rate Limiting to prevent brute-force or API exhaustion
// Allows up to 60 retrieval requests per minute per IP address
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // Limit each IP to 60 requests per windowMs
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  message: {
    error: 'Too many requests',
    message: 'Too many search requests from this IP. Please wait a minute and try again.'
  }
});

// Security: CORS configuration
// If ALLOWED_ORIGINS is set, restrict access to your Netlify domain + local dev
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, or server-to-server)
    if (!origin) return callback(null, true);
    
    if (process.env.ALLOWED_ORIGINS) {
      if (ALLOWED_ORIGINS.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Cross-Origin Request Blocked by Security Policy'));
    }
    
    // In dev or default, allow origin
    return callback(null, true);
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '1mb' }));

// Apply rate limiting to all /api/ routes
app.use('/api/', apiLimiter);

// Request logging (sanitized, NEVER logs API keys)
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${duration}ms)`);
  });
  next();
});

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

/**
 * Retrieve
 * POST /api/retrieve
 * Body: { query: string, top_k?: number, scope?: "text" | "image" | "all" }
 */
app.post('/api/retrieve', async (req, res) => {
  const { query, top_k = 5, scope = 'text' } = req.body || {};

  // Input Validation
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

  // Verify server-side secret key
  if (!PARAM_READ_KEY) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'PARAM_READ_KEY is not configured on the backend server. Please configure it in your environment variables.'
    });
  }

  const parsedTopK = parseInt(top_k, 10);
  const validatedTopK = isNaN(parsedTopK) ? 5 : Math.max(1, Math.min(50, parsedTopK));
  const validScopes = ['text', 'image', 'all'];
  const validatedScope = validScopes.includes(scope) ? scope : 'text';

  const startTime = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 65000); // 65s timeout for Render cold-starts

    const upstreamResponse = await fetch(`${PARAM_SERVICE_URL}/v1/retrieve`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PARAM_READ_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: cleanQuery,
        top_k: validatedTopK,
        scope: validatedScope
      }),
      signal: controller.signal
    });

    clearTimeout(timeout);
    const latency = Date.now() - startTime;

    if (!upstreamResponse.ok) {
      let details = {};
      try {
        details = await upstreamResponse.json();
      } catch {
        details = { raw: await upstreamResponse.text() };
      }

      console.error(`[Retrieve] Upstream HTTP ${upstreamResponse.status}:`, details);
      return res.status(upstreamResponse.status).json({
        error: 'Upstream retrieval service error',
        status: upstreamResponse.status,
        details
      });
    }

    const data = await upstreamResponse.json();
    return res.json({
      ...data,
      _latency_ms: latency
    });
  } catch (err) {
    const latency = Date.now() - startTime;
    console.error(`[Retrieve] Connection error (${latency}ms):`, err.message);
    return res.status(504).json({
      error: 'Gateway Timeout',
      message: `Failed to communicate with ${PARAM_SERVICE_URL}. Render instance may be cold starting.`,
      details: err.message
    });
  }
});

/**
 * Synthesize
 * POST /api/synthesize
 */
app.post('/api/synthesize', (req, res) => {
  const { query, text_results } = req.body || {};
  if (!query || !Array.isArray(text_results) || text_results.length === 0) {
    return res.status(400).json({ error: 'Query and text_results are required for synthesis.' });
  }

  const sources = [...new Set(text_results.map(r => r.source).filter(Boolean))];
  const totalChunks = text_results.length;

  const keyFindings = text_results.slice(0, 3).map((r) => {
    const clean = r.text.replace(/^Source:.*?;\s*/i, '').trim();
    const firstSentence = clean.split(/(?<=[.!?])\s+/)[0] || clean.slice(0, 160);
    return `• ${firstSentence}`;
  });

  const summary = `Based on ${totalChunks} relevant record(s) retrieved from ${sources.join(', ')}:

${keyFindings.join('\n\n')}

*Key takeaway:* Telemetry records indicate direct correlation with "${query}".`;

  return res.json({
    query,
    summary,
    sources_consulted: sources,
    chunks_analyzed: totalChunks
  });
});

app.listen(PORT, () => {
  console.log(`Param Retrieval Backend listening on port ${PORT}`);
  console.log(`Upstream URL: ${PARAM_SERVICE_URL}`);
  console.log(`PARAM_READ_KEY configured: ${Boolean(PARAM_READ_KEY)}`);
});
