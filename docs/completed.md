# Ringkasan Pekerjaan — Vyre (Backend & Frontend)

Dokumen ini merangkum apa saja yang telah dikerjakan pada backend (lokal-first) dan catatan pekerjaan frontend serta TODO yang tersisa.

## Ringkasan Utama (Backend) — Selesai
- API server dasar dengan Fastify dan dokumentasi OpenAPI/Redoc/Swagger.
- Sistem migrasi SQLite dan file DB dev di `database/vyre.db`.
- Queue berbasis SQLite (`jobs` table) untuk pekerjaan asinkron.
- Endpoint implementasi: `/ingest`, `/search`, `/models`, `/config`.
- Pipeline ingest: enqueue ingest job → ingest worker membuat dokumen & chunk → enqueue embed jobs.
- Embed worker dan adapter Ollama (HTTP + CLI fallback) untuk menghitung embedding.
- Vector store sederhana `sqlite-vec` yang menyimpan Float32 BLOB dan melakukan pencarian linier (cosine).
- Smoke tests dan unit tests dasar yang dapat dijalankan (`npm run smoke`, `npm test`).
- Dev-runner untuk menjalankan server + worker dalam satu terminal.
- Alat bantu `services/tools/check_ollama.ts` untuk memeriksa instalasi Ollama.

## Perubahan yang Ditambahkan Baru-baru Ini
- Dokumentasi agen kustom di `.github/agents/vyre.agent.md` (diperbarui agar konfirmasi/progress pakai Bahasa Indonesia).
- Perbaikan pada `embed_worker` untuk resolving konfigurasi model dengan aman.

## Skema Data Percakapan (Rencana)
Kami merekomendasikan menyimpan percakapan dengan struktur berikut:

- Tabel `conversations`:
  - `conversation_id` TEXT PRIMARY KEY
  - `created_at`, `updated_at` TEXT
  - `agent_id` TEXT NULLABLE (opsional)
  - `meta` JSON (user_id, model, settings)

- Tabel `messages`:
  - `message_id` TEXT PRIMARY KEY
  - `conversation_id` TEXT (FK)
  - `role` TEXT ('system'|'assistant'|'user'|'tool')
  - `content` TEXT
  - `created_at` TEXT
  - `meta` JSON (sources, tokens, persona_snapshot)

Skema ini memungkinkan multi-persona via `agent_id` dan snapshot persona saat pesan assistant dibuat.

## Frontend — Catatan Ringkas
- Belum ada UI Tauri lengkap; direkomendasikan membuat komponen:
  - Pemilih `agent` (karakter/persona)
  - Halaman chat dengan history, dan panel sumber (sources)
  - Pengaturan model & preferensi lokal (offline-first)

## TODO Prioritas (Ringkas)
1. Implementasi `/chat` endpoint (retrieval → prompt → model call) + simpan percakapan.
2. Tambah migrasi DB: `agents`, `conversations`, `messages`.
3. Tambah endpoints manajemen agent (`GET /agents`, `POST /agents`).
4. Integrasi persona agent ke prompt template dan simpan snapshot ke `messages.meta`.
5. Tambah ANN/indexing untuk performa pencarian vektor (opsional: hnswlib).
6. Tambah CI workflow untuk menjalankan `npm test` dan `npm run smoke`.
7. Implementasi UI Tauri (model selector, chat view, history view).

## Cara Menjalankan (Dev)
- Jalankan migrasi dan server:

```bash
cd services
npx ts-node db/migrate.ts
npm run dev
```

- Menjalankan smoke test:

```bash
cd services
npm run smoke
```

## Catatan Keamanan & Privasi
- Jangan commit secrets atau data pengguna sensitif ke repo. Simpan konfigurasi lokal di `services/config.json`.
- Pertimbangkan enkripsi atau kebijakan retensi untuk percakapan sensitif.

---
Jika mau, saya bisa langsung membuat migrasi DB untuk `agents`/`conversations`/`messages` dan menambahkan helper API serta endpoint `/chat` — pilih langkah berikutnya dan saya lanjutkan.
