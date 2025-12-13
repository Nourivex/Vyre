-- Initial migrations: create basic tables used by Vyre backend (SQLite)
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS collections (
  id INTEGER PRIMARY KEY,
  collection_id TEXT UNIQUE NOT NULL,
  name TEXT,
  description TEXT,
  storage_path TEXT,
  adapter TEXT,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY,
  doc_id TEXT UNIQUE,
  collection_id TEXT,
  filename TEXT,
  mime TEXT,
  source TEXT,
  size INTEGER,
  metadata TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS chunks (
  id INTEGER PRIMARY KEY,
  chunk_id TEXT UNIQUE,
  doc_id TEXT,
  collection_id TEXT,
  text TEXT,
  start_pos INTEGER,
  end_pos INTEGER,
  tokens INTEGER,
  metadata TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS embeddings (
  id INTEGER PRIMARY KEY,
  chunk_id TEXT,
  collection_id TEXT,
  vector BLOB,
  dim INTEGER,
  model TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY,
  job_id TEXT UNIQUE,
  type TEXT,
  payload TEXT,
  status TEXT,
  attempts INTEGER DEFAULT 0,
  last_error TEXT,
  created_at TEXT,
  updated_at TEXT
);
