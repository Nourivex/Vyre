// Simple SQLite-backed queue implementation skeleton
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

export class SQLiteQueue {
  dbPath: string;
  db: any;

  constructor(dbPath?: string) {
    this.dbPath = dbPath || path.join(process.env.APPDATA || '.', 'Vyre', 'vyre.db');
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    this.db = new Database(this.dbPath);
    // Ensure jobs table exists (migration should handle this)
    this.db.prepare(`CREATE TABLE IF NOT EXISTS jobs (
      id INTEGER PRIMARY KEY,
      job_id TEXT UNIQUE,
      type TEXT,
      payload TEXT,
      status TEXT,
      attempts INTEGER DEFAULT 0,
      last_error TEXT,
      created_at TEXT,
      updated_at TEXT
    )`).run();
  }

  enqueue(job: {jobId: string; type: string; payload: any}) {
    const now = new Date().toISOString();
    const stmt = this.db.prepare('INSERT INTO jobs (job_id,type,payload,status,created_at,updated_at) VALUES (?,?,?,?,?,?)');
    stmt.run(job.jobId, job.type, JSON.stringify(job.payload || {}), 'queued', now, now);
  }

  reserveNext() {
    // Simplified reservation: select first queued job and set status=running
    const row = this.db.prepare("SELECT * FROM jobs WHERE status='queued' ORDER BY created_at LIMIT 1").get();
    if (!row) return null;
    const now = new Date().toISOString();
    this.db.prepare('UPDATE jobs SET status=?, updated_at=? WHERE id=? AND status=?').run('running', now, row.id, 'queued');
    return row;
  }

  complete(jobId: string) {
    const now = new Date().toISOString();
    this.db.prepare('UPDATE jobs SET status=?, updated_at=? WHERE job_id=?').run('done', now, jobId);
  }
}
