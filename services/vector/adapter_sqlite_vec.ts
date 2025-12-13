// sqlite-vec adapter skeleton
// Responsibilities: createCollection, insertEmbeddings, search, deleteCollection
import path from 'path';
import fs from 'fs';

export class SQLiteVecAdapter {
  rootPath: string;

  constructor(rootPath?: string) {
    this.rootPath = rootPath || path.join(process.env.APPDATA || '.', 'Vyre', 'vectors');
    if (!fs.existsSync(this.rootPath)) fs.mkdirSync(this.rootPath, { recursive: true });
  }

  async createCollection(collectionId: string) {
    const dir = path.join(this.rootPath, collectionId);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    // TODO: initialize any index files
    return { collectionId };
  }

  async insertEmbeddings(collectionId: string, items: Array<{chunkId: string; vector: Float32Array;}>) {
    // TODO: persist vectors in DB or flat files and update index
    return { inserted: items.length };
  }

  async search(collectionId: string, vector: Float32Array, topK = 10) {
    // TODO: ANN search or fallback linear scan
    return [] as Array<{chunkId: string; score: number}>;
  }

  async deleteCollection(collectionId: string) {
    // TODO: delete files and index
    return true;
  }
}
