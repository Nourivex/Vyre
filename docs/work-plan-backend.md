````markdown
# Rencana Kerja Backend Vyre (SQLite, Desktop)

Ringkasan singkat  
Vyre dirancang sebagai aplikasi desktop (Tauri) dengan backend lokal yang tidak membutuhkan dependensi eksternal untuk pengguna akhir. Storage primer adalah SQLite file di `%APPDATA%/Vyre/vyre.db`. Vector storage utama menggunakan `sqlite-vec` (ANN bila tersedia) dengan fallback linear search. Embedding lokal disediakan oleh `ollama` (default) dan `llamacpp` (opsional); OpenAI dibiarkan sebagai opsi konfigurabel.

## 1. High-level architecture (ASCII)
```
+----------------------+      +---------------------+      +--------------------+
|  Frontend (Tauri)    | <--> |  Local API Server   | <--> |  Workers/Services  |
|  (React)             |      |  (Node/TS, Fastify) |      |  - ingest-worker   |
+----------------------+      +---------------------+      |  - embed-worker    |
         |                              |                  |  - index-worker    |
         v                              v                  +--------------------+
                                    Storage
                              - %APPDATA%/Vyre/vyre.db
                              - %APPDATA%/Vyre/vectors/<collection>/
```

## 2. API surface (rute & contoh payload)
Semua endpoints JSON; server bind ke `127.0.0.1` secara default.

- POST /ingest  
  Deskripsi: terima upload/URL/teks → buat `documents` + `chunks` → enqueue job embed/index.
  Contoh request:

  ```json
  {
    "collection_id":"my-collection",
    "source":"upload",
    "attachments":[{"filename":"doc.pdf","path":"/tmp/abc.pdf"}],
    "options":{"chunk_size":1000,"overlap":200,"embed_model":"ollama"}
  }
  ```

  Response:

  ```json
  {"job_id":"job_123","status":"queued","collection_id":"my-collection"}
  ```

- POST /search
  Deskripsi: cari top-K chunk relevan (tanpa generation).
  Request:

  ```json
  {"collection_id":"my-collection","query":"apa itu regresi?","top_k":5}
  ```

  Response:

  ```json
  {"results":[{"chunk_id":"c1","text":"...","score":0.92}, ...]}
  ```

- POST /chat
  Deskripsi: lakukan retrieval (opsional), gabungkan konteks, panggil LLM lokal (`ollama`/`llamacpp`) atau cloud.
  Request:

  ```json
  {"collection_id":"my-collection","messages":[{"role":"user","content":"Ringkas bab 2"}],"retrieve":true,"top_k":4,"model":"ollama"}
  ```

  Response (sync):

  ```json
  {"id":"chat_1","response":"Ringkasan bab 2: ...","sources":[{"chunk_id":"c1","score":0.9}]}
  ```

- GET /health
  Response:

  ```json
  {"status":"ok","sqlite":"connected","vector_adapter":"sqlite-vec"}
  ```

Auth notes:
- Desktop: default tidak memaksa auth — lokal-only, bind ke `127.0.0.1`. Jika user ingin remote access, mereka harus mengaktifkannya dan mengkonfigurasi token/JWT.
- Remote access (opsional): TLS + JWT.

## 3. Service layout (direktori)
services/
- api/                -> HTTP server, route handlers, request validation
- db/                 -> Migrations, DB layer, queries
- ingest/             -> parsing, chunking, document manager
- embeddings/         -> adapters: `ollama`, `llamacpp`, `openai`(opsional)
- vector/             -> adapters: `sqlite-vec`, `faiss`(fallback opsional)
- queue/              -> SQLite-backed queue & job manager
- workers/            -> Worker runners (ingest, embed, index)
- utils/              -> logging, config, path helpers

Contoh file to implement (skeleton):
- `services/api/index.ts`
- `services/db/migrations/*.sql`
- `services/vector/adapter_sqlite_vec.ts`
- `services/embeddings/adapter_ollama.ts`
- `services/queue/sqlite_queue.ts`
- `services/workers/ingest_worker.ts`

## 4. Database schema (SQLite)
Gunakan WAL mode. Tipe kolom sederhana; simpan JSON di `TEXT` bila perlu.

collections
- id INTEGER PRIMARY KEY
- collection_id TEXT UNIQUE
- name TEXT
- description TEXT
- storage_path TEXT
- adapter TEXT
- created_at TEXT
- updated_at TEXT

documents
- id INTEGER PRIMARY KEY
- doc_id TEXT UNIQUE
- collection_id TEXT
- filename TEXT
- mime TEXT
- source TEXT
- size INTEGER
- metadata TEXT
- created_at TEXT

chunks
- id INTEGER PRIMARY KEY
- chunk_id TEXT UNIQUE
- doc_id TEXT
- collection_id TEXT
- text TEXT
- start_pos INTEGER
- end_pos INTEGER
- tokens INTEGER
- metadata TEXT
- created_at TEXT

embeddings
- id INTEGER PRIMARY KEY
- chunk_id TEXT
- collection_id TEXT
- vector BLOB
- dim INTEGER
- model TEXT
- created_at TEXT

jobs
- id INTEGER PRIMARY KEY
- job_id TEXT UNIQUE
- type TEXT
- payload TEXT
- status TEXT
- attempts INTEGER
- last_error TEXT
- created_at TEXT
- updated_at TEXT

Schema notes:
- Use WAL mode for concurrent readers/writers.
- Store `vector` as BLOB float32 for performance; or use external flat files and store pointers.

## 5. Vector Store Adapter: `sqlite-vec`
- Responsibilities: create_collection, insert_embeddings, search, delete, persist index.
- Storage path: `%APPDATA%/Vyre/vector/<collection_id>/` containing index files and optional flat-file vectors.
- Search steps:
  1. If ANN index exists, perform ANN search.
  2. Fallback: linear scan embeddings with cosine similarity.

FAISS fallback note: For heavy-duty or server migration, provide optional `faiss` adapter.

## 6. Job Queue / Worker Design
### Desktop (recommended): SQLite-backed queue
- Use `jobs` table as queue; worker reserves jobs via atomic UPDATE.
- Worker types: ingest, embed, index.
- Concurrency via small in-process threadpool.

### Simpler in-process queue (optional)
- In-memory queue with periodic checkpoint to `jobs` table.

### Dev/Server option: Redis + Bull
- Optional for developers; not required for end-user desktop build.

## 7. Packaging, Migrations, Backup & Upgrade Path
### Packaging DB files
- On first run, create DB at `%APPDATA%/Vyre/vyre.db` using migration runner.

### Migrations
- Store SQL in `services/db/migrations/` and track applied ones.

### Backup / Export
- Provide export collection (ZIP) endpoint + UI; save to `%APPDATA%/Vyre/backups/`.
- Auto-backup disabled by default; user can enable in settings.

### Upgrade path to server
1. Export collection (vectors + metadata).
2. Import metadata to Postgres.
3. Import vectors to Qdrant/FAISS.

## 8. Security & Auth Recommendations
### Local Desktop
- Default: no enforced auth (bind `127.0.0.1`).
- Opt-in DB encryption (user passphrase) available in settings.

### Server Deployment (optional)
- Require TLS, JWT/OAuth2, RBAC for admin operations.

## 9. Dev docker-compose (developer only)
```yaml
version: '3.8'
services:
  redis:
    image: redis:7
    ports:
      - "6379:6379"
  qdrant:
    image: qdrant/qdrant
    ports:
      - "6333:6333"
```

## 10. Estimated Implementation Tasks & Effort
1. Scaffolding services + API skeleton — 6h
2. SQLite schema + migration runner — 4h
3. Implement collections/documents/chunks CRUD — 6h
4. Chunking & parser integration — 8h
5. Embedding adapter (`ollama`, `llamacpp` stub) — 12h
6. `sqlite-vec` adapter (insert/search) — 18h
7. SQLite-backed queue + workers — 14h
8. API endpoints `/ingest` `/search` `/chat` `/health` — 8h
9. Backup/export + CLI migrate — 6h
10. Tests & QA — 12h
Total ≈ 96-104h

## 11. Runbook singkat
- DB: `%APPDATA%/Vyre/vyre.db`
- Start dev: `NODE_ENV=development node services/api/index.js`
- Reindex: `node services/workers/reindex.js --collection my-collection`

## Next steps
- Implement skeleton files under `services/` (API, embeddings, vector, queue).
- Add migration scripts and initial DB bootstrap.

````
