import Database from 'better-sqlite3';
import { getDbPath } from '../utils/paths';
import fs from 'fs';
import path from 'path';

function main() {
  const dbPath = getDbPath();
  console.log('Using DB:', dbPath);
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    console.log('DB directory does not exist. Creating:', dir);
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new Database(dbPath); // open (create if missing)

  // Check if jobs table exists
  const tbl = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='jobs'").get();
  if (!tbl) {
    console.log('No jobs table found in DB. Run migrations or start the worker to initialize.');
    return;
  }

  const rows = db.prepare('SELECT job_id, type, status, attempts, last_error, created_at, updated_at FROM jobs ORDER BY created_at DESC LIMIT 50').all();
  if (!rows || rows.length === 0) {
    console.log('No jobs found.');
    return;
  }
  console.table(rows);
}

if (require.main === module) main();
