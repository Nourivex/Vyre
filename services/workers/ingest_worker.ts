// Ingest worker: polls queue, runs parsing/chunking, enqueues embed jobs
import { SQLiteQueue } from '../queue/sqlite_queue';
import Database from 'better-sqlite3';
import { getDbPath } from '../utils/paths';
import crypto from 'crypto';

function makeId(prefix = 'id') {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

function chunkText(text: string, chunkSize = 1000, overlap = 200) {
  const chunks: Array<{ start: number; end: number; text: string }> = [];
  if (!text || text.length === 0) return chunks;
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    const piece = text.slice(start, end);
    chunks.push({ start, end, text: piece });
    // If we've reached the end of the text, stop to avoid repeating the last chunk.
    if (end >= text.length) break;
    start = end - overlap;
    if (start < 0) start = 0;
  }
  return chunks;
}

export async function runIngestWorker(queuePath?: string, once = false) {
  const queue = new SQLiteQueue(queuePath);
  const dbPath = getDbPath();
  const db = new Database(dbPath);

  // Helper to process a single job iteration
  const processNext = () => {
    const job = queue.reserveNext();
    if (!job) return;

    // Only handle ingest jobs here. If another job type was reserved, restore to queued so the
    // appropriate worker can pick it up.
    if (job.type !== 'ingest') {
      const now = new Date().toISOString();
      try {
        queue.db.prepare('UPDATE jobs SET status=?, updated_at=? WHERE id=?').run('queued', now, job.id);
      } catch (e) {
        // best-effort
      }
      return;
    }
    try {
      console.log('Ingest worker: processing', job.job_id, job.type);
      const payload = job.payload ? JSON.parse(job.payload) : {};

      // For simplicity support payload.text or attachments (file parsing not implemented)
      const collectionId = payload.collection_id || 'default';
      const docsToCreate: Array<{ filename: string; text: string; mime?: string; source?: string }> = [];

      if (payload.attachments && Array.isArray(payload.attachments) && payload.attachments.length > 0) {
        // placeholder: each attachment becomes a document with empty text (real parser to be added)
        for (const a of payload.attachments) {
          docsToCreate.push({ filename: a.filename || makeId('file'), text: a.text || '', mime: a.mime || 'application/octet-stream', source: payload.source || 'upload' });
        }
      }
      if (payload.text) {
        docsToCreate.push({ filename: makeId('textdoc'), text: String(payload.text), mime: 'text/plain', source: payload.source || 'text' });
      }

      // If nothing provided, create a placeholder empty doc
      if (docsToCreate.length === 0) {
        docsToCreate.push({ filename: makeId('empty'), text: '', mime: 'text/plain', source: payload.source || 'empty' });
      }

      const now = new Date().toISOString();
      const insertDoc = db.prepare('INSERT INTO documents (doc_id, collection_id, filename, mime, source, size, metadata, created_at) VALUES (?,?,?,?,?,?,?,?)');
      const insertChunk = db.prepare('INSERT INTO chunks (chunk_id, doc_id, collection_id, text, start_pos, end_pos, tokens, metadata, created_at) VALUES (?,?,?,?,?,?,?,?,?)');

      const embedQueue = queue; // reuse same queue for embed jobs

      for (const d of docsToCreate) {
        const docId = makeId('doc');
        insertDoc.run(docId, collectionId, d.filename, d.mime || null, d.source || null, d.text.length || 0, JSON.stringify({}), now);

        // chunking
        const chunks = chunkText(d.text || '', 1000, 200);
        const chunkIds: string[] = [];
        for (const c of chunks) {
          const chunkId = makeId('chunk');
          insertChunk.run(chunkId, docId, collectionId, c.text, c.start, c.end, c.text.length, JSON.stringify({}), now);
          chunkIds.push(chunkId);
        }

        // enqueue embed job for this document's chunks
          if (chunkIds.length > 0) {
            const embedJobId = makeId('job');
            const embedModel = payload.options?.embed_model || payload.options?.model || undefined;
            embedQueue.enqueue({ jobId: embedJobId, type: 'embed', payload: { collection_id: collectionId, chunk_ids: chunkIds, model: embedModel } });
          }
      }

      // mark ingest job done
      queue.complete(job.job_id);
      console.log('Ingest job completed', job.job_id);
    } catch (err) {
      console.error('Ingest worker error', err);
      // TODO: update job attempts and last_error
    }
  };

  if (once) {
    // run single iteration and return
    processNext();
    return;
  }

  // Poll loop
  setInterval(processNext, 1000);
}
