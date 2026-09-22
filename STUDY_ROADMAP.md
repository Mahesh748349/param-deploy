# 📚 Param Retrieval System — Complete Study Roadmap

> This guide lists every topic you need to master to fully understand, maintain,
> and extend the Param project on your own — without AI assistance.
> Topics are grouped by layer of the stack, ordered from foundational to advanced.

---

## 🗂️ TABLE OF CONTENTS

1. [Web Fundamentals](#1-web-fundamentals)
2. [JavaScript (Core Language)](#2-javascript-core-language)
3. [React & Frontend Framework](#3-react--frontend-framework)
4. [Vite (Build Tool)](#4-vite-build-tool)
5. [CSS & UI Design](#5-css--ui-design)
6. [Node.js & Express (Backend)](#6-nodejs--express-backend)
7. [REST APIs & HTTP](#7-rest-apis--http)
8. [Authentication & Security](#8-authentication--security)
9. [Supabase](#9-supabase)
10. [Vector Search & Retrieval Systems](#10-vector-search--retrieval-systems)
11. [Python & the Retrieval Engine](#11-python--the-retrieval-engine)
12. [Databases & Data Formats](#12-databases--data-formats)
13. [AI / LLM Integration (Gemini)](#13-ai--llm-integration-gemini)
14. [Git & Version Control](#14-git--version-control)
15. [Deployment & DevOps](#15-deployment--devops)
16. [Environment Variables & Config Management](#16-environment-variables--config-management)
17. [Debugging & Problem Solving](#17-debugging--problem-solving)
18. [Software Architecture Concepts](#18-software-architecture-concepts)

---

## 1. Web Fundamentals

> The absolute base. Everything runs on top of this.

| Topic | What to Learn |
|---|---|
| **HTML5** | Semantic tags (`<main>`, `<header>`, `<footer>`, `<section>`), forms, accessibility attributes (`aria-*`), `<meta>` tags for SEO |
| **How Browsers Work** | Request → DNS → TCP → HTTP → Parse HTML → Render DOM → Run JS |
| **DOM** | What the Document Object Model is, how JS manipulates it |
| **HTTP basics** | GET vs POST, status codes (200, 400, 401, 403, 404, 500, 503), headers, request body |
| **CORS** | Why it exists, what `Access-Control-Allow-Origin` does, how the backend configures it |
| **JSON** | Syntax, `JSON.parse()`, `JSON.stringify()`, nested objects/arrays |

**Resources**: MDN Web Docs (mdn.io), "How browsers work" article by Tali Garsiel

---

## 2. JavaScript (Core Language)

> The language running on both your frontend AND backend (Node.js).

| Topic | What to Learn |
|---|---|
| **Variables & Scope** | `var`, `let`, `const`, block scope, closures |
| **Functions** | Arrow functions, default parameters, rest/spread (`...`), callbacks |
| **Async Programming** | `Promise`, `async/await`, `try/catch`, `AbortController` (used in server.js!) |
| **Array Methods** | `.map()`, `.filter()`, `.reduce()`, `.find()`, `.slice()`, `.sort()` |
| **Destructuring** | `const { query, top_k } = req.body` — used everywhere |
| **Modules (ES Modules)** | `import` / `export`, difference from `require()` (CommonJS) |
| **Template Literals** | Backtick strings with `${}` interpolation |
| **Optional Chaining** | `data?.candidates?.[0]?.content` — used in Gemini response parsing |
| **Nullish Coalescing** | `value ?? 'default'` |
| **`fetch()` API** | Making HTTP requests from JS, handling `Response`, streaming body |
| **`localStorage`** | Persisting data in browser (used for theme + search history) |
| **Error handling** | `try/catch/finally`, custom Error messages, `err.name === 'AbortError'` |
| **`setTimeout` / `clearTimeout`** | Used for the warm-up spinner and cold-start detection |

**Resources**: javascript.info (best free resource), Eloquent JavaScript (free book)

---

## 3. React & Frontend Framework

> The entire frontend UI is React. This is the most important frontend topic.

| Topic | What to Learn |
|---|---|
| **JSX** | HTML-like syntax inside JS, how Babel/Vite compiles it |
| **Components** | Functional components, props, children |
| **State** | `useState` hook — when and why to use it |
| **Effects** | `useEffect` — running code on mount, on state change, cleanup functions |
| **Context API** | `createContext`, `useContext`, `Provider` — this is how `AuthContext` works |
| **`useCallback`** | Memoizing functions to prevent infinite re-render loops |
| **Controlled Inputs** | `value={query}` + `onChange` — how form inputs stay in sync with state |
| **Conditional Rendering** | `{user && <Component />}`, ternary `? :` in JSX |
| **Lists & Keys** | `{results.map((item, i) => <Card key={i} />)}` |
| **Event Handling** | `onClick`, `onSubmit`, `onChange`, preventing default behavior |
| **Lifting State Up** | Why parent components hold state that children need to share |
| **Props drilling** | Passing data down, when to use Context instead |
| **Component lifecycle** | Mount → Update → Unmount, why cleanup matters |

**Resources**: react.dev (official docs), Scrimba React course

---

## 4. Vite (Build Tool)

> Vite bundles and serves your React app. You used `npm run dev` and `npm run build`.

| Topic | What to Learn |
|---|---|
| **What a bundler does** | Takes hundreds of JS files → combines into one optimised bundle |
| **`vite.config.js`** | How to configure dev server port, proxies, aliases |
| **`.env` files** | `VITE_` prefix required for env vars to be exposed to browser code |
| **`npm run dev` vs `npm run build`** | Dev = hot reload server, Build = static files for deployment |
| **`dist/` folder** | What gets produced by `npm run build`, what Netlify deploys |
| **`_redirects` file** | Why SPAs need `/* /index.html 200` for client-side routing |

**Resources**: vitejs.dev (official docs)

---

## 5. CSS & UI Design

> The entire visual design of the site — glassmorphism, dark mode, animations.

| Topic | What to Learn |
|---|---|
| **CSS Custom Properties** | `--accent-primary: #6366f1` — how the theme system works |
| **`[data-theme]` selector** | How dark/light mode switching is implemented without JS class toggling |
| **Flexbox** | `display: flex`, `justify-content`, `align-items`, `gap` — used in every component |
| **CSS Grid** | `display: grid`, `grid-template-columns`, for card layouts |
| **`backdrop-filter`** | `backdrop-filter: blur(16px)` — the glassmorphism effect |
| **`rgba()` & transparency** | Used for card backgrounds, borders, overlays |
| **Transitions & animations** | `transition: all 250ms ease`, `@keyframes`, `animation` |
| **Pseudo-elements** | `::before`, `::after` — used for the ambient background glow |
| **Media queries** | `@media (max-width: 768px)` for mobile responsiveness |
| **CSS specificity** | Why some styles override others, when to use `!important` (avoid it) |
| **Scrollbar styling** | `::-webkit-scrollbar` — custom scrollbars |
| **Google Fonts** | How to import and use web fonts (`@import` or `<link>`) |

**Resources**: css-tricks.com, web.dev/learn/css

---

## 6. Node.js & Express (Backend)

> The backend proxy server in `backend/server.js` is built with these.

| Topic | What to Learn |
|---|---|
| **What Node.js is** | V8 JS engine running server-side, event loop, non-blocking I/O |
| **`npm` & `package.json`** | Installing packages, `dependencies` vs `devDependencies`, scripts |
| **ES Modules in Node** | `"type": "module"` in package.json, `import` instead of `require` |
| **Express.js basics** | `app.get()`, `app.post()`, `req`, `res`, `next`, middleware |
| **Middleware** | `app.use()`, `express.json()`, request logging, `cors()` |
| **Rate Limiting** | `express-rate-limit` — prevents API abuse |
| **CORS middleware** | `cors()` configuration, allowed origins |
| **`fetch()` in Node** | Node 18+ has built-in fetch — used to call the upstream retrieval service |
| **`AbortController`** | Implementing request timeouts (the 55s cold-start timeout) |
| **Environment variables** | `process.env.PORT`, `dotenv.config()`, `.env` files |
| **Error handling in Express** | `try/catch` in async routes, `res.status(503).json({...})` |
| **`app.listen(PORT)`** | Starting the server, binding to a port |

**Resources**: expressjs.com, nodejs.org/en/docs

---

## 7. REST APIs & HTTP

> Understanding what the backend exposes and how it talks to the retrieval engine.

| Topic | What to Learn |
|---|---|
| **REST principles** | Resources, endpoints, HTTP verbs (GET/POST/PUT/DELETE) |
| **Request anatomy** | URL, method, headers, body (JSON) |
| **Response anatomy** | Status code, headers, body |
| **Status codes** | 200, 400, 401, 403, 503 — what each means |
| **`Authorization` header** | `Bearer <token>` pattern — used to send `PARAM_READ_KEY` |
| **`Content-Type` header** | `application/json` format declaration |
| **API versioning** | Why the retrieval service uses `/v1/retrieve` |
| **Testing APIs** | Postman, Insomnia, or `curl` to send requests manually |
| **Rate limiting** | What it is, why APIs need it, how to handle `429 Too Many Requests` |

**Resources**: restfulapi.net, Postman Learning Center

---

## 8. Authentication & Security

> The entire login/signup system, JWT tokens, and security hardening.

| Topic | What to Learn |
|---|---|
| **Authentication vs Authorization** | AuthN = who are you, AuthZ = what can you do |
| **Email/Password auth flow** | Sign up → email verification → sign in → session token |
| **JWT (JSON Web Tokens)** | Header.Payload.Signature structure, `exp` and `iat` fields |
| **Email verification** | Why it matters, how Supabase sends verification links |
| **Password reset flow** | `resetPasswordForEmail()`, magic links, redirect URLs |
| **CORS security** | Why `ALLOWED_ORIGINS` is checked on the backend |
| **Rate limiting** | Protecting endpoints from brute force |
| **Environment secrets** | Never hardcode API keys, keep them out of Git |
| **`Authorization: Bearer` header** | How the frontend passes JWT with every API request |
| **`onAuthStateChange`** | Supabase's session listener — how the app reacts to login/logout |

**Resources**: auth0.com/learn, jwt.io (decode/inspect JWTs)

---

## 9. Supabase

> The backend-as-a-service handling auth for this project.

| Topic | What to Learn |
|---|---|
| **What Supabase is** | Open-source Firebase alternative — Auth, Database, Storage |
| **Supabase Auth** | `signUp()`, `signInWithPassword()`, `signOut()`, `resetPasswordForEmail()` |
| **`onAuthStateChange`** | Subscribing to auth events (SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED) |
| **Anon Key vs Service Role Key** | Anon key = safe for browser; service role key = secret, server only |
| **Supabase Dashboard** | Setting Site URL and Redirect URLs for email verification |
| **Row Level Security (RLS)** | Database-level rules — who can read/write which rows |
| **Supabase Client setup** | `createClient(url, anonKey)` — the `supabaseClient.js` pattern |

**Resources**: supabase.com/docs

---

## 10. Vector Search & Retrieval Systems

> The core intelligence of the Param project — how semantic search works.

| Topic | What to Learn |
|---|---|
| **Semantic search** | Finding results by *meaning*, not just keyword matching |
| **Embeddings / Vectors** | Text → array of numbers that captures meaning |
| **Cosine similarity** | How two vectors are compared for semantic closeness |
| **Qdrant basics** | Collections, points, payloads, filters, search API |
| **BM25 (lexical search)** | Traditional keyword matching with term frequency weighting |
| **Hybrid search (RRF)** | Dense (vector) + BM25 combined via Reciprocal Rank Fusion |
| **Reranking** | Cross-encoder model re-scoring top-k results for higher accuracy |
| **`top_k` parameter** | How many candidates to retrieve |
| **Metadata filtering** | `{"exhibit": "Kinetic Bug"}` — filtering results by payload fields |
| **Score types** | Dense, lexical, RRF, reranker — what each score means |
| **Source provenance** | `source` (filename) + `locator` (row number) — tracing results back to data |

**Resources**: qdrant.tech/documentation, Towards Data Science "RAG" articles

---

## 11. Python & the Retrieval Engine

> The upstream service at `param-retrieval.onrender.com` is Python.

| Topic | What to Learn |
|---|---|
| **Python basics** | Variables, functions, classes, list comprehensions, f-strings |
| **FastAPI / Flask** | Building REST APIs in Python |
| **`sentence-transformers`** | Library for generating text embeddings |
| **`qdrant-client`** | Python client for querying Qdrant |
| **`rank_bm25`** | BM25 keyword search implementation |
| **Pydantic** | Data validation models (FastAPI request/response schemas) |
| **`uvicorn`** | ASGI server that runs FastAPI in production |
| **`pandas`** | Reading CSV/Excel files — `pd.read_csv()` and `pd.read_excel()` |
| **Virtual environments** | `venv`, `pip install -r requirements.txt` |
| **`requirements.txt`** | Python's equivalent of `package.json` |

**Resources**: fastapi.tiangolo.com, Real Python tutorials (realpython.com)

---

## 12. Databases & Data Formats

> The actual data the system retrieves from.

| Topic | What to Learn |
|---|---|
| **CSV files** | Comma-separated values, headers, row indexing |
| **Excel / XLSX** | Multiple sheets, reading with pandas/openpyxl |
| **PDF text extraction** | PyMuPDF / pdfplumber — parsing PDFs into text chunks |
| **Data cleaning** | Missing values, inconsistent column names, encoding issues |
| **Indexing pipeline** | Read file → chunk → embed → upsert to Qdrant |
| **Qdrant collections** | One point per chunk, with payload metadata |
| **Metadata schema design** | `exhibit`, `source`, `row`, `sheet` fields stored with vectors |

---

## 13. AI / LLM Integration (Gemini)

> The synthesis/RAG feature that summarises retrieved results.

| Topic | What to Learn |
|---|---|
| **What is RAG** | Retrieve facts, then ask LLM to summarise — Retrieval Augmented Generation |
| **Gemini API** | `generateContent` endpoint, model names, request/response format |
| **API key management** | aistudio.google.com, keeping keys in environment variables |
| **Prompt engineering** | System instructions, user messages, how structure affects output |
| **`generationConfig`** | `temperature` (creativity 0-1), `maxOutputTokens` (length) |
| **Model fallback strategy** | Trying model A → model B on 429/503 errors |
| **Token limits** | Why you can't send unlimited context to an LLM |
| **Structured context** | Formatting retrieved chunks into the prompt clearly |
| **LLM output parsing** | `candidates[0].content.parts[0].text` response structure |

**Resources**: ai.google.dev/gemini-api/docs, promptingguide.ai

---

## 14. Git & Version Control

> Every change was tracked with Git and pushed to GitHub.

| Topic | What to Learn |
|---|---|
| **Core commands** | `git add`, `git commit`, `git push`, `git pull`, `git status`, `git log` |
| **Branches** | `git checkout -b feature/branch`, why `feature/web-app` branch was used |
| **`.gitignore`** | Excluding `node_modules/`, `dist/`, `.env` |
| **Remote repos** | `git remote`, `git push origin branch-name` |
| **Pull Requests** | Opening PRs on GitHub, reviewing diffs, merging |
| **Merge conflicts** | What they are, how to resolve them |
| **`git diff`** | Seeing exactly what changed in a file |
| **Conventional commits** | `feat:`, `fix:`, `chore:`, `docs:` prefix format |
| **Forking** | Fork vs clone, upstream vs origin |

**Resources**: learngitbranching.js.org (interactive), git-scm.com/book (free)

---

## 15. Deployment & DevOps

> How the project runs live for real users.

| Topic | What to Learn |
|---|---|
| **Static site hosting** | Netlify — Git-connected deployments for React/Vite apps |
| **Netlify config** | Build command, publish directory (`frontend/dist`), `_redirects` |
| **Netlify env variables** | Setting `VITE_` vars in the Netlify dashboard |
| **Backend hosting (Render)** | Free-tier web services, auto-deploy from Git |
| **Render cold starts** | Free tier sleeps after 15 min — why the 55s timeout fix was needed |
| **Build process** | `npm run build` → Vite → `dist/` folder → Netlify serves it |
| **CI/CD concept** | Auto-deploy when you push to GitHub |
| **HTTPS / TLS** | Why production sites need HTTPS, Netlify handles it automatically |
| **Reading logs** | Render dashboard logs for debugging server errors |

**Resources**: docs.netlify.com, render.com/docs

---

## 16. Environment Variables & Config Management

> The invisible glue that connects all parts of the system securely.

| Topic | What to Learn |
|---|---|
| **What env vars are** | Key-value pairs in the OS/process, not hardcoded in code |
| **`.env` files** | Format, `dotenv` package, why `.env` must be in `.gitignore` |
| **`VITE_` prefix** | Only `VITE_` prefixed vars are exposed to the browser bundle |
| **`process.env` (Node)** | How the backend reads env vars at runtime |
| **`import.meta.env` (Vite)** | How the frontend reads env vars at build time |
| **Production env vars** | Setting them in Render/Netlify dashboard instead of files |
| **Secret rotation** | What to do if an API key is accidentally committed to Git |

---

## 17. Debugging & Problem Solving

> Skills to diagnose issues like the fake-fallback bug we just fixed.

| Topic | What to Learn |
|---|---|
| **Browser DevTools** | Network tab (inspect API calls), Console (JS errors), Application tab (localStorage) |
| **Reading error messages** | Stack traces, HTTP status codes, `err.message` |
| **`console.log` debugging** | Strategic logging at key points |
| **Network tab analysis** | Request URL, request body, response body, status code |
| **`curl` / Postman** | Sending raw HTTP requests to isolate frontend vs backend issues |
| **Render logs** | Reading server stdout in the Render dashboard |
| **Binary search debugging** | Is the bug in the frontend? Backend? Upstream? Isolate each layer |

---

## 18. Software Architecture Concepts

> Understanding *why* the system is designed the way it is.

| Topic | What to Learn |
|---|---|
| **Client-Server model** | Frontend = client, backend = server, retrieval engine = upstream |
| **Proxy pattern** | Why the backend exists (hides API keys from browser, adds rate limiting) |
| **3-tier architecture** | Presentation (React) → Application (Express) → Data (Qdrant + files) |
| **Separation of concerns** | Why auth logic lives in `AuthContext`, not `App.jsx` |
| **API contracts** | Agreed request/response shape between frontend, backend, retrieval |
| **Cold start problem** | Free-tier services that sleep — and how to handle them gracefully |
| **SPA (Single Page Application)** | Why React apps need `_redirects` on Netlify |
| **Environment parity** | Making local dev match production as closely as possible |

---

## 🗓️ SUGGESTED 12-WEEK LEARNING ORDER

```
Week 1-2  :  HTML + CSS + JavaScript basics         (Sections 1, 2, 5)
Week 3-4  :  React fundamentals                     (Section 3)
Week 5    :  Node.js + Express + REST APIs           (Sections 6, 7)
Week 6    :  Git + Deployment                        (Sections 14, 15)
Week 7    :  Authentication + Supabase               (Sections 8, 9)
Week 8    :  Environment config + Architecture       (Sections 16, 18)
Week 9-10 :  Python basics + Vector Search           (Sections 10, 11, 12)
Week 11   :  AI/LLM + Gemini API                    (Section 13)
Week 12   :  Vite deep-dive + Debugging practice    (Sections 4, 17)
```

---

## 🔑 PRIORITY MATRIX

| Priority | Topics |
|---|---|
| 🔴 **Must know first** | JavaScript, React, HTML/CSS, Git, REST APIs |
| 🟠 **Core to this project** | Node.js/Express, Supabase Auth, Deployment (Netlify + Render), Env Vars |
| 🟡 **Makes you understand the retrieval engine** | Vector Search, Qdrant, Hybrid Search, Reranking |
| 🟢 **Advanced / completes the picture** | Python/FastAPI, Gemini RAG, LLM prompt engineering |

---

*Generated for: Param Retrieval System*
*Frontend: React + Vite → Netlify | Backend: Node.js + Express → Render*
*Retrieval Engine: Python + FastAPI + Qdrant → Render | Auth: Supabase*
