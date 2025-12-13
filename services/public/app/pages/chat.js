export function chatHTML() {
  return `
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
    </div>`;
}

export function initChatBehavior() {
  const messagesEl = document.getElementById('messages');
  const txt = document.getElementById('txt');
  const frm = document.getElementById('frm');
  let agent = null;
  let model = null;
  const collectionSelect = document.getElementById('collectionSelect');

  function appendMsg(role, text){ const d = document.createElement('div'); d.className = 'msg '+(role==='user'?'user':'assistant'); d.textContent = text; messagesEl.appendChild(d); messagesEl.scrollTop = messagesEl.scrollHeight; }

  frm.addEventListener('submit', async (e)=>{
    e.preventDefault(); const v = txt.value.trim(); if(!v) return; appendMsg('user', v); txt.value=''; appendMsg('assistant', '...');
    try{
      const payload = { role:'user', content: v };
      if(model) payload.model = model;
      if(agent) payload.agent_id = agent;
      const col = collectionSelect ? collectionSelect.value : null;
      if(col && col !== '__all') payload.collection_id = col;
      const res = await fetch('/chat', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
      const j = await res.json();
      const last = messagesEl.querySelectorAll('.msg.assistant');
      if(last.length) last[last.length-1].textContent = j.response || j.error || JSON.stringify(j);
    }catch(err){ const last = messagesEl.querySelectorAll('.msg.assistant'); if(last.length) last[last.length-1].textContent = 'Error: '+String(err.message||err); }
  });

  // respond to sidebar events
  window.addEventListener('agent:change', (e)=>{
    const d = e.detail || {};
    agent = d.agent_id || null;
    model = d.model || null;
  });

  window.addEventListener('conversation:new', (e)=>{
    // new conversation -> clear messages
    messagesEl.innerHTML = '';
  });

  window.addEventListener('conversation:selected', async (e)=>{
    const c = e.detail;
    // try to load messages for conversation if endpoint available
    try{
      const res = await fetch(`/conversations/${c.id}/messages`);
      if(res.ok){ const j = await res.json(); messagesEl.innerHTML = ''; (j.messages||[]).forEach(m=> appendMsg(m.role, m.content || m.text || JSON.stringify(m))); return; }
    }catch(e){}
    // fallback: just clear and set a notice
    messagesEl.innerHTML = '';
    appendMsg('assistant', `Opened: ${c.title||c.id}`);
  });
}
