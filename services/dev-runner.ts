import { createServer } from './api/index';
import { runMigrations } from './db/migrate';
import { runIngestWorker } from './workers/ingest_worker';

async function main() {
  try {
    runMigrations();
  } catch (err) {
    console.error('Migrations failed', err);
    process.exit(1);
  }

  // Start ingest worker in-process so dev only needs one terminal
  try {
    // don't await to keep server startup non-blocking
    runIngestWorker().catch((e) => console.error('Ingest worker error:', e));
    console.log('Ingest worker started in-process');
  } catch (err) {
    console.error('Failed to start ingest worker', err);
  }

  const fastify = createServer();
  const port = 3000;
  try {
    await fastify.listen({ port, host: '127.0.0.1' });
    console.log(`Vyre API server listening on http://127.0.0.1:${port}`);
  } catch (err) {
    console.error('Failed to start server', err);
    process.exit(1);
  }
}

if (require.main === module) main();
