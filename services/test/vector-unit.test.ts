import { SQLiteVecAdapter } from '../vector/adapter_sqlite_vec';
import Database from 'better-sqlite3';
import { getDbPath } from '../utils/paths';

async function run(){
  const db = new Database(getDbPath());
  // clean
  db.prepare('DELETE FROM embeddings').run();

  // insert two vectors that are similar
  const a = new Float32Array([1,0,0,0]);
  const b = new Float32Array([0.9,0.1,0,0]);
  const now = new Date().toISOString();
  db.prepare('INSERT INTO embeddings (chunk_id, collection_id, vector, dim, model, created_at) VALUES (?,?,?,?,?,?)')
    .run('c1','unit', Buffer.from(a.buffer), a.length, 'test', now);
  db.prepare('INSERT INTO embeddings (chunk_id, collection_id, vector, dim, model, created_at) VALUES (?,?,?,?,?,?)')
    .run('c2','unit', Buffer.from(b.buffer), b.length, 'test', now);

  const adapter = new SQLiteVecAdapter();
  const hits = adapter.searchVector([1,0,0,0], 2, 'unit');
  console.log('vector-unit test hits', hits);
  if (!hits || hits.length === 0) process.exit(2);
}

if (require.main === module) run().catch(e=>{ console.error(e); process.exit(1) });
