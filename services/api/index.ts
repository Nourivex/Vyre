// Minimal API server skeleton for Vyre (desktop)
import Fastify from 'fastify';
import { SQLiteQueue } from '../queue/sqlite_queue';
import { embedText } from '../embeddings/adapter_ollama';
import { SQLiteVecAdapter } from '../vector/adapter_sqlite_vec';
import Database from 'better-sqlite3';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { getDefaultModel, setDefaultModel } from '../config';
const execFileAsync = promisify(execFile);

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
    try {
      const body = request.body as any || {};
      const collectionId = body.collection_id || null;
      const topK = body.top_k || 5;
      const text = body.text || body.query || '';

      if (!text) return reply.code(400).send({ error: 'no_query' });

      const qvec = await embedText(String(text), 512);
      const vec = new SQLiteVecAdapter();
      const hits = vec.searchVector(qvec, topK, collectionId || undefined);

      // Fetch chunk texts for results
      const db = new Database((require('../utils/paths').getDbPath)());
      const getChunk = db.prepare('SELECT * FROM chunks WHERE chunk_id = ?');
      const results = hits.map((h: any) => {
        const row = getChunk.get(h.chunk_id);
        return { chunk_id: h.chunk_id, score: h.score, text: row?.text || '' };
      });

      return { results };
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({ error: 'search_failed' });
    }
  });

  fastify.get('/models', async (request, reply) => {
    // run `ollama list` and parse names
    try {
      const cmd = process.env.OLLAMA_CMD || 'ollama';
      const { stdout } = await execFileAsync(cmd, ['list']);
      // parse lines like: name:id ... => take first column
      const lines = String(stdout).split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
      const rows = lines.map(l => l.split(/\s+/)[0]);
      return { models: rows };
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({ error: 'list_failed' });
    }
  });

  fastify.post('/config', async (request, reply) => {
    try {
      const body = request.body as any || {};
      if (body.default_model) {
        setDefaultModel(String(body.default_model));
        return { ok: true, default_model: getDefaultModel() };
      }
      return reply.code(400).send({ error: 'no_default_model' });
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({ error: 'config_failed' });
    }
  });

  fastify.get('/config', async (request, reply) => {
    try {
      const cfg = require('../config');
      return { default_model: cfg.getDefaultModel(), config: cfg.readConfig() };
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({ error: 'read_config_failed' });
    }
  });

  fastify.post('/chat', async (request, reply) => {
    // TODO: retrieval + prompt assembly + call model
    return { id: 'chat_stub', response: 'not implemented', sources: [] };
  });

  // OpenAPI spec (minimal) and docs pages
  const openapi = {
    openapi: '3.0.1',
    info: { title: 'Vyre API', version: '0.1.0', description: 'Vyre local backend API' },
    servers: [{ url: 'http://127.0.0.1:3000' }],
    components: {
      schemas: {
        IngestRequest: {
          type: 'object',
          properties: {
            collection_id: { type: 'string' },
            text: { type: 'string' },
            attachments: { type: 'array', items: { type: 'object' } },
            options: { type: 'object', properties: { embed_model: { type: 'string' } } }
          }
        },
        SearchRequest: {
          type: 'object',
          properties: { text: { type: 'string' }, collection_id: { type: 'string' }, top_k: { type: 'integer' } }
        },
        ConfigRequest: { type: 'object', properties: { default_model: { type: 'string' } } }
      }
    },
    paths: {
      '/health': { get: { summary: 'Health check', responses: { '200': { description: 'OK' } } } },
      '/ingest': { post: { summary: 'Enqueue ingest', requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/IngestRequest' } } } }, responses: { '202': { description: 'queued' } } } },
      '/search': { post: { summary: 'Vector search', requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/SearchRequest' } } } }, responses: { '200': { description: 'results' } } } },
      '/models': { get: { summary: 'List installed Ollama models', responses: { '200': { description: 'models' } } } },
      '/config': { post: { summary: 'Set config (default model)', requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/ConfigRequest' } } } }, responses: { '200': { description: 'ok' } } }, get: { summary: 'Get config', responses: { '200': { description: 'current config' } } } }
    }
  };

  fastify.get('/openapi.json', async (request, reply) => {
    return reply.send(openapi);
  });

  fastify.get('/docs', async (request, reply) => {
    const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Vyre API Docs</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="icon" href="data:;base64,=">
  </head>
  <body>
    <redoc spec-url='/openapi.json'></redoc>
    <script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"> </script>
  </body>
</html>`;
    reply.type('text/html').send(html);
  });

  fastify.get('/', async (request, reply) => {
    const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>Vyre Backend</title></head><body>
  <h1>Vyre backend</h1>
  <p>API running. Visit <a href="/docs">/docs</a> for API documentation (Redoc).</p>
  <ul>
    <li><a href="/docs">API docs</a></li>
    <li><a href="/openapi.json">OpenAPI JSON</a></li>
  </ul>
</body></html>`;
    reply.type('text/html').send(html);
  });

  // Swagger UI (interactive Try-it) at /swagger
  fastify.get('/swagger', async (request, reply) => {
    const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Vyre Swagger UI</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@4/swagger-ui.css" />
  </head>
  <body>
    <div id="swagger"></div>
    <script src="https://unpkg.com/swagger-ui-dist@4/swagger-ui-bundle.js"></script>
    <script>
      const ui = SwaggerUIBundle({
        url: '/openapi.json',
        dom_id: '#swagger',
        presets: [SwaggerUIBundle.presets.apis],
        layout: 'BaseLayout'
      });
    </script>
  </body>
</html>`;
    reply.type('text/html').send(html);
  });

  return fastify;
}

export async function startServer(port = 0) {
  const server = createServer();
  await server.listen({ port });
  return server;
}
