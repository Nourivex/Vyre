export function sidebarHTML() {
  return `
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

      <div style="margin-top:18px;display:flex;align-items:center;justify-content:space-between">
        <div class="muted">Conversations</div>
        <button id="newConvBtn" class="btn small">+ New</button>
      </div>
      <input id="convFilter" placeholder="Search…" style="width:100%;margin-top:8px;padding:8px;border-radius:8px;border:1px solid rgba(255,255,255,0.04);background:transparent;color:var(--text)" />
      <div id="convList" style="margin-top:8px;max-height:180px;overflow:auto"></div>

      <div style="margin-top:12px" class="muted">Agent</div>
      <select id="agentSelect" style="width:100%;margin-top:8px;padding:8px;border-radius:8px;background:transparent;color:var(--text);border:1px solid rgba(255,255,255,0.04)">
        <option value="__none">Default</option>
      </select>
      <div id="ollamaStatus" class="muted" style="margin-top:6px;font-size:12px">Ollama: checking…</div>

      <div style="margin-top:12px" class="muted">Knowledge Base</div>
      <select id="collectionSelect" style="width:100%;margin-top:8px;padding:8px;border-radius:8px;background:transparent;color:var(--text);border:1px solid rgba(255,255,255,0.04)">
        <option value="__all">All</option>
      </select>
      <div style="display:flex;gap:8px;margin-top:8px">
        <button id="uploadBtn" class="btn small">Upload</button>
        <button id="refreshCollections" class="btn small">Refresh</button>
      </div>
    </aside>`;
}

export function attachSidebarHandlers(root) {
  const convListEl = document.getElementById('convList');
  const convFilter = document.getElementById('convFilter');
  const newConvBtn = document.getElementById('newConvBtn');
  const agentSelect = document.getElementById('agentSelect');
  const ollamaStatus = document.getElementById('ollamaStatus');
  const collectionSelect = document.getElementById('collectionSelect');
  const uploadBtn = document.getElementById('uploadBtn');
  const refreshCollections = document.getElementById('refreshCollections');

  let conversations = [];

  async function fetchConversations(){
    try{
      const res = await fetch('/conversations');
      if(!res.ok) throw new Error('no_endpoint');
      const j = await res.json();
      conversations = Array.isArray(j) ? j : j.conversations || [];
    }catch(e){
      // fallback: empty list
      conversations = [];
    }
    renderConversations();
  }

  function renderConversations(filter){
    const f = (filter||'').toLowerCase();
    convListEl.innerHTML = '';
    conversations.filter(c=> !f || (c.title||'').toLowerCase().includes(f)).slice(0,50).forEach(c=>{
      const el = document.createElement('div');
      el.className = 'muted';
      el.style.padding = '8px';
      el.style.borderRadius = '8px';
      el.style.cursor = 'pointer';
      el.textContent = c.title || ('Conversation '+(c.id||''));
      el.addEventListener('click', ()=>{
        // emit event for chat module
        window.dispatchEvent(new CustomEvent('conversation:selected',{detail:c}));
      });
      convListEl.appendChild(el);
    });
  }

  convFilter.addEventListener('input', ()=> renderConversations(convFilter.value));

  newConvBtn.addEventListener('click', async ()=>{
    // try to create via API, fallback to client-side event
    try{
      const res = await fetch('/conversations', { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ title: 'New conversation' }) });
      if(res.ok){ const j = await res.json(); window.dispatchEvent(new CustomEvent('conversation:new',{detail:j})); fetchConversations(); return; }
    }catch(e){}
    const tmp = { id: 'local_'+Date.now(), title: 'New conversation' };
    conversations.unshift(tmp);
    renderConversations();
    window.dispatchEvent(new CustomEvent('conversation:new',{detail:tmp}));
  });

  async function fetchAgents(){
    try{
      const res = await fetch('/agents');
      if(!res.ok) throw new Error('no_agents');
      const j = await res.json();
      const agents = Array.isArray(j) ? j : j.agents || [];
      agentSelect.innerHTML = '<option value="__none">Default</option>' + agents.map(a=>`<option value="${a.id}" data-model="${a.model||''}">${a.name||a.id}</option>`).join('');
    }catch(e){
      // fallback: load models as agents
      try{
        const r = await fetch('/models');
        const jm = await r.json();
        const rows = Array.isArray(jm.models)? jm.models : [];
        agentSelect.innerHTML = '<option value="__none">Default</option>' + rows.map(m=>`<option value="agent_${m}" data-model="${m}">${m}</option>`).join('');
      }catch(e2){
        agentSelect.innerHTML = '<option value="__none">Default</option>';
      }
    }
  }

  agentSelect.addEventListener('change', ()=>{
    const opt = agentSelect.options[agentSelect.selectedIndex];
    const model = opt?.dataset?.model || null;
    window.dispatchEvent(new CustomEvent('agent:change',{detail:{agent_id:agentSelect.value, model}}));
  });

  async function checkOllama(){
    try{
      const res = await fetch('/models');
      if(res.ok){ ollamaStatus.textContent = 'Ollama: Running'; return; }
    }catch(e){}
    ollamaStatus.textContent = 'Ollama: Down (using fallback)';
  }

  async function fetchCollections(){
    try{
      const res = await fetch('/collections');
      if(!res.ok) throw new Error('no_col');
      const j = await res.json();
      const cols = Array.isArray(j) ? j : j.collections || [];
      collectionSelect.innerHTML = '<option value="__all">All</option>' + cols.map(c=>`<option value="${c.id}">${c.name||c.id}</option>`).join('');
    }catch(e){
      collectionSelect.innerHTML = '<option value="__all">All</option>';
    }
  }

  refreshCollections.addEventListener('click', fetchCollections);
  uploadBtn.addEventListener('click', ()=>{
    // open a file picker and POST to /ingest if available
    const input = document.createElement('input'); input.type='file'; input.multiple=false; input.accept='*/*';
    input.onchange = async ()=>{
      const file = input.files[0];
      if(!file) return;
      const form = new FormData(); form.append('file', file);
      try{ await fetch('/ingest', { method:'POST', body: form }); alert('Uploaded'); }catch(e){ alert('Upload failed'); }
    };
    input.click();
  });

  // init
  fetchConversations();
  fetchAgents();
  checkOllama();
  fetchCollections();
}
