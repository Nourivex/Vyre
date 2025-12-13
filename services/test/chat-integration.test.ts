import { createServer } from '../api';
import { runMigrations } from '../db/migrate';
import Database from 'better-sqlite3';
import { getDbPath } from '../utils/paths';

async function main() {
  console.log('Chat integration test: running migrations');
  await runMigrations();

  const server = await createServer();
  const res = await server.inject({ method: 'POST', url: '/chat', payload: { role: 'user', content: 'Halo dari test' } });
  console.log('chat status', res.statusCode, 'body', res.payload);
  if (res.statusCode !== 200) process.exit(2);

  // verify DB contains assistant message
  const db = new Database(getDbPath());
  const row = db.prepare('SELECT COUNT(*) as c FROM messages WHERE role = ?').get('assistant');
  console.log('assistant messages:', row?.c ?? 0);
  if ((row?.c ?? 0) < 1) {
    console.error('No assistant message stored');
    process.exit(2);
  }

  console.log('Chat integration test passed');
  process.exit(0);
}

if (require.main === module) main().catch(e=>{ console.error(e); process.exit(1)});
