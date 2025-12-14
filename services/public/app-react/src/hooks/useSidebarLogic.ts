import { useEffect, useState, useCallback } from 'react';
import useStore from '../store/useStore';
import { Conversation, Agent } from '../types/api';

export default function useSidebarLogic() {
  const { setConversations, setAgents, setSelectedConversation, setPage, setOllamaStatus } = useStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchConversations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/conversations');
      if (!res.ok) throw new Error('failed');
      const j = await res.json();
      let convsRaw: any[] = Array.isArray(j) ? j : j.conversations || [];
      const convs: Conversation[] = convsRaw.map((c: any) => ({
        id: c.id || c.conversation_id || c.conversationId || String(c._id || ''),
        title: c.title || (c.meta && c.meta.title) || '',
        updated_at: c.updated_at || c.updatedAt || null,
      }));
      console.debug('useSidebarLogic: fetched conversations', convs.length, convsRaw.length, j);
      setConversations(convs);
      setError(null);
    } catch (e) {
      console.error('useSidebarLogic: fetchConversations failed', e);
      setConversations([]);
      setError('failed');
    } finally {
      setLoading(false);
    }
  }, [setConversations]);

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch('/agents');
      if (!res.ok) throw new Error('no_agents');
      const j = await res.json();
      const a: Agent[] = Array.isArray(j) ? j : j.agents || [];
      setAgents(a);
    } catch (e) {
      try {
        const r = await fetch('/models');
        const jm = await r.json();
        const rows = Array.isArray(jm.models) ? jm.models : [];
        setAgents(rows.map((m: string) => ({ id: `agent_${m}`, name: m, description: '' } as Agent)));
      } catch (e2) {
        setAgents([]);
      }
    }
  }, [setAgents]);

  const checkOllama = useCallback(async () => {
    try {
      const res = await fetch('/models');
      if (res.ok) { setOllamaStatus && setOllamaStatus('Ollama: Running'); return; }
    } catch (e) {}
    setOllamaStatus && setOllamaStatus('Ollama: Down (using fallback)');
  }, [setOllamaStatus]);

  useEffect(() => {
    fetchConversations();
    fetchAgents();
    checkOllama();
  }, [fetchConversations, fetchAgents, checkOllama]);

  const handleNewConversation = useCallback(async () => {
    try {
      const res = await fetch('/conversations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'New conversation' }) });
      if (res.ok) {
        await fetchConversations();
        return;
      }
    } catch (e) {}
    // fallback: create a local conv and prepend to existing store list
    const tmp = { id: 'local_' + Date.now(), title: 'New conversation' } as Conversation;
    try{
      const curr = useStore.getState().conversations || [];
      setConversations([tmp, ...curr]);
    }catch(e){
      setConversations([tmp]);
    }
  }, [fetchConversations, setConversations]);

  const selectConversation = useCallback(async (c: Conversation) => {
    if (!c || !c.id) return;
    try {
      // fetch messages (may be used elsewhere)
      await fetch(`/conversations/${encodeURIComponent(c.id)}/messages`);
    } catch (e) {}
    setSelectedConversation(c.id);
    setPage('chat');
  }, [setSelectedConversation, setPage]);

  const refreshCollections = useCallback(async () => {
    try {
      const res = await fetch('/collections');
      const j = await res.json();
      const cols = Array.isArray(j) ? j : j.collections || [];
      // emit via store for now
      return cols;
    } catch (e) {
      return [];
    }
  }, []);

  const handleUpload = useCallback(() => {
    const input = document.createElement('input'); input.type = 'file'; input.multiple = false; input.accept = '*/*';
    input.onchange = async () => {
      if (!input.files || input.files.length === 0) return;
      const file = input.files[0];
      const form = new FormData(); form.append('file', file);
      try { await fetch('/ingest', { method: 'POST', body: form }); alert('Uploaded'); } catch (e) { alert('Upload failed'); }
    };
    input.click();
  }, []);

  return {
    loading,
    error,
    fetchConversations,
    fetchAgents,
    handleNewConversation,
    selectConversation,
    refreshCollections,
    handleUpload,
  };
}
