import { createServer } from '../api/index';
import { runMigrations } from '../db/migrate';
import Database from 'better-sqlite3';
import { getDbPath } from '../utils/paths';

async function run() {
  await runMigrations();
  const db = new Database(getDbPath());

  // clean
  db.prepare('DELETE FROM jobs').run();
  db.prepare('DELETE FROM documents').run();
  db.prepare('DELETE FROM chunks').run();
  db.prepare('DELETE FROM embeddings').run();

  // insert a document and chunk + embedding
  const now = new Date().toISOString();
  db.prepare('INSERT INTO documents (doc_id, collection_id, filename, mime, source, size, metadata, created_at) VALUES (?,?,?,?,?,?,?,?)')
    .run('doc_test', 'testcol', 'f.txt', 'text/plain', 'smoke', 10, '{}', now);
  db.prepare('INSERT INTO chunks (chunk_id, doc_id, collection_id, text, start_pos, end_pos, tokens, metadata, created_at) VALUES (?,?,?,?,?,?,?,?,?)')
    .run('chunk_test', 'doc_test', 'testcol', 'Unit test chunk for search', 0, 23, 5, '{}', now);
  // fake embedding (small dim 4)
  const f32 = new Float32Array([0.1,0.2,0.3,0.4]);
  db.prepare('INSERT INTO embeddings (chunk_id, collection_id, vector, dim, model, created_at) VALUES (?,?,?,?,?,?)')
    .run('chunk_test', 'testcol', Buffer.from(f32.buffer), 4, 'test', now);

  const server = createServer();
  await server.listen({ port: 0 });
  const addr = server.server.address();
  const port = typeof addr === 'object' && addr ? (addr as any).port : 3000;

  const res = await server.inject({ method: 'POST', url: '/search', payload: { text: 'Unit test chunk for search', collection_id: 'testcol', top_k: 3 } });
  console.log('search status', res.statusCode, 'body', res.payload);
  await server.close();
}

if (require.main === module) run().catch(e=>{ console.error(e); process.exit(1)});
