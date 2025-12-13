import Database from 'better-sqlite3';
import { getDbPath } from '../utils/paths';

function readFloat32Buffer(buf: Buffer): number[] {
  const f32 = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
  return Array.from(f32);
}

export class SQLiteVecAdapter {
  db: any;
  constructor(dbPath?: string) {
    const p = dbPath || getDbPath();
    this.db = new Database(p);
  }

  // Upsert is optional because embeddings may already be in `embeddings` table.
  // This helper stores a vector BLOB to the embeddings table.
  upsertEmbedding(chunkId: string, collectionId: string | null, vector: Float32Array, model = 'ollama') {
    const buf = Buffer.from(vector.buffer);
    const now = new Date().toISOString();
    const dim = vector.length;
    const stmt = this.db.prepare('INSERT INTO embeddings (chunk_id, collection_id, vector, dim, model, created_at) VALUES (?,?,?,?,?,?)');
    stmt.run(chunkId, collectionId, buf, dim, model, now);
  }

  // Simple linear search with cosine similarity. Suitable for small/desktop datasets.
  searchVector(queryVec: number[] | Float32Array, topK = 5, collectionId?: string) {
    const q = Array.isArray(queryVec) ? queryVec : Array.from(queryVec as Float32Array);
    const rows = collectionId ? this.db.prepare('SELECT chunk_id, vector, dim FROM embeddings WHERE collection_id = ?').all(collectionId)
                              : this.db.prepare('SELECT chunk_id, vector, dim FROM embeddings').all();

    const results: Array<{ chunk_id: string; score: number }> = [];
    for (const r of rows) {
      try {
        const vec = readFloat32Buffer(r.vector);
        // cosine similarity over the overlapping dimension (truncate to min length)
        const minLen = Math.min(vec.length, q.length);
        if (minLen === 0) continue;
        let dot = 0, nq = 0, nv = 0;
        for (let i = 0; i < minLen; i++) {
          dot += q[i] * vec[i];
          nq += q[i] * q[i];
          nv += vec[i] * vec[i];
        }
        const denom = Math.sqrt(nq) * Math.sqrt(nv) || 1e-9;
        const score = dot / denom;
        results.push({ chunk_id: r.chunk_id, score });
      } catch (e) {
        // skip
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }
}

export default SQLiteVecAdapter;
// (Additional persistence/indexing implementations can be added separately.)
