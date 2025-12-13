// Minimal API server skeleton for Vyre (desktop)
import Fastify from 'fastify';
import { SQLiteQueue } from '../queue/sqlite_queue';
import { embedText } from '../embeddings/adapter_ollama';
import { SQLiteVecAdapter } from '../vector/adapter_sqlite_vec';
import Database from 'better-sqlite3';
import { execFile } from 'child_process';
import { promisify } from 'util';
const cfg = require('../config'); // Keep this line as is
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

  // Add permissive CORS headers to allow Swagger UI Try-it from browser
  fastify.addHook('onSend', async (request, reply, payload) => {
    try {
      reply.header('Access-Control-Allow-Origin', '*');
      reply.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
      reply.header('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    } catch (e) {
      // ignore
    }
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

  // Modern OpenAPI spec and docs (servers, components, Swagger UI)
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
        ConfigRequest: { type: 'object', properties: { default_model: { type: 'string' } } },
        ChatRequest: {
          type: 'object',
          properties: {
            role: { type: 'string', description: 'role of the message (user/system)' },
            content: { type: 'string' },
            model: { type: 'string' },
            top_k: { type: 'integer' },
            collection_id: { type: 'string' }
          }
        }
      }
    },
    paths: {
      '/health': { get: { summary: 'Health check', responses: { '200': { description: 'OK' } } } },
      '/ingest': { post: { summary: 'Enqueue ingest', requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/IngestRequest' } } } }, responses: { '202': { description: 'queued' } } } },
      '/search': { post: { summary: 'Vector search', requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/SearchRequest' } } } }, responses: { '200': { description: 'results' } } } },
      '/models': { get: { summary: 'List installed Ollama models', responses: { '200': { description: 'models' } } } },
      '/config': { post: { summary: 'Set config (default model)', requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/ConfigRequest' } } } }, responses: { '200': { description: 'ok' } } }, get: { summary: 'Get config', responses: { '200': { description: 'current config' } } } },
      '/agents': { get: { summary: 'List agents', responses: { '200': { description: 'Agents' } } }, post: { summary: 'Create/update agent', requestBody: { content: { 'application/json': { schema: { type: 'object' } } } }, responses: { '200': { description: 'Agent' } } } },
      '/conversations': { get: { summary: 'List conversations', responses: { '200': { description: 'Conversations' } } }, post: { summary: 'Create conversation', requestBody: { content: { 'application/json': { schema: { type: 'object' } } } }, responses: { '200': { description: 'Conversation' } } } },
      '/chat': { post: { summary: 'Send message to chat', requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/ChatRequest' }, example: { role: 'user', content: 'Halo', model: 'gemma3:4b' } } } }, responses: { '200': { description: 'Chat response' } } } }
    }
  };

  fastify.get('/openapi.json', async (request, reply) => reply.send(openapi));

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
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Vyre Backend</title>
  <style>
    :root{--bg:#0f1720;--card:#0b1220;--accent:#7c3aed;--muted:#9aa4b2}
    html,body{height:100%;margin:0;font-family:Inter,Segoe UI,Roboto,Arial,sans-serif;background:linear-gradient(180deg,#07111a 0%, #0b1220 100%);color:#e6eef6}
    .wrap{max-width:980px;margin:40px auto;padding:24px}
    .hero{display:flex;align-items:center;gap:20px}
    .logo{width:64px;height:64px;border-radius:12px;background:linear-gradient(135deg,var(--accent),#3b82f6);display:flex;align-items:center;justify-content:center;font-weight:700;color:#fff}
    h1{margin:0;font-size:28px}
    p.lead{margin:6px 0 18px;color:var(--muted)}
    .card{background:var(--card);border-radius:12px;padding:18px;margin-top:18px;box-shadow:0 6px 18px rgba(2,6,23,0.6)}
    .actions{display:flex;flex-wrap:wrap;gap:10px}
    .btn{display:inline-block;padding:10px 14px;border-radius:8px;background:transparent;border:1px solid rgba(255,255,255,0.06);color:#e6eef6;text-decoration:none}
    .btn.primary{background:linear-gradient(90deg,var(--accent),#3b82f6);border:0}
    .meta{margin-top:12px;color:var(--muted);font-size:13px;display:flex;gap:12px;align-items:center}
    .status{display:inline-flex;align-items:center;gap:8px}
    .dot{width:10px;height:10px;border-radius:999px;background:#f44336;display:inline-block}
    @media (max-width:640px){.wrap{margin:18px;padding:16px}.hero{flex-direction:row}}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="hero">
      <div class="logo">V</div>
      <div>
        <h1>Vyre — Local AI backend</h1>
        <p class="lead">Run locally: ingestion, vector search, and model-backed chat. Secure by default.</p>
      </div>
    </div>

    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
        <div>
          <strong>Quick links</strong>
          <div class="actions" style="margin-top:8px">
            <a class="btn primary" href="/docs">Open API Docs</a>
            <a class="btn" href="/swagger">Swagger UI</a>
            <a class="btn" href="/openapi.json">OpenAPI JSON</a>
          </div>
        </div>
        <div style="text-align:right">
          <div class="meta">
            <span class="status"><span id="statusDot" class="dot"></span><span id="statusText">Checking...</span></span>
            <span id="version"></span>
          </div>
        </div>
      </div>

      <div style="margin-top:14px;color:var(--muted)">Tip: Use the <em>Swagger UI</em> to interactively try endpoints, or browse the machine-readable <code>/openapi.json</code>.</div>
    </div>
  </div>

  <script>
    async function checkStatus(){
      try{
        const r = await fetch('/health');
        if(r.ok){ document.getElementById('statusDot').style.background='#2ecc71'; document.getElementById('statusText').textContent='Healthy'; }
        else { document.getElementById('statusDot').style.background='#f39c12'; document.getElementById('statusText').textContent='Degraded'; }
      }catch(e){ document.getElementById('statusDot').style.background='#e74c3c'; document.getElementById('statusText').textContent='Offline'; }
      try{
        const s = await fetch('/openapi.json'); if(s.ok){ const j = await s.json(); document.getElementById('version').textContent = (j.info?.title || '') + ' — v' + (j.info?.version||''); }
      }catch(e){}
    }
    checkStatus();
  </script>
</body>
</html>`;
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
    <script src="https://unpkg.com/swagger-ui-dist@4/swagger-ui-standalone-preset.js"></script>
    <script>
      const ui = SwaggerUIBundle({
        url: '/openapi.json',
        dom_id: '#swagger',
        presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
        layout: 'BaseLayout',
        tryItOutEnabled: true
      });
      window.ui = ui;
    </script>
  </body>
</html>`;
    reply.type('text/html').send(html);
  });

  // Chat UI: modern, minimal chat page with theme selector
  fastify.get('/chat-ui', async (request, reply) => {
    const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Vyre — Interface</title>
  <style>
    :root{--bg:#07111a;--surface:#0b1220;--panel:#0f1726;--muted:#9aa4b2;--accent:#7c3aed;--text:#e6eef6}
    .light{--bg:#f7fafc;--surface:#ffffff;--panel:#f8fafc;--muted:#6b7280;--accent:#6366f1;--text:#0b1220}
    html,body{height:100%;margin:0;font-family:Inter,Segoe UI,Roboto,Arial,sans-serif;background:linear-gradient(180deg,var(--bg),#07111a);color:var(--text)}
    .layout{display:flex;height:100vh}
    .sidebar{width:260px;background:var(--surface);border-right:1px solid rgba(255,255,255,0.03);padding:18px;box-sizing:border-box}
    .brand{font-weight:700;font-size:18px;margin-bottom:12px}
    .nav{display:flex;flex-direction:column;gap:8px}
    .nav button{background:transparent;border:0;color:var(--text);padding:8px 10px;text-align:left;border-radius:8px;cursor:pointer}
    .nav button.active{background:linear-gradient(90deg,var(--accent),#3b82f6);color:#fff}
    .content{flex:1;display:flex;flex-direction:column;padding:18px;box-sizing:border-box}
    .header{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}
    .controls{display:flex;gap:8px;align-items:center}
    .panel{flex:1;background:var(--panel);border-radius:12px;padding:14px;box-shadow:0 8px 30px rgba(2,6,23,0.6);display:flex;flex-direction:column}
    /* Chat area */
    .messages{flex:1;overflow:auto;padding:8px;display:flex;flex-direction:column;gap:10px}
    .msg{max-width:78%;padding:10px;border-radius:10px;line-height:1.4}
    .msg.user{align-self:flex-end;background:rgba(255,255,255,0.06)}
    .msg.assistant{align-self:flex-start;background:rgba(0,0,0,0.12)}
    .composer{display:flex;gap:8px;margin-top:10px}
    .input{flex:1;padding:10px;border-radius:10px;border:1px solid rgba(255,255,255,0.06);background:transparent;color:var(--text)}
    .btn{padding:8px 12px;border-radius:8px;border:0;cursor:pointer}
    .btn.primary{background:linear-gradient(90deg,var(--accent),#3b82f6);color:#fff}
    .muted{font-size:12px;color:var(--muted)}
    @media (max-width:900px){.sidebar{display:none}.layout{flex-direction:column}.content{padding:12px}}
  </style>
</head>
<body>
  <div class="layout">
    <aside class="sidebar">
      <div class="brand">Vyre — Local AI</div>
      <div class="muted">Run locally · private · fast</div>
      <nav class="nav" style="margin-top:18px">
        <button data-page="chat" class="active">Chat</button>
        <button data-page="docs">Docs</button>
        <button data-page="settings">Settings</button>
      </nav>
      <div style="margin-top:20px" class="muted">Model</div>
      <select id="modelSelect" style="width:100%;margin-top:8px;padding:8px;border-radius:8px;background:transparent;color:var(--text);border:1px solid rgba(255,255,255,0.04)">
        <option value="gemma3:4b">gemma3:4b</option>
      </select>
      <div style="margin-top:12px"><button id="themeBtn" class="btn" style="width:100%">Toggle Theme</button></div>
    </aside>

    <main class="content">
      <div class="header">
        <div style="font-weight:600">Vyre — Interface</div>
        <div class="controls muted">Local · <span id="version">v0.1.0</span></div>
      </div>

      <div id="pageContainer" class="panel">
        <!-- Chat page (default) -->
        <div id="page-chat" class="page" style="display:block;flex:1;">
          <div id="messages" class="messages"></div>
          <form id="frm" class="composer">
            <input id="txt" class="input" placeholder="Write a message..." autocomplete="off" />
            <button type="submit" class="btn primary">Send</button>
          </form>
        </div>

        <div id="page-docs" class="page" style="display:none;">
          <div class="muted">API docs</div>
          <iframe src="/docs" style="border:0;width:100%;height:100%;margin-top:8px;border-radius:8px"></iframe>
        </div>

        <div id="page-settings" class="page" style="display:none;">
          <div class="muted">Settings</div>
          <div style="margin-top:8px">Environment variables and runtime options can be shown here.</div>
        </div>
      </div>
    </main>
  </div>

  <script>
    // UI: page switcher and theme
    const navBtns = document.querySelectorAll('.nav button');
    const pages = document.querySelectorAll('.page');
    navBtns.forEach(b=> b.addEventListener('click', ()=>{
      navBtns.forEach(x=>x.classList.remove('active'));
      b.classList.add('active');
      const p = b.getAttribute('data-page');
      pages.forEach(pg=> pg.style.display = pg.id === 'page-'+p ? 'block' : 'none');
    }));

    const themeBtn = document.getElementById('themeBtn');
    function setTheme(t){ if(t==='light') document.documentElement.classList.add('light'); else document.documentElement.classList.remove('light'); localStorage.setItem('vyre_theme', t); }
    setTheme(localStorage.getItem('vyre_theme') || 'dark');
    themeBtn.addEventListener('click', ()=> setTheme(document.documentElement.classList.contains('light') ? 'dark' : 'light'));

    // Chat behavior
    const messagesEl = document.getElementById('messages');
    const txt = document.getElementById('txt');
    const frm = document.getElementById('frm');
    const modelSelect = document.getElementById('modelSelect');

    function appendMsg(role, text){ const d = document.createElement('div'); d.className = 'msg '+(role==='user'?'user':'assistant'); d.textContent = text; messagesEl.appendChild(d); messagesEl.scrollTop = messagesEl.scrollHeight; }

    frm.addEventListener('submit', async (e)=>{
      e.preventDefault(); const v = txt.value.trim(); if(!v) return; appendMsg('user', v); txt.value=''; appendMsg('assistant', '...');
      try{
        const res = await fetch('/chat', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ role:'user', content: v, model: modelSelect.value }) });
        const j = await res.json();
        const last = messagesEl.querySelectorAll('.msg.assistant');
        if(last.length) last[last.length-1].textContent = j.response || j.error || JSON.stringify(j);
      }catch(err){ const last = messagesEl.querySelectorAll('.msg.assistant'); if(last.length) last[last.length-1].textContent = 'Error: '+String(err.message||err); }
    });

    // Try load models list
    (async ()=>{
      try{ const r = await fetch('/models'); const j = await r.json(); if(Array.isArray(j.models)){ modelSelect.innerHTML = ''; j.models.forEach(m=>{ const o = document.createElement('option'); o.value = m; o.text = m; modelSelect.appendChild(o); }); }
    }catch(e){}
    })();
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
