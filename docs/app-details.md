# Jan — Detailed Application Overview

Dokumen ini merinci arsitektur, fitur utama, alur RAG (Retrieval-Augmented Generation), komponen/extension/plugin, serta libraries dan dependensi penting yang digunakan dalam proyek.

---

## 1. Ringkasan Arsitektur

- Aplikasi dibangun sebagai monorepo dengan paket utama:
  - `core` (library runtime & types) — [core/package.json](core/package.json)
  - `web-app` (UI) — [web-app/package.json](web-app/package.json)
  - `extensions-web` (web-only extensions) — [extensions-web/package.json](extensions-web/package.json)
  - `extensions/*` (modular extensions seperti RAG, llama.cpp, vector-db)
  - `src-tauri/plugins/*` (native Tauri plugins yang expose API ke Guest) — e.g. vector-db, llamacpp, rag

- Desktop runtime: Tauri (Rust) + frontend React/Vite; banyak fitur native diekspos melalui Tauri plugins.

---

## 2. Komponen Utama & Peran

- `core`
  - Menyediakan tipe, abstraksi, dan API internal.
  - Contoh: `ModelManager` di [core/src/browser/models/manager.ts](core/src/browser/models/manager.ts).
  - Tipe model/engine di [core/src/types](core/src/types).

- `extensions` (plugin system)
  - Setiap extension menambah kapabilitas: inference engines, RAG tools, vector DB, downloader, dll.
  - Contoh implementasi:
    - Llama.cpp engine: [extensions/llamacpp-extension](extensions/llamacpp-extension)
    - RAG tools: [extensions/rag-extension](extensions/rag-extension)
    - Vector DB: [extensions/vector-db-extension](extensions/vector-db-extension)
    - Web Jan provider: [extensions-web/src/jan-provider-web](extensions-web/src/jan-provider-web)

- `src-tauri/plugins`
  - Plugin native meng-handle parsing dokumen, vektor DB, interaksi dengan engine native (llama.cpp), dsb.
  - Contoh: `tauri-plugin-vector-db`, `tauri-plugin-llamacpp`, `tauri-plugin-rag`.

- `web-app`
  - React UI, integrasi state, router, theme, dan interaksi user.

---

## 3. Fitur Utama (Ringkasan Detail)

1. Local AI Models
   - Menjalankan model lokal via llama.cpp (extension + tauri-plugin-llamacpp).
   - Manajemen model (download/pull/import/delete) ditangani oleh extension dan core model interfaces.

2. Cloud Integration
   - Jan backend (remote) berperan sebagai gateway ke OpenAI, Anthropic, Mistral, Groq, dsb.
   - UI/web menggunakan `extensions-web/src/jan-provider-web` untuk berbicara dengan Jan API.

3. Retrieval-Augmented Generation (RAG)
   - Ingest dokumen → chunking → embedding → simpan ke VectorDB → retrieval saat query.
   - Implementasi utama: [extensions/rag-extension](extensions/rag-extension) dan [extensions/vector-db-extension](extensions/vector-db-extension).

4. Model Context Protocol (MCP)
   - Tools dan kemampuan agent (multi-step, tool-calls) dipublikasikan melalui RAG extension dan core MCP hooks.

5. Vector DB (sqlite-vec / ANN)
   - Vector storage/search diimplementasikan sebagai plugin native (tauri-plugin-vector-db).
   - Fallback linear search bila ANN tidak tersedia.

6. File Parsing & Ingestion
   - Parsing dokumen untuk chunking (tauri-plugin-rag-api yang memanggil parser native), chunking disimpan oleh vector-db plugin.

7. Extensible Plugin/Extension System
   - Tambah engine baru (mis. Ollama), tools, atau integrasi cloud hanya dengan membuat extension baru yang extend `AIEngine`.

8. OpenAI-Compatible Local API
   - Jan bisa expose OpenAI-compatible endpoint (localhost:1337) agar app lain konsumsi.

---

## 4. RAG Pipeline — Alur Teknis (Lengkap)

1. **Ingest / Upload**
   - User upload file ke thread.
   - `rag-extension.ingestAttachments` memanggil Vector DB extension untuk membuat collection dan ingest file.
   - Parsing file dilakukan via `tauri-plugin-rag` (API guest: `parseDocument`).

2. **Chunking**
   - Parsed text dipecah menjadi chunk (ukuran dan overlap configurable oleh settings di RAG extension).
   - Chunking dapat dilakukan oleh `vector-db` plugin helper (`chunkText`) atau oleh extension.

3. **Embedding**
   - RAG extension memanggil fungsi embed internal yang pada implementasinya menggunakan engine (default: llamacpp) — lihat `embedTexts()` di [extensions/rag-extension/src/index.ts](extensions/rag-extension/src/index.ts).
   - Implementasi menggunakan `llamacpp-extension` API: `embed(texts)`.

4. **Simpan ke VectorDB**
   - Embedding dan metadata chunk disimpan ke collection khusus per-thread via `tauri-plugin-vector-db`.
   - `vector-db-extension` memanggil `vecdb.insertChunks` (native guest API).

5. **Retrieval pada Query**
   - Saat user mengajukan query, RAG melakukan embed pada query, kemudian `vector-db-extension.searchCollection` untuk mendapatkan top-K chunk relevan (ANN bila tersedia, linear otherwise).
   - RAG menyusun payload `citations` yang berisi chunk + skor.

6. **Augmentasi Prompt & Generation**
   - Chunk ditambahkan ke prompt (inline atau via prompt-template), lalu request dikirim ke engine LLM (lokal/cloud) untuk menghasilkan jawaban.
   - Model menghasilkan jawaban; jika streaming diinginkan, RAG extension/engine menyediakan generator untuk streaming chunks.

7. **Tooling / MCP**
   - RAG mengekspos tools (`LIST_ATTACHMENTS`, `RETRIEVE`, `GET_CHUNKS`) melalui MCP untuk dipanggil oleh agent.

---

## 5. Komunikasi Antar-Komponen (Highlights)

- UI → extensions-web/jan-provider-web → Jan API (remote)
- UI lokal → extension-manager → extension (RAG / LlamaCPP / VectorDB)
- Extension → Tauri plugins (native APIs) via `@janhq/tauri-plugin-*` packages
- Core types & events bus (`events`) digunakan untuk update/notification (ModelEvent, EngineEvent, dsb.)

Referensi kode:
- RAG tools: [extensions/rag-extension/src/index.ts](extensions/rag-extension/src/index.ts)
- Vector DB: [extensions/vector-db-extension/src/index.ts](extensions/vector-db-extension/src/index.ts)
- LlamaCpp extension entry: [extensions/llamacpp-extension/src/index.ts](extensions/llamacpp-extension/src/index.ts)

---

## 6. Cara Menambah Provider / Engine Baru (Ringkas)

1. Buat folder extension baru di `extensions/` (mis: `ollama-extension`).
2. Implement class yang extend `AIEngine` dari `@janhq/core`.
3. Implementasikan method utama: `onLoad`, `get`, `list`, `load`, `unload`, `chat` (atau embed jika perlu).
4. Jika perlu akses native, buat juga `src-tauri/plugins/*` atau gunakan existing Tauri plugin.
5. Registrasi settings dan daftarkan ke UI melalui `registerSettings()`.

Contoh referensi implementasi: `llamacpp-extension`.

---

## 7. Libraries & Dependencies Penting (ekstrak dari package.json)

Catatan: ini ringkasan dependensi dari paket-paket utama.

- Core & tooling
  - TypeScript, Rolldown, Rollup
  - `rxjs` (core runtime), `ulidx`

- Frontend (`web-app`)
  - React 19, Vite, TailwindCSS, Zustand, TanStack Router
  - UI libs: Radix UI, Tabler icons, Framer Motion, React Markdown, KaTeX
  - Tauri Guest API: `@tauri-apps/api`
  - Model Context Protocol SDK: `@modelcontextprotocol/sdk` (dipakai di `extensions-web`)

- Extensions & Native Integration
  - `@janhq/tauri-plugin-llamacpp-api` (guest JS wrapper untuk plugin llama.cpp)
  - `@janhq/tauri-plugin-vector-db-api` (guest wrapper untuk vector DB)
  - `@janhq/tauri-plugin-rag-api` (guest wrapper untuk parsing/ingestion helpers)

- Testing & Dev
  - `vitest`, `jsdom`, ESLint, Husky

- Packaging / Build
  - `tauri` CLI, `cross-env`, `cpx`, `rimraf`, `tar`, `unzipper`

- Notable third-party SDKs referenced (via lockfile or optional server integrations):
  - `openai` (SDK terlihat di repo lockfile sebenarnya untuk backend integrations)
  - `@anthropic-ai/sdk`, `@google/genai`, `@mistralai/mistralai`, `cohere-ai` (kokoh dukungan cloud melalui backend Jan)

---

## 8. File & Endpoint Penting

- UI / Provider web client: `extensions-web/src/jan-provider-web` (API client dan provider)
  - Endpoints: `JAN_API_ROUTES` di [extensions-web/src/jan-provider-web/const.ts](extensions-web/src/jan-provider-web/const.ts)
  - Client: [extensions-web/src/jan-provider-web/api.ts](extensions-web/src/jan-provider-web/api.ts)

- Model manager: [core/src/browser/models/manager.ts](core/src/browser/models/manager.ts)
- RAG tools & ingestion: [extensions/rag-extension/src/index.ts](extensions/rag-extension/src/index.ts)
- Vector DB guest API: `src-tauri/plugins/tauri-plugin-vector-db`
- LlamaCPP guest API: `src-tauri/plugins/tauri-plugin-llamacpp`

---

## 9. Run / Build Quick Notes

- Untuk dev (full):

```bash
yarn install
yarn dev
```

- Untuk membangun bundle desktop (tauri):

```bash
yarn build:tauri
```

(Refer ke `package.json` root untuk detail script dan dependency build steps.)

---

## 10. Next Steps / Rekomendasi

- Jika ingin dukung Ollama API: buat `extensions/ollama-extension` yang extend `AIEngine`.
- Untuk memperkuat RAG:
  - Tambahkan opsi embedding provider (mis. OpenAI embeddings atau HuggingFace sentence-transformers) jika ingin embedding cloud.
  - Sediakan job queue untuk ingestion besar (wikipedia dump) agar tidak blocking UI.
- Tambah dokumentasi API backend Jan untuk integrasi cloud provider.

---

Dokumen ini bisa dikembangkan lebih lanjut (diagram, contoh request/responses, checklist deployment native plugins). Kalau mau, saya buatkan versi READMEs per-komponen atau diagram merinci call-flow taksional.

Referensi backend untuk implementasi desktop: [Rencana Kerja Backend Vyre](work-plan-backend.md)
