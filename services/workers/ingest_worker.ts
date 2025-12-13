// Ingest worker skeleton: polls queue, runs parsing/chunking, enqueues embed jobs
import { SQLiteQueue } from '../queue/sqlite_queue';

export async function runIngestWorker(queuePath?: string) {
  const queue = new SQLiteQueue(queuePath);
  // Very simple loop for demo purposes
  setInterval(() => {
    const job = queue.reserveNext();
    if (!job) return;
    try {
      // TODO: parse attachments, create documents/chunks, enqueue embed jobs
      console.log('Processing job', job.job_id, job.type);
      // mark done
      queue.complete(job.job_id);
    } catch (err) {
      console.error('Ingest worker error', err);
      // TODO: update job attempts and last_error
    }
  }, 1000);
}
