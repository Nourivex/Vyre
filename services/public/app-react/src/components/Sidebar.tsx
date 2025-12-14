import React, { useEffect, useState } from "react";
import { Plus, ChevronRight, User, Server, Database } from 'lucide-react';
import { Conversation } from "../types/api";
import useStore from "../store/useStore";
import useSidebarLogic from "../hooks/useSidebarLogic";

export default function Sidebar() {
  const { agents, conversations, selectedAgentId, setSelectedAgent, ollamaStatus, selectedConversationId, setPage } = useStore();
  const [rawFilter, setRawFilter] = useState('');
  const [filterText, setFilterText] = useState('');
  const { handleNewConversation, selectConversation, handleUpload, refreshCollections } = useSidebarLogic();

  useEffect(() => {
    let mounted = true;
    // initialization handled inside useSidebarLogic; keep mounted guard for legacy listeners
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    console.debug('Sidebar: conversations in store', conversations?.length, conversations?.slice?.(0,3));
  }, [conversations]);

  // handlers
  function renderConversationClick(c: Conversation){
    selectConversation(c);
  }

  async function handleAgentChange(e: React.ChangeEvent<HTMLSelectElement>){
    const val = e.target.value;
    const opt = e.target.selectedOptions[0];
    const model = opt?.getAttribute('data-model') || null;
    setSelectedAgent(val);
    // expose to other parts via store if needed; for now just setting agent in store
  }

  async function handleRefreshCollections(){
    const cols = await refreshCollections();
    // future: store collections in global store or notify components via store
    return cols;
  }

  // useSidebarLogic provides `handleUpload` — no local implementation

  // keep legacy bulk-upload listener for now
  useEffect(() => {
    function onBulk(e: Event){ handleUpload(); }
    window.addEventListener('collections:bulk-upload', onBulk as EventListener);
    return () => window.removeEventListener('collections:bulk-upload', onBulk as EventListener);
  }, [handleUpload]);

  // debounce filter input
  useEffect(() => {
    const t = setTimeout(() => setFilterText(rawFilter), 250);
    return () => clearTimeout(t);
  }, [rawFilter]);

  return (
    <div className="flex flex-col">

      <div className="mt-5 flex items-center justify-between">
        <div className="text-sm text-gray-500">Conversations</div>
        <button onClick={handleNewConversation} className="btn-modern primary text-sm flex items-center"> 
          <Plus className="w-4 h-4 mr-2" />
          New
        </button>
      </div>

      <input id="convFilter" placeholder="Search…" className="mt-3 w-full px-3 py-2 rounded-md border border-gray-200 bg-white text-sm input" value={rawFilter} onChange={(e)=>{ setRawFilter(e.target.value); }} />

      <div id="convList" className="mt-3 overflow-auto max-h-72">
        {conversations.length === 0 && <div className="text-gray-500 py-4">No conversations</div>}
        {conversations.filter(c=> !filterText || (c.title||'').toLowerCase().includes(filterText.toLowerCase())).slice(0,50).map(c => (
          <div key={c.id} onClick={()=>renderConversationClick(c)} className={`conv-item mb-2 hover:shadow-sm ${selectedConversationId === c.id ? 'ring-2 ring-purple-400 rounded-md' : ''}`}> 
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
          onClick={() => setPage('collections')}
          className="w-full flex items-center px-3 py-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          <Database className="w-4 h-4 mr-2 text-gray-500" />
          <span className="text-sm text-gray-500">Knowledge Base</span>
        </button>
      </div>
    </div>
  );
}
