import { SQLiteQueue } from '../queue/sqlite_queue';
import Database from 'better-sqlite3';
import { getDbPath } from '../utils/paths';
import { embedText } from '../embeddings/adapter_ollama';
import { SQLiteVecAdapter } from '../vector/adapter_sqlite_vec';

function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

export async function runEmbedWorker(queuePath?: string, once = false) {
  const queue = new SQLiteQueue(queuePath);
  const dbPath = getDbPath();
  const db = new Database(dbPath);

  console.log('Embed worker started', once ? '(single-run)' : '');

  while (true) {
    const job = queue.reserveNext();
    if (!job) {
      if (once) break;
      await sleep(1000);
      continue;
    }

    try {
      console.log('Embed worker: processing', job.job_id);
      const payload = job.payload ? JSON.parse(job.payload) : {};
      const chunkIds: string[] = payload.chunk_ids || [];
      const model = payload.model || payload.embed_model || 'ollama';

      const getChunk = db.prepare('SELECT * FROM chunks WHERE chunk_id = ?');
      const now = new Date().toISOString();
      const vecAdapter = new SQLiteVecAdapter();
      // determine model: job.payload may include model, otherwise use configured default
      let jobModel = payload.model;
      if (!jobModel) {
        const cfg = require('../config');
        if (cfg && typeof cfg.getDefaultModel === 'function') {
          jobModel = cfg.getDefaultModel();
        } else if (cfg && cfg.default && typeof cfg.default.getDefaultModel === 'function') {
          jobModel = cfg.default.getDefaultModel();
        } else {
          const c = (cfg && typeof cfg.readConfig === 'function') ? cfg.readConfig() : (cfg && cfg.default && typeof cfg.default.readConfig === 'function' ? cfg.default.readConfig() : {});
          jobModel = (c && c.default_model) || process.env.OLLAMA_MODEL || 'gemma3:4b';
        }
      }
      for (const cid of chunkIds) {
        const row = getChunk.get(cid);
        if (!row) {
          console.warn('Chunk not found for id', cid);
          continue;
        }
        const text = row.text || '';
        const vec = await embedText(text, 512, jobModel);
        const f32 = new Float32Array(vec.length);
        for (let i = 0; i < vec.length; i++) f32[i] = vec[i];
        // Use adapter to persist
        vecAdapter.upsertEmbedding(cid, row.collection_id || null, f32, model);
        console.log('Embedded chunk', cid, 'dim', vec.length);
      }

      queue.complete(job.job_id);
      console.log('Embed job completed', job.job_id);
    } catch (err) {
      console.error('Embed worker error', err);
      // TODO: update job attempts/last_error
      if (once) break;
    }

    if (once) break;
  }

  console.log('Embed worker exiting');
}

if (require.main === module) {
  const once = process.argv.includes('--once');
  runEmbedWorker(undefined, once).catch((e) => {
    console.error('Fatal embed worker error', e);
    process.exit(1);
  });
}

export default { runEmbedWorker };
