import { runIngestWorker } from '../workers/ingest_worker';
import { runEmbedWorker } from '../workers/embed_worker';
import Database from 'better-sqlite3';
import { getDbPath } from '../utils/paths';
import { runMigrations } from '../db/migrate';
import fs from 'fs';

async function sleep(ms: number){ return new Promise(res=>setTimeout(res, ms)); }

async function main(){
  console.log('Smoke test: running migrations');
  await runMigrations();

  const dbPath = getDbPath();
  const db = new Database(dbPath);

  // Clean up previous test data for idempotence
  try{
    db.prepare('DELETE FROM jobs').run();
    db.prepare('DELETE FROM documents').run();
    db.prepare('DELETE FROM chunks').run();
    db.prepare('DELETE FROM embeddings').run();
  }catch(e){/* ignore */}

  console.log('Enqueueing ingest job');
  const jobId = `job_smoke_${Date.now()}`;
  const payload = { collection_id: 'smoke', text: 'Halo Vyre smoke test. Ini kalimat untuk embedding.' };
  db.prepare('INSERT INTO jobs (job_id,type,payload,status,created_at,updated_at) VALUES (?,?,?,?,?,?)')
    .run(jobId,'ingest', JSON.stringify(payload),'queued', new Date().toISOString(), new Date().toISOString());

  console.log('Running ingest worker once');
  // runIngestWorker uses setInterval; call and wait briefly for it to process
  await (async ()=>{
    const p = runIngestWorker(undefined);
    // give it time to process one loop
    await sleep(2500);
    return p;
  })();

  console.log('Running embed worker once');
  await runEmbedWorker(undefined, true);

  // Check embeddings
  const rows = db.prepare('SELECT COUNT(*) as c FROM embeddings WHERE collection_id = ?').get('smoke');
  console.log('Embeddings count for collection "smoke":', rows?.c ?? 0);

  if ((rows?.c ?? 0) > 0) {
    console.log('Smoke test passed');
    process.exit(0);
  } else {
    console.error('Smoke test failed: no embeddings stored');
    process.exit(2);
  }
}

if (require.main === module) main().catch(e=>{console.error(e); process.exit(1)});
