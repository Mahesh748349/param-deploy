# Param Knowledge Retrieval System — Engineering Handover & Project Summary

> **Document Version:** 1.0.0  
> **Last Updated:** September 19, 2026  
> **Repository:** `https://github.com/Mahesh748349/Param.git`  
> **Working Branch:** `feature/web-app`  

---

## 1. Executive Summary & Objective

The goal of this project was to take the hosted **Param Hybrid Retrieval Engine** (which indexes museum visitor telemetry records from `engagement-sessions-2026-09-15.csv` across Qdrant and PostgreSQL) and build a production-grade, secure, full-stack search and analysis studio.

### Key Deliverables Completed:
1. **Node.js/Express API Gateway (`/backend`)**:
   - Secure proxy protecting the private `PARAM_READ_KEY` and Google Gemini API keys.
   - Built-in rate limiting (60 requests/minute/IP), CORS handling, and health telemetry.
   - Resilient circuit breaker & automatic fallback system preventing downtime during Render free-tier cold starts.
   - Real-time AI Answer & Evidence Synthesis using Google Gemini (`gemini-3.6-flash` and `gemini-3.5-flash-lite`).
2. **React 19 / Vite Frontend Studio (`/frontend`)**:
   - Modern glassmorphic search interface supporting responsive layouts and Dark/Light themes.
   - Instant keyboard hotkeys (`/`), search query history, top_k slider, and scope selection (`text`, `image`, `all`).
   - High-fidelity telemetry cards showing Reciprocal Rank Fusion (RRF) scores, Dense/Lexical branch breakdown, exhibit locators, and raw JSON modal.
   - Integrated AI Answer panel with real-time markdown synthesis, copy-to-clipboard, and one-click retry capabilities.
3. **Cloud Production Deployments**:
   - Deployed live on Netlify (Frontend) and Render (Backend Gateway) with automated CI/CD.

---

## 2. System Architecture Diagram

```
+-------------------------------------------------------------------------+
|                        Client Web Browser                               |
|          (Netlify: https://param-search-studio.netlify.app)             |
+------------------------------------+------------------------------------+
                                     |
                                     | HTTPS (REST / JSON)
                                     v
+-------------------------------------------------------------------------+
|                     Node.js / Express API Gateway                       |
|         (Render: https://param-retrieval-backend.onrender.com)          |
|                                                                         |
|  * Port: 5000 / 10000        * Rate Limiter (60 req/min)                |
|  * Private Token Vault       * Circuit Breaker & Telemetry Cache        |
|  * Upstream Health Monitor   * Dynamic Multi-Model LLM Fallback         |
+-------------------+---------------------------------+-------------------+
                    |                                 |
  POST /v1/retrieve | (Bearer Auth)                   | POST /generateContent
                    v                                 v
+------------------------------------+   +--------------------------------+
|      Param Retrieval Service       |   |       Google Gemini API        |
|     (Python / FastAPI on Render)   |   |   (models/gemini-3.6-flash &   |
|                                    |   |   models/gemini-3.5-flash-lite)|
|  * FastEmbed (BGE-Small / BM25)    |   |                                |
|  * Qdrant Vector Cloud             |   |  * Multi-paragraph synthesis   |
|  * Supabase PostgreSQL State DB    |   |  * Bold metric highlighting    |
+------------------------------------+   +--------------------------------+
```

---

## 3. Live Environments & Deployments

| Component | Service Role | Hosting Provider | Live URL | Tracking Branch |
| :--- | :--- | :--- | :--- | :--- |
| **Frontend Studio** | Search & Analytics Web UI | **Netlify** | [https://param-search-studio.netlify.app](https://param-search-studio.netlify.app) | `feature/web-app` |
| **Backend Gateway** | Proxy, Security, Gemini RAG | **Render** | [https://param-retrieval-backend.onrender.com](https://param-retrieval-backend.onrender.com) | `feature/web-app` |
| **Upstream Retrieval Engine** | Hybrid Dense + Lexical Search | **Render** | [https://param-retrieval.onrender.com](https://param-retrieval.onrender.com) | `retrieval-deployment` |

---

## 4. Key Engineering Challenges Solved

### A. Protecting Private Retrieval Tokens
- **Problem**: Directly calling the retrieval engine from browser JavaScript would expose the private `PARAM_READ_KEY` in browser Network tabs.
- **Solution**: Built an Express gateway that holds secrets server-side in environment variables and forwards queries under authorization headers.

### B. Upstream Render 502 Bad Gateway / Cold-Start Handling
- **Problem**: Render's free tier spins down after 15 minutes of inactivity and has a 512 MB memory limit. When FastEmbed loads ONNX models, memory spikes cause temporary 502 Bad Gateway responses.
- **Solution**: Implemented an automated **Circuit Breaker** (`backend/telemetryFallback.js`):
  - When upstream is healthy: Serves live Qdrant records with `_is_live: true`.
  - When upstream returns 502 or times out: Instantly returns authentic indexed telemetry records from `engagement-sessions-2026-09-15.csv` with `_is_live: false` and a polite status banner.
  - Result: **The web application never crashes with an error screen.**

### C. Gemini Model Evolution & High-Demand Multi-Model Fallback
- **Problem**: Earlier Gemini models (like `gemini-1.5-flash`) were retired in API v1beta, and bleeding-edge models like `gemini-3.6-flash` occasionally encounter spikes in demand (`503 Service Unavailable`).
- **Solution**: Built a multi-model fallback cascade in `backend/server.js`:
  $$\text{models/gemini-3.6-flash} \longrightarrow \text{models/gemini-3.5-flash-lite}$$
  - Added an automated deprecation filter that rejects textual deprecation warnings.
  - Expanded generation limits to **2,048 tokens** with **0.25 temperature** to ensure complete sentences with full metrics.

### D. Native Node.js Body Stream Double-Read Fix
- **Problem**: In Node's native `fetch` (undici), attempting `res.text()` after a failed `res.json()` caused `TypeError: Body is unusable: Body has already been read`.
- **Solution**: The backend now always reads `await res.text()` once, safely parsing via `JSON.parse()`.

---

## 5. Local Setup & Teammate Quick-Start Guide

### Prerequisites
- **Node.js**: v18.0.0 or later (Node 20+ recommended)
- **Git**
- **Google AI Studio API Key** (Free from [aistudio.google.com](https://aistudio.google.com/))

### Step 1: Clone Repository & Switch Branch
```bash
git clone https://github.com/Mahesh748349/Param.git
cd Param
git checkout feature/web-app
```

### Step 2: Install Dependencies
```bash
# Install root script runner (concurrently)
npm install

# Install backend dependencies (express, cors, dotenv, express-rate-limit)
npm install --prefix backend

# Install frontend dependencies (react, vite, lucide-react)
npm install --prefix frontend
```

### Step 3: Configure Environment Variables
Create a file at `backend/.env` containing:
```env
PORT=5000
PARAM_SERVICE_URL=https://param-retrieval.onrender.com
PARAM_READ_KEY=ad09e77a80b24925cefbdf85f2d568c8
GEMINI_API_KEY=your_gemini_api_key_here
ENABLE_MOCK_FALLBACK=true
```

*(Note: `backend/.env` is strictly excluded from Git via `.gitignore` to prevent credential leakage).*

### Step 4: Run the Development Stack
Run both servers simultaneously with a single root command:
```bash
npm run dev
```

- **Frontend Studio**: `http://localhost:3000`
- **Backend API Gateway**: `http://localhost:5000`
- **Health Verification**: `http://localhost:5000/api/health`

---

## 6. Directory Structure Overview

```text
param-retrival-frontend/
├── PROJECT_HANDOVER.md          # This complete handover guide
├── package.json                 # Root script runner (concurrently dev scripts)
├── .gitignore                   # Excludes .env, node_modules, and dist bundles
│
├── backend/                     # Node.js Express Gateway
│   ├── server.js                # API routes: /api/health, /api/retrieve, /api/synthesize
│   ├── telemetryFallback.js     # Ground-truth circuit breaker & fallback search
│   ├── package.json             # Backend dependencies
│   ├── .env.example             # Template environment file
│   └── .env                     # Private secrets (ignored by git)
│
├── frontend/                    # React 19 + Vite Search Studio
│   ├── netlify.toml             # SPA redirect configuration for Netlify
│   ├── index.html               # Typography & metadata
│   ├── vite.config.js           # Development proxy (/api -> localhost:5000)
│   ├── package.json             # Frontend dependencies
│   └── src/
│       ├── App.jsx              # Main search state, history, and theme management
│       ├── App.css              # Custom styling, glassmorphic themes, and animations
│       ├── index.css            # Base design system & theme variables
│       ├── api.js               # Client fetch wrappers for backend endpoints
│       └── components/
│           ├── Header.jsx       # Connectivity status dot & latency indicator
│           ├── SearchBar.jsx    # Hotkey '/', suggestion chips, top_k slider
│           ├── ResultCard.jsx   # RRF badge, Dense/BM25 rank pills, exhibit attributes
│           ├── ResultStats.jsx  # Metrics summary & filter buttons
│           ├── SynthesisPanel.jsx # AI Answer generator with copy and retry buttons
│           ├── StatusBanner.jsx # Non-blocking cold-start notice banner
│           └── RawJsonModal.jsx # Developer inspection modal
│
└── retrieval_service/           # Python Hybrid Engine (FastAPI + Qdrant reference)
    ├── pyproject.toml           # Python package definition
    ├── deploy.py                # Plain Python deployment entry point
    └── src/param_retrieval/     # Core retrieval algorithms, embeddings & state
```

---

## 7. Recommended Next Steps for Teammates

1. **Blob Image Serving**:
   - Currently, retrieval returns private `blob_id` hashes. Add an image streaming proxy endpoint in `backend/server.js` (`GET /api/blobs/:id`) to stream visual artifacts directly to the UI.
2. **Multi-Dataset Support**:
   - If other CSV telemetry files or image collections are indexed, update `SearchBar.jsx` with a dataset selection dropdown.
3. **Exporting Summaries**:
   - Add a "Download Report" button (exporting search evidence and Gemini synthesis as Markdown or PDF).
4. **Upstream RAM Provisioning**:
   - When moving out of free tiers, scale the `param-retrieval` Render instance to 1 GB or 2 GB RAM to prevent FastEmbed ONNX runtime restarts.
