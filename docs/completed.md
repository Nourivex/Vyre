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

## Status Terbaru — 2025-12-13
- **Smoke test:** Lulus lokal (`npm run smoke`) — pipeline ingest → embed terverifikasi.
- **Migrasi DB:** `runMigrations()` dijalankan dan migrasi diterapkan.
- **Pemeriksaan Ollama:** CLI tersedia (`ollama --version`), namun subcommand `embed` tidak ada; HTTP embed endpoint mengembalikan 404 pada host lokal. Adapter embedding menggunakan `run`/HTTP bila tersedia dan fallback ke pseudo-embedding bila tidak — sistem tetap dapat berjalan.
- **Workers:** `ingest_worker` dan `embed_worker` dipanggil dalam single-run selama smoke test dan memproses job.
- **Tes:** `npm test` (integration + vector unit) dijalankan dan lulus.

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

## Skema Tabel — Implementasi (SQL)
Berikut skema SQL yang direkomendasikan untuk implementasi awal tabel `agents`, `conversations`, dan `messages`. Skema ini bersifat non-destruktif dan dapat ditambahkan sebagai migration SQL baru (mis. `002_add_chat_tables.sql`).

```sql
-- agents: definisi persona/agent yang dapat dipilih pengguna
CREATE TABLE IF NOT EXISTS agents (
  agent_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  model TEXT DEFAULT NULL,
  meta TEXT DEFAULT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT
);

-- conversations: kumpulan pesan untuk sesi percakapan
CREATE TABLE IF NOT EXISTS conversations (
  conversation_id TEXT PRIMARY KEY,
  title TEXT,
  agent_id TEXT REFERENCES agents(agent_id) ON DELETE SET NULL,
  meta TEXT DEFAULT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT
);

-- messages: pesan individu dalam sebuah percakapan
CREATE TABLE IF NOT EXISTS messages (
  message_id TEXT PRIMARY KEY,
  conversation_id TEXT REFERENCES conversations(conversation_id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  tokens INTEGER DEFAULT NULL,
  metadata TEXT DEFAULT NULL,
  created_at TEXT NOT NULL
);

-- indeks untuk query cepat
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversations_agent ON conversations(agent_id);
```

Catatan:
- `meta` / `metadata` disimpan sebagai JSON teks, konsumen bertanggung jawab untuk serialisasi.
- Tipe `TEXT` untuk timestamp mengikuti format ISO8601 (`new Date().toISOString()` di Node).
- Pertimbangkan menambah kolom `parent_message_id` pada `messages` jika butuh threading/reply.


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

## Tujuan Baru — UI Sidebar & Presentation (2025-12-13)

Tambahan tujuan yang harus dikerjakan setelah refactor UI terbaru:

- Perbaiki tampilan respons chat: bila backend mengembalikan objek/JSON, antarmuka chat hanya menampilkan bagian teks respons (mis. `response.text` atau `response.output`) bukan merender seluruh objek JSON mentah. Ini meningkatkan keterbacaan dan pengalaman pengguna.
- Perbaikan tema/warna: highlight/kondisi `selected` pada dropdown `Agent` dan `Knowledge Base` perlu penyesuaian — gunakan warna aksen yang kontras (variabel `--accent`) dan padding/border yang konsisten agar pilihan terlihat jelas di tema gelap maupun terang.
- Sidebar: masukkan daftar `conversations` yang dapat dicari, tombol `+ New` untuk membuat percakapan, serta sinkronisasi `agent` → `model` ketika user memilih Agent sehingga percakapan baru otomatis menggunakan konfigurasi Agent tersebut.
- Ollama status: tampilkan indikator status yang merefleksikan hasil pemeriksaan `services/tools/check_ollama.ts` atau endpoint `/models`. Jika Ollama mati, tampilkan fallback message dan gunakan pseudo-embed atau matikan pemanggilan model.
- Knowledge Base (Collections): tampilkan dropdown collections dan tombol Upload untuk men-trigger `/ingest`. Pilihan collection harus diteruskan ke endpoint `/chat` sebagai `collection_id` untuk retrieval.

Implementasi kecil yang direkomendasikan:

- Backend: tambahkan endpoint CRUD untuk `/agents`, `/conversations`, `/collections` dan endpoint `GET /conversations/:id/messages`.
- Frontend: parsing respons model di `pages/chat.js` agar menampilkan `response` yang relevan (prioritaskan `response.text`, `response.output`, lalu fallback ke `JSON.stringify` kecil).
- Styling: update `services/public/app/app.css` untuk variabel warna `--accent-selected` dan class `.selected` pada dropdown/options.

Setelah langkah ini, jalankan smoke-test end-to-end untuk memastikan:

- Pilihan Agent memicu penggunaan model yang sesuai.
- Upload dokumen memicu `/ingest` dan koleksi muncul di dropdown.
- Chat menampilkan teks jawaban yang bersih.


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

## CI, Migrasi & API — Panduan Singkat

- CI: GitHub Actions workflow ditambahkan di `.github/workflows/ci.yml`. Workflow menjalankan `npm install`, `npm test`, dan `npm run smoke` di folder `services` pada push/PR ke `main`.

- Menjalankan migrasi manual:

```bash
cd services
npx ts-node db/migrate.ts
```

- Menjalankan smoke test lokal:

```bash
cd services
npm run smoke
```

- Menjalankan test integrasi `/chat` (deterministik):

```powershell
cd services
$env:DISABLE_MODEL_CALL = '1'
npx ts-node test/chat-integration.test.ts
```

- API singkat:
  - `POST /chat` : body `{ conversation_id?, role, content, top_k?, collection_id? }` → menyimpan pesan user, menjalankan retrieval, memanggil model (Ollama HTTP/CLI) kecuali `DISABLE_MODEL_CALL=1`, menyimpan dan mengembalikan assistant reply.
  - `GET/POST /agents` : buat atau list agent persona.
  - `GET/POST /conversations` : buat atau list conversations.

Tambahan: CI akan menjalankan test di lingkungan Ubuntu; jika repo menambah native deps pastikan matrix/runner mendukungnya.
