(function(){
  const root = document.getElementById('app-root');
  root.innerHTML = `
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
            <div id="messages" class="messages"></div>
            <form id="frm" class="composer">
              <input id="txt" class="input" placeholder="Write a message..." autocomplete="off" />
              <button type="submit" class="btn primary">Send</button>
            </form>
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
  </div>`;

  // hookup
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

  // load models
  (async ()=>{ try{ const r = await fetch('/models'); const j = await r.json(); if(Array.isArray(j.models)){ modelSelect.innerHTML=''; j.models.forEach(m=>{ const o=document.createElement('option'); o.value=m; o.text=m; modelSelect.appendChild(o); }); } }catch(e){} })();
})();
