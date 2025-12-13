import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { getDbPath } from '../utils/paths';

export function runMigrations() {
  const dbPath = getDbPath();
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  // Ensure migrations table
  db.prepare(`CREATE TABLE IF NOT EXISTS migrations (
    id INTEGER PRIMARY KEY,
    name TEXT UNIQUE,
    applied_at TEXT
  )`).run();

  const migrationsDir = path.join(__dirname, 'migrations');
  if (!fs.existsSync(migrationsDir)) {
    console.log('No migrations directory found:', migrationsDir);
    return;
  }

  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
  for (const file of files) {
    const name = file;
    const row = db.prepare('SELECT name FROM migrations WHERE name = ?').get(name);
    if (row) continue; // already applied
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    console.log('Applying migration', file);
    try {
      db.exec(sql);
      db.prepare('INSERT INTO migrations (name, applied_at) VALUES (?, ?)').run(name, new Date().toISOString());
    } catch (err) {
      console.error('Migration failed:', file, err);
      throw err;
    }
  }

  console.log('Migrations complete.');
}

if (require.main === module) runMigrations();
