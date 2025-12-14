# Vyre Backend API — Reference (dev)

Ringkasan singkat endpoint backend Vyre yang siap dipakai untuk pengecekan lokal dan integrasi frontend.

Lokasi server: `http://localhost:3000` (default dev-runner)

Prasyarat
- Jalankan migrasi DB: `npx ts-node db/migrate.ts`
- Jalankan server: `npm run dev` (di folder `services`)
- File DB dev: `database/vyre.db`

Environment penting
- `OLLAMA_CMD` (path ke binary `ollama`), optional
- `OLLAMA_MODEL` (default model, ex: `gemma3:4b`)
- `VYRE_DB_PATH` untuk override path DB (opsional)

Endpoints

- GET /health
  - Response: { status: 'ok' }

- POST /ingest
  - Body: arbitrary JSON (document payload)
  - Response: 202 queued { job_id, status }
  - Notes: menaruh job ke queue SQLite untuk worker

- POST /search
  - Body: { text: string } or { query: string, top_k?: number, collection_id?: string }
  - Response: { results: [{ chunk_id, score, text }] }

- GET /models
  - Response: { models: [string] }
  - Notes: membaca `ollama list` jika tersedia

- GET /config
  - Response: { default_model, config }

- POST /config
  - Body: { default_model: string }
  - Response: { ok: true, default_model }

Conversations / Messages
- GET /conversations
  - Response: { conversations: [{ conversation_id, title, agent_id, meta, created_at, updated_at }] }

- POST /conversations
  - Body: { title?: string, agent_id?: string }
  - Current behavior: returns created id object (TODO: persist)

- DELETE /conversations/:id
  - Current behavior: stub (returns { ok: true })

- GET /conversations/:id/messages
  - Response: { messages: [{ message_id, role, content, created_at }] }
  - Example: retrieve history for a conversation

Chat (RAG + persistence)
- POST /chat
  - Body: {
      content: string,                // required
      conversation_id?: string,       // optional; if omitted backend creates one
      model?: string,                 // optional override
      top_k?: number,                 // optional retrieval
      collection_id?: string          // optional retrieval collection
    }
  - Behavior:
    - menyimpan pesan user ke tabel `messages` (role='user')
    - ambil 5 pesan terakhir untuk context
    - jalankan retrieval embedding + similarity (SQLite vec)
    - bangun prompt (history + context + user)
    - jika deteksi bahasa Indonesia pada `content`, tambahkan instruksi jawab dalam bahasa Indonesia
    - panggil model (`callModel`) dan parse output menjadi teks natural
    - simpan jawaban assistant ke `messages` (role='assistant')
  - Response: { response: string, conversation_id: string }
  - Example curl:

```bash
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"content":"Halo, siapa kamu?"}'
```

Database / Migrations
- Migrations berada di `services/db/migrations`:
  - `001_init.sql` (core tables)
  - `002_add_chat_tables.sql` (agents, conversations, messages)
- DB path default: `database/vyre.db` (lihat `services/utils/paths.ts`)

Notes & Tips
- Untuk pengembangan tanpa model, set `DISABLE_MODEL_CALL=1` saat menjalankan tests/smoke.
- Frontend harus memilih `response` teks: prioritas `response.text` / `response.output` / fallback ke raw string.
- Jika Anda memakai Tauri/desktop, pastikan `VYRE_DB_PATH` menunjuk ke lokasi yang dapat diakses oleh proses yang menjalankan backend.

Debugging
- Jika endpoint `/conversations` atau pesan kosong walau DB berisi data: restart server agar file DB tidak di-cache, jalankan migrasi ulang.
- Ada logging debug di `services/api/index.ts` untuk `/conversations` dan `/conversations/:id/messages` yang mencetak rows mentah.

Next steps (opsional)
- Implementasikan `POST /conversations` persistence dan `DELETE /conversations/:id` secara permanen.
- Tambah pagination pada `/conversations` dan limit pada message history retrieval.
- Tambah contoh request/response OpenAPI di `services/api/openapi.json`.

---
Dokumen ini dibuat otomatis dari status kode saat ini — report jika ada endpoint tambahan yang ingin didokumentasikan.
