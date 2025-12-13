// Minimal API server skeleton for Vyre (desktop)
import Fastify from 'fastify';
import { SQLiteQueue } from '../queue/sqlite_queue';

export function createServer(opts = {}) {
  const fastify = Fastify({ logger: false });

  fastify.get('/health', async () => ({ status: 'ok' }));

  fastify.post('/ingest', async (request, reply) => {
    try {
      const body = request.body as any || {};
      const queue = new SQLiteQueue();
      // simple unique id
      const jobId = `job_${Date.now()}_${Math.floor(Math.random()*1000)}`;
      queue.enqueue({ jobId, type: 'ingest', payload: body });
      return reply.code(202).send({ job_id: jobId, status: 'queued' });
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({ error: 'enqueue_failed' });
    }
  });

  fastify.post('/search', async (request, reply) => {
    // TODO: call vector adapter search
    return { results: [] };
  });

  fastify.post('/chat', async (request, reply) => {
    // TODO: retrieval + prompt assembly + call model
    return { id: 'chat_stub', response: 'not implemented', sources: [] };
  });

  return fastify;
}

export async function startServer(port = 0) {
  const server = createServer();
  await server.listen({ port });
  return server;
}
