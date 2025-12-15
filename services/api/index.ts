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

  // === BEGIN: Endpoint baru agar sesuai openapi.json ===

  // Conversations
  fastify.get('/conversations', async (request, reply) => {
    try {
      const db = new Database((require('../utils/paths').getDbPath)());
      const rows = db.prepare('SELECT conversation_id, title, agent_id, meta, created_at, updated_at FROM conversations ORDER BY updated_at DESC').all();
      console.log('[DEBUG] /conversations raw rows:', rows);
      // Normalisasi kolom agar JSON valid dan tidak undefined/null
      const conversations = rows.map(row => ({
        conversation_id: row.conversation_id,
        title: row.title || '',
        agent_id: row.agent_id || null,
        meta: row.meta ? (typeof row.meta === 'string' ? (row.meta.trim() ? JSON.parse(row.meta) : {}) : row.meta) : {},
        created_at: row.created_at,
        updated_at: row.updated_at
      }));
      console.log('[DEBUG] /conversations mapped:', conversations);
      return { conversations };
    } catch (e) {
      request.log.error(e);
      return { conversations: [] };
    }
  });
  fastify.post('/conversations', async (request, reply) => {
    // TODO: simpan ke DB
    return { id: 'conv_' + Date.now(), title: 'New conversation', updated_at: new Date().toISOString() };
  });
  // Update conversation (title, meta)
  fastify.patch('/conversations/:id', async (request, reply) => {
    try {
      const params = request.params as { id: string };
      const body = request.body as any || {};
      const title = typeof body.title === 'string' ? body.title : undefined;
      const meta = body.meta !== undefined ? body.meta : undefined;
      if (!title && meta === undefined) return reply.code(400).send({ error: 'no_changes' });
      const db = new Database((require('../utils/paths').getDbPath)());
      const now = new Date().toISOString();
      const updates: string[] = [];
      const paramsArr: any[] = [];
      if (title !== undefined) { updates.push('title = ?'); paramsArr.push(title); }
      if (meta !== undefined) { updates.push('meta = ?'); paramsArr.push(typeof meta === 'string' ? meta : JSON.stringify(meta)); }
      updates.push('updated_at = ?'); paramsArr.push(now);
      paramsArr.push(params.id);
      const sql = `UPDATE conversations SET ${updates.join(', ')} WHERE conversation_id = ?`;
      const res = db.prepare(sql).run(...paramsArr);
      if (res.changes === 0) return reply.code(404).send({ error: 'not_found' });
      return { ok: true, id: params.id, updated_at: now };
    } catch (e) {
      request.log.error(e);
      return reply.code(500).send({ error: 'update_failed' });
    }
  });
  fastify.delete('/conversations/:id', async (request, reply) => {
    try {
      const params = request.params as { id: string };
      const db = new Database((require('../utils/paths').getDbPath)());
      // Ensure foreign keys enforced so messages with ON DELETE CASCADE are removed
      db.pragma('foreign_keys = ON');
      const res = db.prepare('DELETE FROM conversations WHERE conversation_id = ?').run(params.id);
      if (res.changes === 0) return reply.code(404).send({ error: 'not_found' });
      return { ok: true, id: params.id };
    } catch (e) {
      request.log.error(e);
      return reply.code(500).send({ error: 'delete_failed' });
    }
  });
  fastify.get('/conversations/:id/messages', async (request, reply) => {
    try {
      const params = request.params as { id: string };
      const conversationId = params.id;
      const db = new Database((require('../utils/paths').getDbPath)());
      const rows = db.prepare('SELECT message_id, role, content, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at ASC').all(conversationId);
      console.log(`[DEBUG] /conversations/${conversationId}/messages rows:`, rows);
      return { messages: rows };
    } catch (e) {
      request.log.error(e);
      return { messages: [] };
    }
  });

  // Agents
  fastify.get('/agents', async (request, reply) => {
    // TODO: ambil dari DB
    return { agents: [] };
  });
  fastify.post('/agents', async (request, reply) => {
    // TODO: simpan ke DB
    return { ok: true };
  });

  // Providers
  fastify.get('/providers', async (request, reply) => {
    // Dummy: 3 provider populer, hanya ollama yang enabled
    return {
      providers: [
        {
          provider: 'ollama',
          is_enabled: true,
          config_fields: ['OLLAMA_HOST', 'OLLAMA_MODEL']
        },
        {
          provider: 'llama.cpp',
          is_enabled: false,
          config_fields: ['LLAMACPP_PATH', 'MODEL_PATH']
        },
        {
          provider: 'openkey',
          is_enabled: false,
          config_fields: ['OPENKEY_API_KEY']
        }
      ]
    };
  });
  fastify.post('/providers', async (request, reply) => {
    // TODO: update config
    return { ok: true };
  });

  // Collections
  fastify.get('/collections', async (request, reply) => {
    // TODO: ambil dari DB
    return { collections: [] };
  });

  // Jobs
  fastify.get('/jobs', async (request, reply) => {
    // TODO: ambil dari DB/queue
    return { jobs: [] };
  });
  // === END: Endpoint baru agar sesuai openapi.json ===

  // Chat: simple retrieval-augmented call
  fastify.post('/chat', async (request, reply) => {
    try {
      const body = request.body as any || {};
      const content = String(body.content || '');
      const model = body.model || getDefaultModelSafe();
      const conversationId = body.conversation_id || null;
      if (!content) return reply.code(400).send({ error: 'no_content' });

      // DB setup
      const db = new Database((require('../utils/paths').getDbPath)());
      // Simpan pesan user ke messages
      let convId = conversationId;
      if (!convId) {
        // Buat conversation baru jika tidak ada
        convId = 'conv_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
        db.prepare('INSERT OR IGNORE INTO conversations (conversation_id, created_at, updated_at) VALUES (?, ?, ?)')
          .run(convId, new Date().toISOString(), new Date().toISOString());
      }
      const msgIdUser = 'msg_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
      db.prepare('INSERT INTO messages (message_id, conversation_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)')
        .run(msgIdUser, convId, 'user', content, new Date().toISOString());

      // Ambil 5 pesan terakhir untuk konteks (role: user/assistant)
      let history = [];
      try {
        history = db.prepare('SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 5').all(convId).reverse();
      } catch {}

      // Retrieval context (RAG)
      let ctx = '';
      try {
        const qvec = await embedText(content, 512);
        const vec = new SQLiteVecAdapter();
        const hits = vec.searchVector(qvec, body.top_k || 5, body.collection_id || undefined);
        const getChunk = db.prepare('SELECT * FROM chunks WHERE chunk_id = ?');
        const pieces = hits.map((h: any) => getChunk.get(h.chunk_id)?.text).filter(Boolean);
        if (pieces.length) ctx = pieces.slice(0, 6).join('\n\n');
      } catch (e) {
        request.log.warn({ retrieval_failed: true, error: String(e) });
      }

      // Compose prompt: history + context + user
      let prompt = '';
      if (history.length) {
        prompt += history.map(h => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.content}`).join('\n');
        prompt += '\n';
      }
      if (ctx) prompt += `Context:\n${ctx}\n`;
      prompt += `User: ${content}`;

      // Instruksi bahasa Indonesia jika deteksi
      const isIndo = /[a-zA-Z]*\b(apa|siapa|bagaimana|mengapa|dimana|kapan|bisa|tolong|hari|saya|kamu|anda|kenapa|jelaskan|contoh|berikan|sebutkan|menjelaskan|menyebutkan|berikanlah|tolonglah|bantulah|halo|hai|terima kasih|selamat|pagi|siang|malam|sore|kabarmu|kabarku|kabarnya|baik|buruk|bantu|bantuan|jawab|pertanyaan|indonesia|bahasa)\b/i.test(content);
      if (isIndo) {
        prompt += "\n\nJawablah dalam bahasa Indonesia yang jelas dan ringkas.";
      }

      // Model call
      if (callModel) {
        try {
          let r = await callModel(prompt, model);
          if (typeof r === 'string') {
            try { r = JSON.parse(r); } catch {}
          }
          let output = r;
          if (typeof r === 'object' && r !== null) {
            output = r.output || r.response || r.text || JSON.stringify(r);
          }
          // Simpan jawaban assistant ke messages
          const msgIdAsst = 'msg_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
          db.prepare('INSERT INTO messages (message_id, conversation_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)')
            .run(msgIdAsst, convId, 'assistant', String(output), new Date().toISOString());
          return reply.send({ response: output, conversation_id: convId });
        } catch (e) {
          request.log.error({ model_call_failed: true, error: String(e) });
          return reply.send({ error: String(e && (e as any).message ? (e as any).message : e) });
        }
      } else {
        return reply.send({ response: `Model not available — echo: ${content}`, conversation_id: convId });
      }
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({ error: 'chat_failed' });
    }
  });

  // Load OpenAPI spec from external JSON to avoid large inline literals
  const openapiPath = path.join(__dirname, 'openapi.json');
  let openapi: any = { openapi: '3.0.0', info: { title: 'Vyre API', version: '0.1.0' }, paths: { '/health': { get: { responses: { '200': { description: 'ok' } } } } } };
  try {
    if (fs.existsSync(openapiPath)) {
      const raw = fs.readFileSync(openapiPath, 'utf8');
      // try parse with error logging
      try {
        openapi = JSON.parse(raw);
      } catch (pe) {
        console.error('[openapi] failed to parse openapi.json:', String(pe));
        console.error('[openapi] file preview:', raw.slice(0, 400));
      }
    }
  } catch (e) {
    console.error('[openapi] read error', String(e));
  }
  // Debug: print where we looked for the spec and whether it was loaded
  try {
    const exists = fs.existsSync(openapiPath);
    const size = exists ? fs.statSync(openapiPath).size : 0;
    console.log('[openapi] path=', openapiPath, 'exists=', exists, 'size=', size, 'loaded_keys=', Object.keys(openapi || {}));
  } catch (e) {
    console.log('[openapi] debug failed', String(e));
  }

  fastify.get('/openapi.json', async (request, reply) => reply.send(openapi));

  fastify.get('/docs', async (request, reply) => {
    const html = `<!doctype html><html><head><meta charset="utf-8"/><title>Vyre API Docs</title></head><body><redoc spec-url='/openapi.json'></redoc><script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"></script></body></html>`;
    reply.type('text/html').send(html);
  });

  fastify.get('/swagger', async (request, reply) => {
    const html = `<!doctype html><html><head><meta charset="utf-8"/><title>Vyre Swagger UI</title><link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@4/swagger-ui.css"/></head><body><div id="swagger"></div><script src="https://unpkg.com/swagger-ui-dist@4/swagger-ui-bundle.js"></script><script src="https://unpkg.com/swagger-ui-dist@4/swagger-ui-standalone-preset.js"></script><script>const ui = SwaggerUIBundle({url:'/openapi.json',dom_id:'#swagger',presets:[SwaggerUIBundle.presets.apis,SwaggerUIStandalonePreset],layout:'BaseLayout'});window.ui=ui;</script></body></html>`;
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
