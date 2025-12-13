# RAG Pipeline & Fitur Lainnya

## Wireframe Alur RAG (Retrieval-Augmented Generation)

```
+-------------------+      Upload Dokumen      +-------------------+
|                   |-----------------------> |                   |
|     User/App      |                         |   RagExtension    |
|                   | <---------------------+ |                   |
+-------------------+   Hasil Retrieval      +-------------------+
         |                                            |
         |                                            v
         |                                 +-----------------------+
         |                                 |   VectorDBExtension   |
         |                                 +-----------------------+
         |                                            |
         |                                            v
         |                                 +-----------------------+
         |                                 |   Model/LLM Engine    |
         |                                 +-----------------------+
```

### Penjelasan Alur
1. **User upload dokumen** (PDF, Wikipedia, dsb.) ke aplikasi.
2. **RagExtension** memecah dokumen menjadi chunk, membuat embedding (via LLM), dan menyimpan ke VectorDB.
3. Saat user bertanya, query di-embed, lalu **VectorDBExtension** mencari chunk paling relevan.
4. Chunk hasil retrieval digabungkan ke prompt.
5. **Model/LLM Engine** (misal llamacpp) menjawab dengan konteks dari dokumen.

---

## Fitur Lain di Aplikasi

- **Local AI Models**: Jalankan LLM lokal (Llama.cpp, Gemma, Qwen, dsb.)
- **Cloud Integration**: Koneksi ke OpenAI, Anthropic, Mistral, Groq, dll.
- **Custom Assistants**: Buat asisten AI dengan instruksi/kepribadian khusus
- **OpenAI-Compatible API**: Server API lokal untuk aplikasi lain
- **Model Context Protocol (MCP)**: Mendukung agentic reasoning & tool use
- **Vector Database**: Penyimpanan embedding & pencarian vektor
- **File Attachment**: Upload file/dokumen untuk knowledge base
- **Extensible Plugin System**: Tambah extension baru sesuai kebutuhan
- **Privacy First**: Semua bisa berjalan lokal

---

## Catatan
- Semua pipeline RAG dan fitur lain bisa dikembangkan/diintegrasikan lewat extension.
- Untuk menambah model/provider baru, cukup buat extension baru.

---

*Dokumen ini dapat dikembangkan sesuai kebutuhan tim/produk.*

Catatan implementasi desktop: lihat juga [Rencana Kerja Backend Vyre](work-plan-backend.md) untuk detail storage SQLite, adapter `sqlite-vec`, dan job queue desktop.
