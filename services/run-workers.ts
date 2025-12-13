import { runIngestWorker } from './workers/ingest_worker';
import { runMigrations } from './db/migrate';

async function main() {
  try {
    runMigrations();
  } catch (err) {
    console.error('Migrations failed', err);
    process.exit(1);
  }

  console.log('Starting ingest worker...');
  await runIngestWorker();
}

if (require.main === module) main();
