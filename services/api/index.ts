// Minimal API server skeleton for Vyre (desktop)
import Fastify from 'fastify';
import { SQLiteQueue } from '../queue/sqlite_queue';
import { embedText } from '../embeddings/adapter_ollama';
import { SQLiteVecAdapter } from '../vector/adapter_sqlite_vec';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
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
  fastify.get('/docs', async (request, reply) => {
    const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Vyre API Docs</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="icon" href="data:;base64,=">\n  </head>
  <body>
    <redoc spec-url='/openapi.json'></redoc>
    <script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"> </script>
  </body>
</html>`;
    reply.type('text/html').send(html);
  });

  // Serve app entry
  fastify.get('/', async (request, reply) => {
    try {
      const p = path.join(__dirname, '..', 'public', 'app', 'index.html');
      const html = fs.readFileSync(p, 'utf8');
      return reply.type('text/html').send(html);
    } catch (e) {
      request.log.error(e);
      return reply.code(500).send('app_not_found');
    }
  });

  // Serve chat-ui route to same app
  fastify.get('/chat-ui', async (request, reply) => {
    try {
      const p = path.join(__dirname, '..', 'public', 'app', 'index.html');
      const html = fs.readFileSync(p, 'utf8');
      return reply.type('text/html').send(html);
    } catch (e) {
      request.log.error(e);
      return reply.code(500).send('app_not_found');
    }
  });

  // Static assets under /static/*
  fastify.get('/static/*', async (request: any, reply) => {
    try {
      const rel = request.params['*'] as string || '';
      const p = path.join(__dirname, '..', 'public', 'app', rel);
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
  <title>Vyre — App</title>
  <style>
    :root{--bg:#07111a;--surface:#0b1220;--panel:#0f1726;--muted:#9aa4b2;--accent:#7c3aed;--text:#e6eef6}
    .light{--bg:#f7fafc;--surface:#ffffff;--panel:#f8fafc;--muted:#6b7280;--accent:#6366f1;--text:#0b1220}
    html,body{height:100%;margin:0;font-family:Inter,Segoe UI,Roboto,Arial,sans-serif;background:linear-gradient(180deg,var(--bg),#07111a);color:var(--text)}
    .layout{display:flex;height:100vh}
    .sidebar{width:260px;background:var(--surface);border-right:1px solid rgba(255,255,255,0.03);padding:18px;box-sizing:border-box}
    .brand{font-weight:700;font-size:18px;margin-bottom:8px}
    .muted{color:var(--muted);font-size:13px}
    .nav{display:flex;flex-direction:column;gap:8px;margin-top:16px}
    .nav button{background:transparent;border:0;color:var(--text);padding:10px;border-radius:8px;text-align:left;cursor:pointer}
    .nav button.active{background:linear-gradient(90deg,var(--accent),#3b82f6);color:#fff}
    .content{flex:1;display:flex;flex-direction:column;padding:18px;box-sizing:border-box}
    .header{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}
    .panel{flex:1;background:var(--panel);border-radius:12px;padding:14px;box-shadow:0 8px 30px rgba(2,6,23,0.6);display:flex;flex-direction:column}
    .hero{display:flex;align-items:center;gap:12px}
    .logo{width:40px;height:40px;border-radius:8px;background:linear-gradient(135deg,var(--accent),#3b82f6);display:flex;align-items:center;justify-content:center;font-weight:700;color:#fff}
    .lead{margin:6px 0 0;color:var(--muted)}
    .actions{display:flex;gap:8px;margin-top:12px}
    .btn{padding:8px 12px;border-radius:8px;border:0;cursor:pointer}
    .btn.primary{background:linear-gradient(90deg,var(--accent),#3b82f6);color:#fff}
    iframe{border:0;width:100%;height:100%;border-radius:8px}
    @media (max-width:900px){.sidebar{display:none}.layout{flex-direction:column}}
  </style>
</head>
<body>
  <div class="layout">
    <aside class="sidebar">
      <div class="brand">Vyre</div>
      <div class="muted">Local AI backend</div>
      <div class="lead">Run locally: ingestion, vector search, and model-backed chat.</div>
      <nav class="nav">
        <button data-page="chat" class="active">Chat</button>
        <button data-page="docs">Docs</button>
        <button data-page="about">About</button>
        <button data-page="settings">Settings</button>
      </nav>
      <div style="margin-top:18px" class="muted">Model</div>
      <select id="modelSelect" style="width:100%;margin-top:8px;padding:8px;border-radius:8px;background:transparent;color:var(--text);border:1px solid rgba(255,255,255,0.04)">
        <option value="gemma3:4b">gemma3:4b</option>
      </select>
    </aside>

    <main class="content">
      <div class="header">
        <div class="hero"><div class="logo">V</div><div><div style="font-weight:700">Vyre — Local AI backend</div><div class="lead">Private by default · experiment locally</div></div></div>
        <div class="actions"><a class="btn" href="/openapi.json">OpenAPI</a><a class="btn" href="/swagger">Swagger</a><button id="themeBtn" class="btn">Toggle Theme</button></div>
      </div>

      <div id="mainPanel" class="panel">
        <div id="page-chat" class="page" style="display:block;flex:1">
          <div style="display:flex;flex-direction:column;height:100%">
            <div style="flex:1;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:18px">Click Chat in the sidebar or open <a href="/chat-ui">/chat-ui</a> for the interactive chat UI.</div>
          </div>
        </div>
        <div id="page-docs" class="page" style="display:none;flex:1"><iframe src="/docs"></iframe></div>
        <div id="page-about" class="page" style="display:none;flex:1;padding:12px;overflow:auto">
          <h3>About Vyre</h3>
          <p>Vyre is a local-first backend for RAG workflows: ingestion, embeddings, vector search, and model-backed chat.</p>
          <h4>Progress</h4>
          <ul>
            <li>Migrations and SQLite store</li>
            <li>Ingest & embed workers</li>
            <li>Chat endpoint with retrieval</li>
            <li>OpenAPI + Swagger + ReDoc</li>
          </ul>
        </div>
        <div id="page-settings" class="page" style="display:none;flex:1;padding:12px;overflow:auto">
          <h3>Settings</h3>
          <p class="muted">Change runtime options and defaults.</p>
        </div>
      </div>
    </main>
  </div>

  <script>
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

    // populate models
    (async ()=>{ try{ const r = await fetch('/models'); const j = await r.json(); if(Array.isArray(j.models)){ const sel = document.getElementById('modelSelect'); sel.innerHTML=''; j.models.forEach(m=>{ const o=document.createElement('option'); o.value=m; o.text=m; sel.appendChild(o); }); } }catch(e){} })();
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
