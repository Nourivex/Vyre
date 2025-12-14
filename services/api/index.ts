// Minimal API server for Vyre
import Fastify from 'fastify';
import { SQLiteQueue } from '../queue/sqlite_queue';
import { embedText } from '../embeddings/adapter_ollama';
import { SQLiteVecAdapter } from '../vector/adapter_sqlite_vec';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
const cfg = require('../config');

function getDefaultModelSafe() {
  try {
    if (typeof cfg.getDefaultModel === 'function') return cfg.getDefaultModel();
    if (cfg && cfg.default && typeof cfg.default.getDefaultModel === 'function') return cfg.default.getDefaultModel();
  } catch (e) {}
  return process.env.OLLAMA_MODEL || 'gemma3:4b';
}

const _callModelMod = require('../tools/call_model');
const callModel: any = (_callModelMod && typeof _callModelMod.callModel === 'function') ? _callModelMod.callModel
  : (_callModelMod && _callModelMod.default && typeof _callModelMod.default.callModel === 'function') ? _callModelMod.default.callModel
  : (_callModelMod && typeof _callModelMod === 'function') ? _callModelMod : null;

const execFileAsync = promisify(execFile);

export function createServer(opts = {}) {
  const fastify = Fastify({ logger: false });

  fastify.addHook('onSend', async (request, reply, payload) => {
    try {
      reply.header('Access-Control-Allow-Origin', '*');
      reply.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
      reply.header('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    } catch (e) {}
    return payload;
  });

  fastify.options('/*', async (request, reply) => {
    reply.header('Access-Control-Allow-Origin', '*');
    reply.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    reply.header('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    return reply.code(204).send();
  });

  fastify.get('/health', async () => ({ status: 'ok' }));

  fastify.post('/ingest', async (request, reply) => {
    try {
      const body = request.body as any || {};
      const queue = new SQLiteQueue();
      const jobId = `job_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
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
    try {
      const cmd = process.env.OLLAMA_CMD || 'ollama';
      const { stdout } = await execFileAsync(cmd, ['list']);
      const lines = String(stdout).split(/\r?\n/).map(l => l.trim()).filter(Boolean);
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
        cfg.setDefaultModel(String(body.default_model));
        return { ok: true, default_model: getDefaultModelSafe() };
      }
      return reply.code(400).send({ error: 'no_default_model' });
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({ error: 'config_failed' });
    }
  });

  fastify.get('/config', async (request, reply) => {
    try {
      return { default_model: getDefaultModelSafe(), config: cfg.readConfig() };
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({ error: 'read_config_failed' });
    }
  });

  // Chat: simple retrieval-augmented call
  fastify.post('/chat', async (request, reply) => {
    try {
      const body = request.body as any || {};
      const content = String(body.content || '');
      const model = body.model || getDefaultModelSafe();
      if (!content) return reply.code(400).send({ error: 'no_content' });

      let ctx = '';
      try {
        const qvec = await embedText(content, 512);
        const vec = new SQLiteVecAdapter();
        const hits = vec.searchVector(qvec, body.top_k || 5, body.collection_id || undefined);
        const db = new Database((require('../utils/paths').getDbPath)());
        const getChunk = db.prepare('SELECT * FROM chunks WHERE chunk_id = ?');
        const pieces = hits.map((h: any) => getChunk.get(h.chunk_id)?.text).filter(Boolean);
        if (pieces.length) ctx = pieces.slice(0, 6).join('\n\n');
      } catch (e) {
        request.log.warn({ retrieval_failed: true, error: String(e) });
      }

      const prompt = ctx ? `Context:\n${ctx}\n\nUser: ${content}` : `User: ${content}`;
      let resp: any = { response: null };
      if (callModel) {
        try {
          const r = await callModel(prompt, model);
          resp.response = typeof r === 'string' ? r : (r && r.output ? r.output : JSON.stringify(r));
        } catch (e) {
          request.log.error({ model_call_failed: true, error: String(e) });
          resp.error = String(e && (e as any).message ? (e as any).message : e);
        }
      } else {
        resp.response = `Model not available — echo: ${content}`;
      }
      return reply.send(resp);
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({ error: 'chat_failed' });
    }
  });

  const openapi = { openapi: '3.0.0', info: { title: 'Vyre API', version: '0.1.0' }, paths: { '/health': { get: { responses: { '200': { description: 'ok' } } } }, '/chat': { post: { responses: { '200': { description: 'chat' } } } } } };

  fastify.get('/openapi.json', async (request, reply) => reply.send(openapi));

  fastify.get('/docs', async (request, reply) => {
    const html = `<!doctype html><html><head><meta charset="utf-8"/><title>Vyre API Docs</title></head><body><redoc spec-url='/openapi.json'></redoc><script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"></script></body></html>`;
    reply.type('text/html').send(html);
  });

  fastify.get('/swagger', async (request, reply) => {
    const html = `<!doctype html><html><head><meta charset="utf-8"/><title>Vyre Swagger UI</title><link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@4/swagger-ui.css"/></head><body><div id="swagger"></div><script src="https://unpkg.com/swagger-ui-dist@4/swagger-ui-bundle.js"></script><script src="https://unpkg.com/swagger-ui-dist@4/swagger-ui-standalone-preset.js"></script><script>const ui = SwaggerUIBundle({url:'/openapi.json',dom_id:'#swagger',presets:[SwaggerUIBundle.presets.apis,SwaggerUIStandalonePreset],layout:'BaseLayout',tryItOutEnabled:true});window.ui=ui;</script></body></html>`;
    reply.type('text/html').send(html);
  });

  // Serve static app. Prefer `public/app-react` when present (new React app),
  // otherwise fall back to the legacy `public/app`.
  fastify.get('/', async (request, reply) => {
    try {
      const prefer = path.join(__dirname, '..', 'public', 'app-react', 'index.html');
      const fallback = path.join(__dirname, '..', 'public', 'app', 'index.html');
      if (fs.existsSync(prefer)) {
        const html = fs.readFileSync(prefer, 'utf8');
        return reply.type('text/html').send(html);
      }
      if (fs.existsSync(fallback)) {
        const html = fs.readFileSync(fallback, 'utf8');
        return reply.type('text/html').send(html);
      }
      return reply.code(404).send('app_not_found');
    } catch (e) {
      request.log.error(e);
      return reply.code(500).send('app_error');
    }
  });

  // Serve static files from app-react first, then legacy app
  fastify.get('/static/*', async (request: any, reply) => {
    try {
      const rel = request.params['*'] as string || '';
      const prefer = path.join(__dirname, '..', 'public', 'app-react', rel);
      const fallback = path.join(__dirname, '..', 'public', 'app', rel);
      let p = prefer;
      if (!fs.existsSync(p)) p = fallback;
      if (!fs.existsSync(p)) return reply.code(404).send('not_found');
      const ext = path.extname(p).toLowerCase();
      const map: any = { '.js': 'application/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json' };
      const ct = map[ext] || 'application/octet-stream';
      const data = fs.readFileSync(p);
      reply.type(ct).send(data);
    } catch (e) {
      request.log.error(e);
      return reply.code(500).send('static_error');
    }
  });

  return fastify;
}

export async function startServer(port = 0) {
  const server = createServer();
  await server.listen({ port });
  return server;
}
