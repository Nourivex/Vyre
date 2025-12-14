import React, { useEffect, useState } from "react";
import axios from "axios";
import { Plus, Upload, RefreshCw, ChevronRight, User, Server, Database } from 'lucide-react';
import { Agent, Conversation } from "../types/api";
import useStore from "../store/useStore";

export default function Sidebar() {
  const { agents, conversations, setAgents, setConversations, selectedAgentId, setSelectedAgent, ollamaStatus } = useStore();
  const [filterText, setFilterText] = useState('');

  useEffect(() => {
    let mounted = true;

    async function fetchConversations(){
      try{
        const res = await fetch('/conversations');
        if(!res.ok) throw new Error('no_endpoint');
        const j = await res.json();
        const convs = Array.isArray(j) ? j : j.conversations || [];
        if(mounted) setConversations(convs);
      }catch(e){
        if(mounted) setConversations([]);
      }
    }

    async function fetchAgents(){
      try{
        const res = await fetch('/agents');
        if(!res.ok) throw new Error('no_agents');
        const j = await res.json();
        const agents = Array.isArray(j) ? j : j.agents || [];
        if(mounted) setAgents(agents);
      }catch(e){
        try{
          const r = await fetch('/models');
          const jm = await r.json();
          const rows = Array.isArray(jm.models)? jm.models : [];
          if(mounted) setAgents(rows.map((m:string)=>({ id: `agent_${m}`, name: m, description: '', } as Agent)));
        }catch(e2){
          if(mounted) setAgents([]);
        }
      }
    }

    async function checkOllama(){
      try{
        const res = await fetch('/models');
        if(res.ok){ if(mounted) useStore.setState({ ollamaStatus: 'Ollama: Running' }); return; }
      }catch(e){}
      if(mounted) useStore.setState({ ollamaStatus: 'Ollama: Down (using fallback)' });
    }

    async function fetchCollections(){
      try{
        const res = await fetch('/collections');
        if(!res.ok) throw new Error('no_col');
        const j = await res.json();
        const cols = Array.isArray(j) ? j : j.collections || [];
        // store collections in conversations state temporarily (UI will map)
        if(mounted) useStore.setState({ /* no-op placeholder for future */ });
        return cols;
      }catch(e){
        return [];
      }
    }

    fetchConversations();
    fetchAgents();
    checkOllama();
    fetchCollections();

    return () => { mounted = false; };
  }, [setAgents, setConversations]);

  // handlers similar to legacy sidebar
  function renderConversationClick(c: Conversation){
    window.dispatchEvent(new CustomEvent('conversation:selected', { detail: c }));
  }

  async function handleNewConversation(){
    try{
      const res = await fetch('/conversations', { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ title: 'New conversation' }) });
      if(res.ok){ const j = await res.json(); window.dispatchEvent(new CustomEvent('conversation:new',{detail:j}));
        // refresh conversations
        const rr = await fetch('/conversations'); if(rr.ok){ const jj = await rr.json(); setConversations(Array.isArray(jj)? jj : jj.conversations || []); }
        return;
      }
    }catch(e){}
    const tmp = { id: 'local_'+Date.now(), title: 'New conversation' } as Conversation;
    setConversations([tmp, ...conversations]);
    window.dispatchEvent(new CustomEvent('conversation:new',{detail:tmp}));
  }

  async function handleAgentChange(e: React.ChangeEvent<HTMLSelectElement>){
    const val = e.target.value;
    const opt = e.target.selectedOptions[0];
    const model = opt?.getAttribute('data-model') || null;
    setSelectedAgent(val);
    window.dispatchEvent(new CustomEvent('agent:change',{detail:{agent_id:val, model}}));
  }

  async function handleRefreshCollections(){
    try{
      const res = await fetch('/collections');
      if(!res.ok) throw new Error('no_col');
      const j = await res.json();
      const cols = Array.isArray(j) ? j : j.collections || [];
      // emit event so other modules can pick it up
      window.dispatchEvent(new CustomEvent('collections:loaded',{detail:cols}));
    }catch(e){
      window.dispatchEvent(new CustomEvent('collections:loaded',{detail:[]}));
    }
  }

  function handleUpload(){
    const input = document.createElement('input'); input.type='file'; input.multiple=false; input.accept='*/*';
    input.onchange = async ()=>{
      const file = input.files[0];
      if(!file) return;
      const form = new FormData(); form.append('file', file);
      try{ await fetch('/ingest', { method:'POST', body: form }); alert('Uploaded'); }catch(e){ alert('Upload failed'); }
    };
    input.click();
  }

  // listen for bulk upload requests from other pages
  useEffect(() => {
    function onBulk(e: Event){ handleUpload(); }
    window.addEventListener('collections:bulk-upload', onBulk as EventListener);
    return () => window.removeEventListener('collections:bulk-upload', onBulk as EventListener);
  }, []);

  return (
    <div className="flex flex-col">

      <div className="mt-5 flex items-center justify-between">
        <div className="text-sm text-gray-500">Conversations</div>
        <button onClick={handleNewConversation} className="btn-modern primary text-sm flex items-center"> 
          <Plus className="w-4 h-4 mr-2" />
          New
        </button>
      </div>

      <input id="convFilter" placeholder="Search…" className="mt-3 w-full px-3 py-2 rounded-md border border-gray-200 bg-white text-sm input" value={filterText} onChange={(e)=>{ setFilterText(e.target.value); }} />

      <div id="convList" className="mt-3 overflow-auto max-h-72">
        {conversations.length === 0 && <div className="text-gray-500 py-4">No conversations</div>}
        {conversations.filter(c=> !filterText || (c.title||'').toLowerCase().includes(filterText.toLowerCase())).slice(0,50).map(c => (
          <div key={c.id} onClick={()=>renderConversationClick(c)} className="conv-item mb-2 hover:shadow-sm"> 
            <div className="avatar">{(c.title||'').charAt(0).toUpperCase() || 'C'}</div>
            <div style={{flex:1}}>
              <div className="conv-title">{c.title || ('Conversation '+(c.id||''))}</div>
              <div className="conv-meta">{c.updated_at ? new Date(c.updated_at).toLocaleString() : ''}</div>
            </div>
            <div className="text-xs text-gray-400"><ChevronRight className="w-4 h-4 text-gray-400" /></div>
          </div>
        ))}
      </div>

      <div className="mt-4 text-sm text-gray-500 flex items-center"><User className="w-4 h-4 mr-2 text-gray-500" />Agent</div>
      <div className="mt-2">
        <select id="agentSelect" value={selectedAgentId || '__none'} onChange={handleAgentChange} className="w-full border border-gray-200 rounded-md px-3 py-2 bg-white text-sm">
          <option value="__none">Default</option>
          {agents.map(a=> <option key={a.id} value={a.id} data-model={(a as any).model || ''}>{a.name || a.id}</option>)}
        </select>
      </div>
      <div id="ollamaStatus" className="text-xs text-gray-500 mt-2 flex items-center"><Server className="w-3 h-3 mr-2 text-gray-500" />{ollamaStatus || 'Ollama: checking…'}</div>

      <div className="mt-4">
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('navigate:collections'))}
          className="w-full flex items-center px-3 py-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          <Database className="w-4 h-4 mr-2 text-gray-500" />
          <span className="text-sm text-gray-500">Knowledge Base</span>
        </button>
      </div>
    </div>
  );
}
