// Minimal API server skeleton for Vyre (desktop)
import Fastify from 'fastify';

export function createServer(opts = {}) {
  const fastify = Fastify({ logger: false });

  fastify.get('/health', async () => ({ status: 'ok' }));

  fastify.post('/ingest', async (request, reply) => {
    // TODO: validate payload, enqueue ingest job
    return reply.code(202).send({ job_id: 'job_stub', status: 'queued' });
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
