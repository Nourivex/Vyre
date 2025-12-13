// Minimal API server skeleton for Vyre (desktop)
import Fastify from 'fastify';
import { SQLiteQueue } from '../queue/sqlite_queue';
import { embedText } from '../embeddings/adapter_ollama';
import { SQLiteVecAdapter } from '../vector/adapter_sqlite_vec';
import Database from 'better-sqlite3';
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
import { callModel } from '../tools/call_model';
const execFileAsync = promisify(execFile);

export function createServer(opts = {}) {
  const fastify = Fastify({ logger: false });

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

  fastify.post('/chat', async (request, reply) => {
    try {
      const body = request.body as any || {};
      const convId = body.conversation_id || `conv_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const role = body.role || 'user';
      const content = String(body.content || body.text || '');
      const now = new Date().toISOString();
      const db = new Database((require('../utils/paths').getDbPath)());
      const getConv = db.prepare('SELECT conversation_id FROM conversations WHERE conversation_id = ?');
      const insertConv = db.prepare('INSERT OR IGNORE INTO conversations (conversation_id, title, agent_id, meta, created_at) VALUES (?,?,?,?,?)');
      if (!getConv.get(convId)) insertConv.run(convId, body.title || null, body.agent_id || null, JSON.stringify(body.meta || {}), now);
      const msgId = `msg_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const insertMsg = db.prepare('INSERT INTO messages (message_id, conversation_id, role, content, tokens, metadata, created_at) VALUES (?,?,?,?,?,?,?)');
      insertMsg.run(msgId, convId, role, content, null, JSON.stringify({}), now);
      const qvec = await embedText(String(content), 512);
      const vec = new SQLiteVecAdapter();
      const hits = vec.searchVector(qvec, body.top_k || 3, body.collection_id || undefined);
      const getChunk = db.prepare('SELECT * FROM chunks WHERE chunk_id = ?');
      const sources = (hits || []).map((h: any) => {
        const r = getChunk.get(h.chunk_id);
        return { chunk_id: h.chunk_id, score: h.score, text: r?.text || '' };
      });

      // Build simple prompt including retrieved sources and call model
      const prompt = `You are an assistant. Use the following context snippets to help answer the user. Context:\n${sources.map(s => s.text).join('\n---\n')}\nUser: ${content}\nAssistant:`;
      const modelToUse = body.model || getDefaultModelSafe();
      // Allow disabling real model calls in test env for determinism
      let replyText = '';
      if (process.env.DISABLE_MODEL_CALL === '1') {
        replyText = `Auto-reply: ${content.slice(0, 400)}`;
      } else {
        const cm = await callModel(prompt, modelToUse).catch((e: any) => ({ ok: false, err: String(e) }));
        if (cm && (cm as any).ok) replyText = (cm as any).text || '';
        else replyText = `Sorry, model error: ${(cm as any).err || 'unknown'}`;
      }

      const assistantMsgId = `msg_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      insertMsg.run(assistantMsgId, convId, 'assistant', replyText, null, JSON.stringify({ sources }), new Date().toISOString());
      return { conversation_id: convId, message_id: assistantMsgId, response: replyText, sources, model: modelToUse };
    } catch (err) {
      request.log.error(err);
      console.error('chat handler error:', err);
      return reply.code(500).send({ error: 'chat_failed' });
    }
  });

  // Agents endpoints
  fastify.post('/agents', async (request, reply) => {
    try {
      const body = request.body as any || {};
      const now = new Date().toISOString();
      const db = new Database((require('../utils/paths').getDbPath)());
      const agentId = body.agent_id || `agent_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const insert = db.prepare('INSERT OR REPLACE INTO agents (agent_id, name, description, model, meta, created_at, updated_at) VALUES (?,?,?,?,?,?,?)');
      insert.run(agentId, body.name || `Agent ${agentId}`, body.description || null, body.model || null, JSON.stringify(body.meta || {}), now, now);
      const row = db.prepare('SELECT * FROM agents WHERE agent_id = ?').get(agentId);
      return { agent: row };
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({ error: 'agents_write_failed' });
    }
  });

  fastify.get('/agents', async (request, reply) => {
    try {
      const db = new Database((require('../utils/paths').getDbPath)());
      const rows = db.prepare('SELECT * FROM agents ORDER BY created_at DESC').all();
      return { agents: rows };
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({ error: 'agents_read_failed' });
    }
  });

  // Conversations endpoints
  fastify.post('/conversations', async (request, reply) => {
    try {
      const body = request.body as any || {};
      const now = new Date().toISOString();
      const db = new Database((require('../utils/paths').getDbPath)());
      const convId = body.conversation_id || `conv_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const insert = db.prepare('INSERT OR IGNORE INTO conversations (conversation_id, title, agent_id, meta, created_at, updated_at) VALUES (?,?,?,?,?,?)');
      insert.run(convId, body.title || null, body.agent_id || null, JSON.stringify(body.meta || {}), now, now);
      const row = db.prepare('SELECT * FROM conversations WHERE conversation_id = ?').get(convId);
      return { conversation: row };
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({ error: 'conversations_write_failed' });
    }
  });

  fastify.get('/conversations', async (request, reply) => {
    try {
      const db = new Database((require('../utils/paths').getDbPath)());
      const rows = db.prepare('SELECT * FROM conversations ORDER BY updated_at DESC, created_at DESC').all();
      return { conversations: rows };
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({ error: 'conversations_read_failed' });
    }
  });

  // OpenAPI minimal
  const openapi = {
    openapi: '3.0.1',
    info: { title: 'Vyre API', version: '0.1.0' },
    paths: {
      '/health': {},
      '/ingest': {},
      '/search': {},
      '/models': {},
      '/config': {},
      '/agents': {},
      '/conversations': {},
      '/chat': {}
    }
  };

  fastify.get('/openapi.json', async (request, reply) => reply.send(openapi));

  fastify.get('/docs', async (request, reply) => {
    const html = `<!doctype html><html><head><meta charset="utf-8" /><title>Vyre API Docs</title></head><body><redoc spec-url='/openapi.json'></redoc><script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"></script></body></html>`;
    reply.type('text/html').send(html);
  });

  fastify.get('/', async (request, reply) => reply.type('text/html').send('<h1>Vyre backend</h1><p>API running.</p>'));

  return fastify;
}

export async function startServer(port = 0) {
  const server = createServer();
  await server.listen({ port });
  return server;
}
