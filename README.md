# Vyre — Local AI App (backend + UI)

Vyre is a local-first AI application: a backend for ingestion, embeddings and vector search, plus a browser-based UI for chat, history, agent selection, and knowledge-base management.

## What is this
- Vyre is a development-focused backend that lets you ingest text, build embeddings, perform vector search, and run model-backed chat locally using Ollama.
- Built for privacy and fast experimentation — everything can run on your machine with SQLite storage and local model runtimes.
- Vyre now includes a static frontend served from `services/public/app` which provides a Chat UI, conversation history sidebar, Agent selector (personas), Ollama status, and knowledge-base (collections) controls.
 - The root URL (`/`) serves the interactive app; static assets are under `/static/*`.

## Goals
- Provide a minimal, secure local stack for RAG (retrieval-augmented generation).
- Simple API for ingesting text, searching vectors, and chatting with retrieved context.
- Work well with Ollama (CLI or HTTP) and include fallbacks for compatibility.

## Current status (progress)
- Core features implemented:
  - Ingestion pipeline + SQLite-backed queue and workers
  - Embeddings via Ollama adapter
  - Vector store using SQLite
  - `/chat` endpoint with retrieval + prompt building
  - Robust `call_model` helper: HTTP first, CLI fallback, stdin support
  - OpenAPI (`/openapi.json`), ReDoc (`/docs`) and interactive Swagger UI (`/swagger`)
  - Smoke & integration tests; CORS for browser Try-it
   - Static browser UI (Chat + sidebar) served from `services/public/app`
- Remaining / optional:
  - Additional robust production configs (persisted secrets, external vector stores)
  - CI model-run steps require secrets for running live model smoke tests

## Quick start (developer)
Prereqs: Node.js, `npm`/`npx`, and optionally `ollama` installed locally.

1. Install dependencies (from repo root):

```bash
cd services
npm install
```

2. Run migrations and start dev server:

```bash
# start server (runs migrations + workers)
npx ts-node dev-runner.ts
```

Server defaults to http://127.0.0.1:3000

4. Open the app UI in your browser:

```
http://127.0.0.1:3000
```

The UI includes:
- Conversation list (sidebar) with search and +New
- Agent selector (persona) which maps to a model for new conversations
- Ollama status indicator and model list
- Knowledge Base / Collections selector with Upload button to POST to `/ingest`

3. Try endpoints
- Open API docs: http://127.0.0.1:3000/docs
- Swagger UI (Try-it): http://127.0.0.1:3000/swagger

Example chat call (PowerShell):

```powershell
$json = '{"role":"user","content":"Halo"}'
Invoke-RestMethod -Uri http://127.0.0.1:3000/chat -Method Post -Body $json -ContentType 'application/json'
```

## Environment variables
- `OLLAMA_MODEL` — default model id (e.g. `gemma3:4b`)
- `OLLAMA_CMD` — path to `ollama` binary (default `ollama`)
- `OLLAMA_HTTP` — optional Ollama HTTP server URL (default `http://127.0.0.1:11434/run`)
- `DISABLE_MODEL_CALL=1` — disable real model invocation (useful for deterministic tests)

## Tests
Run tests from `services` folder:

```bash
# unit/integration tests
npx ts-node test/vector-unit.test.ts
npx ts-node test/search-integration.test.ts
# smoke test
npx ts-node test/smoke-test.ts
# chat integration (deterministic):
set DISABLE_MODEL_CALL=1&& npx ts-node test/chat-integration.test.ts
```

## Files of interest
- `services/api/index.ts` — main HTTP API & docs
 - `services/api/index.ts` — main HTTP API & docs (also serves static UI under `/`)
 - `services/public/app` — static frontend (HTML/CSS/JS) for the interactive chat UI
- `services/tools/call_model.ts` — model caller (HTTP + CLI + stdin fallback)
- `services/embeddings/adapter_ollama.ts` — embedding adapter
- `services/vector/adapter_sqlite_vec.ts` — vector store
- `services/db/migrations` — SQL migrations
- `services/workers` — ingest/embed workers

## Contributing
- Make small, reviewable changes. Run tests and the smoke test before opening PRs.

## License & attribution
This project is developer tooling; add your preferred license when ready.

---
If you want, I can also:
- Commit this README and open a PR,
- Add a short `docs/quickstart.md` with screenshots and Swagger usage,
- Or update the repo `package.json` scripts for easier developer commands.

Which should I do next?