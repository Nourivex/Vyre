import React, { useEffect, useRef, useState } from "react";
import { createPortal } from 'react-dom';
import { Plus, User, Server, Database, Settings, Moon, Sun, Search, FolderPlus, MoreHorizontal, Edit3, Share2, Trash2, LayoutPanelLeft, MessageSquare } from 'lucide-react';
import { Conversation } from "../types/api";
import useStore from "../store/useStore";
import useSidebarLogic from "../hooks/useSidebarLogic";

type Props = {
    isDark: boolean;
    setIsDark: React.Dispatch<React.SetStateAction<boolean>>;
    setIsSettingsOpen: (v: boolean) => void;
};

export default function Sidebar({ isDark, setIsDark, setIsSettingsOpen }: Props) {
    const { 
        conversations, 
        selectedAgentId, 
        ollamaStatus, 
        selectedConversationId, 
        setPage,
        page,
        setSelectedConversation
    } = useStore();
    
    // Debouncing logic (Keep this smart part!)
    const [rawFilter, setRawFilter] = useState('');
    const [filterText, setFilterText] = useState('');
    // collapsed sidebar state (persisted to localStorage)
    const [collapsed, setCollapsed] = useState<boolean>(() => {
        try {
            return localStorage.getItem('sidebarCollapsed') === 'true';
        } catch (e) {
            return false;
        }
    });
    // preview when cursor hovers near collapsed sidebar
    const [previewOpen, setPreviewOpen] = useState(false);

    // persist collapsed state to localStorage
    useEffect(() => {
        try {
            localStorage.setItem('sidebarCollapsed', collapsed ? 'true' : 'false');
        } catch (e) {
            // ignore
        }
    }, [collapsed]);
    
    // Logic/Handlers dari Custom Hook
    const { 
        handleNewConversation, 
        selectConversation, 
        handleUpload, 
        refreshCollections,
        fetchConversations
    } = useSidebarLogic();

    // Debounce filter input
    useEffect(() => {
        const t = setTimeout(() => setFilterText(rawFilter), 250);
        return () => clearTimeout(t);
    }, [rawFilter]);

    // Handle incoming conversation select
    function renderConversationClick(c: Conversation){
        selectConversation(c);
    }

    // Context menu state for conversation actions
    const [menuOpenFor, setMenuOpenFor] = useState<string | null>(null);
    const menuRef = useRef<HTMLDivElement | null>(null);

    // Rename / Delete modal state
    const [renameTarget, setRenameTarget] = useState<{ id: string; title?: string } | null>(null);
    const [renameValue, setRenameValue] = useState('');
    const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

    const { setConversations } = useStore();
    // Toast notifications
    type Toast = { id: string; type: 'success'|'error'|'info'; message: string };
    const [toasts, setToasts] = useState<Toast[]>([]);
    function showToast(type: Toast['type'], message: string, timeout = 3500){
        const id = String(Date.now()) + Math.random().toString(36).slice(2,6);
        const t = { id, type, message } as Toast;
        setToasts(s => [...s, t]);
        setTimeout(() => setToasts(s => s.filter(x => x.id !== id)), timeout);
    }

    useEffect(() => {
        function onDoc(e: MouseEvent){
            const target = e.target as HTMLElement;
            if (!menuOpenFor) return;
            if (!target) return setMenuOpenFor(null);
            if (menuRef.current && menuRef.current.contains(target)) return;
            setMenuOpenFor(null);
        }
        document.addEventListener('click', onDoc);

        // handlers for custom events emitted by menu
        function onRename(e: Event){
            const ev = e as CustomEvent; const id = ev.detail?.id; if (!id) return;
            console.log('event received: conversation:rename', id);
            const conv = useStore.getState().conversations?.find((x)=>x.id === id);
            setRenameTarget({ id, title: conv?.title });
            setRenameValue(conv?.title || '');
            console.log('rename modal target set', id, conv?.title);
        }
        function onShare(e: Event){
            const ev = e as CustomEvent; const id = ev.detail?.id; if (!id) return;
            console.log('event received: conversation:share', id);
            // simple share: copy a link containing the conversation id
            const url = `${window.location.origin}${window.location.pathname}?share=${encodeURIComponent(id)}`;
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(url).then(()=> showToast('success', 'Share link copied to clipboard'))
                .catch(()=> showToast('error', 'Failed to copy link to clipboard'));
            } else {
                try { (window as any).clipboardData.setData('Text', url); showToast('success','Share link copied'); } catch(e){ showToast('info', url); }
            }
        }
        function onDelete(e: Event){
            const ev = e as CustomEvent; const id = ev.detail?.id; if (!id) return;
            console.log('event received: conversation:delete', id);
            setDeleteTarget(id);
        }

        window.addEventListener('conversation:rename', onRename as EventListener);
        window.addEventListener('conversation:share', onShare as EventListener);
        window.addEventListener('conversation:delete', onDelete as EventListener);

        return () => {
            document.removeEventListener('click', onDoc);
            window.removeEventListener('conversation:rename', onRename as EventListener);
            window.removeEventListener('conversation:share', onShare as EventListener);
            window.removeEventListener('conversation:delete', onDelete as EventListener);
        };
    }, [menuOpenFor]);
    
    // Handle Agent Change
    // (Agent selector removed from footer; agent change handled elsewhere if needed)

    // Handle Bulk Upload Event (Clean)
    useEffect(() => {
        function onBulk(e: Event){ handleUpload(); }
        window.addEventListener('collections:bulk-upload', onBulk as EventListener);
        return () => window.removeEventListener('collections:bulk-upload', onBulk as EventListener);
    }, [handleUpload]); 

    // Styles for dark/light mode consistency
    const sidebarBg = isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200';
    const textColor = isDark ? 'text-gray-100' : 'text-gray-900';
    const subtextColor = isDark ? 'text-gray-400' : 'text-gray-500';
    
    // Input/Select general style
    const inputStyle = `w-full p-2 rounded-lg text-sm transition focus:ring-2 focus:ring-purple-500 
      ${isDark 
        ? 'bg-gray-700 border border-gray-600 text-white placeholder-gray-400' 
        : 'bg-white border border-gray-300 text-gray-900 placeholder-gray-500'
      }`;

        // Status logic (colored) - guard when ollamaStatus is undefined
        const _ollama = typeof ollamaStatus === 'string' ? ollamaStatus : '';
        const statusColor = _ollama.includes('Running')
            ? 'text-green-500'
            : _ollama.includes('Down')
                ? 'text-red-500'
                : 'text-yellow-500';

    return (
        <aside
            className={`${collapsed ? 'w-16' : 'w-64'} flex-shrink-0 border-r ${sidebarBg} transition-all duration-150 relative`}
        >
            <div className={`${collapsed ? 'p-2' : 'p-4'} flex flex-col h-full`}>
                
                {/* --- 1. HEADER & GLOBAL ACTIONS --- */}
                <div className={`flex items-center justify-between ${collapsed ? 'py-2 h-14' : 'pb-4'} border-b border-gray-700/50 relative`}>
                    {/* Left: logo/title (hidden when collapsed) */}
                    {!collapsed ? (
                        <div className="flex items-center">
                            <div className={`text-xl font-extrabold ${textColor}`}>Vyre</div>
                            <span className={`text-xs ml-1 ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>v0.1</span>
                        </div>
                    ) : (
                        <div className="w-0" />
                    )}

                    {/* Centered control when collapsed so it lines up with New Chat */}
                    {collapsed && (
                        <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2">
                            <div
                                onMouseEnter={() => setPreviewOpen(true)}
                                onMouseLeave={() => setPreviewOpen(false)}
                                className={`w-10 h-10 flex items-center justify-center rounded-md border ${isDark ? 'bg-gray-800 border-gray-700 text-gray-200' : 'bg-white border-gray-200 text-gray-700'}`}
                            >
                                {!previewOpen ? (
                                    <div className="font-extrabold">V</div>
                                ) : (
                                    <button
                                        onClick={() => setCollapsed(false)}
                                        className={`p-2 rounded-full ${isDark ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-100 text-gray-600'}`}
                                        aria-label="Open sidebar"
                                    >
                                        <LayoutPanelLeft className="w-5 h-5" />
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Right-side controls (only when not collapsed) */}
                    <div className="flex items-center gap-1 relative">
                        {!collapsed && (
                            <button
                                onClick={() => setCollapsed(s => !s)}
                                className={`p-2 rounded-full ${isDark ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-100 text-gray-600'}`}
                                aria-label="Toggle sidebar"
                            >
                                <LayoutPanelLeft className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                </div>

                {/* --- 2. MAIN ACTIONS (NEW CHAT) & FILTER --- */}
                <div className={`py-3 ${collapsed ? 'px-1' : ''}`}>
                    <button 
                        onClick={handleNewConversation} 
                        className={`w-full py-2 rounded-lg font-semibold flex items-center justify-center gap-2 transition duration-150 shadow-md 
                            ${isDark ? 'bg-purple-600 hover:bg-purple-700 text-white' : 'bg-purple-500 hover:bg-purple-600 text-white'}
                        `}
                    >
                        <Plus className="w-4 h-4" /> {!collapsed && 'Start New Chat'}
                    </button>

                    {/* --- Library / Projects (stacked full-width buttons) --- */}
                    <div className={`mt-3 flex flex-col gap-2 ${collapsed ? 'items-center' : ''}`}>
                        <button
                            onClick={() => { setPage('collections'); setSelectedConversation(undefined); showToast('info','Knowledge Base opened'); }}
                            className={`w-full flex items-center justify-center ${collapsed ? 'justify-center px-2' : 'gap-2'} py-2 rounded-lg text-sm font-medium transition shadow-sm
                                ${page === 'collections' ? (isDark ? 'bg-purple-600 text-white' : 'bg-purple-500 text-white') : (isDark ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-700')}
                            `}
                        >
                            <Database className="w-4 h-4" /> {!collapsed && 'Knowledge Base'}
                        </button>

                        <button
                            onClick={() => { setPage('collections'); setSelectedConversation(undefined); showToast('info','Projects opened'); }}
                            className={`w-full flex items-center justify-center ${collapsed ? 'justify-center px-2' : 'gap-2'} py-2 rounded-lg text-sm font-medium transition shadow-sm
                                ${page === 'collections' ? (isDark ? 'bg-purple-600 text-white' : 'bg-purple-500 text-white') : (isDark ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-700')}
                            `}
                        >
                            <FolderPlus className="w-4 h-4" /> {!collapsed && 'Projects Baru'}
                        </button>
                    </div>

                    {/* Filter Input with Icon (moved below the action buttons) */}
                    <div className="relative mt-3">
                        <Search className={`w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 ${subtextColor}`} />
                        <input 
                            placeholder="Search conversations..." 
                            value={rawFilter} 
                            onChange={e => setRawFilter(e.target.value)} 
                            className={`w-full py-2 pl-9 pr-3 rounded-lg text-sm transition focus:border-purple-500 focus:ring-1 focus:ring-purple-500 
                                ${isDark 
                                    ? 'bg-gray-700 border border-gray-600 text-white placeholder-gray-400' 
                                    : 'bg-white border border-gray-300 text-gray-900 placeholder-gray-500'
                                }
                            `} 
                        />
                    </div>
                </div>

                {/* --- 3. CONVERSATION LIST (Scrollable) --- */}
                        <div className={`flex-1 overflow-y-auto thin-scrollbar scroll-flush ${page !== 'chat' ? 'opacity-60' : ''}`}>
                    <div className={`${subtextColor} text-sm font-medium mb-2`}>{!collapsed ? 'Recent Chats' : 'Recent'} {page !== 'chat' && !collapsed && <span className="text-xs ml-2 text-gray-400">(click to open chat)</span>}</div>
                    
                    {/* Filtered List */}
                    {(conversations || [])
                        .filter(c => !filterText || (c.title || '').toLowerCase().includes(filterText.toLowerCase()))
                        .map(c => {
                            const isActive = page === 'chat' && selectedConversationId === c.id;
                            const itemClass = isActive 
                                ? (isDark ? 'bg-purple-800/30 text-purple-300 border-l-4 border-purple-500 font-semibold' : 'bg-blue-100 text-blue-800 border-l-4 border-blue-500 font-semibold')
                                : (isDark ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-100 text-gray-700');
                            if (collapsed) {
                                return (
                                    <div
                                        key={c.id}
                                        className={`group relative p-1 cursor-pointer transition duration-150 mb-1 flex items-center justify-center ${itemClass}`}
                                        onClick={() => renderConversationClick(c)}
                                    >
                                        <MessageSquare className="w-5 h-5 text-gray-500" />
                                    </div>
                                );
                            }

                            return (
                                <div 
                                    key={c.id} 
                                    className={`group relative p-2 rounded-r-lg cursor-pointer transition duration-150 mb-1 flex items-center justify-between ${itemClass}`} 
                                    onClick={() => renderConversationClick(c)}
                                >
                                    <div className="truncate text-sm pr-2">
                                        <div className="truncate">{c.title || 'Untitled Conversation'}</div>
                                        {c.updated_at && (
                                            <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                                {new Date(c.updated_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-2">
                                        {/* More button - visible only on hover (ChatGPT style) */}
                                        <div className="relative">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setMenuOpenFor(menuOpenFor === c.id ? null : c.id); }}
                                                className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 p-1 rounded-md hover:bg-gray-100"
                                                aria-label="More"
                                            >
                                                <MoreHorizontal className="w-4 h-4 text-gray-500" />
                                            </button>

                                            {/* Floating menu for this conversation */}
                                            {menuOpenFor === c.id && (
                                                <div ref={menuRef} className={`absolute right-0 top-full mt-2 min-w-[140px] z-50 rounded-md border ${isDark ? 'bg-gray-900 border-gray-800 text-gray-100' : 'bg-white border-gray-200 text-gray-900'} shadow-md`}>
                                                    <ul className="py-1">
                                                        <li>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); setMenuOpenFor(null); console.log('menu: rename clicked', c.id); window.dispatchEvent(new CustomEvent('conversation:rename',{detail:{id:c.id}})); }}
                                                                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 flex items-center gap-2"
                                                            >
                                                                <Edit3 className="w-4 h-4" /> Ubah judul
                                                            </button>
                                                        </li>
                                                        <li>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); setMenuOpenFor(null); console.log('menu: share clicked', c.id); window.dispatchEvent(new CustomEvent('conversation:share',{detail:{id:c.id}})); }}
                                                                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 flex items-center gap-2"
                                                            >
                                                                <Share2 className="w-4 h-4" /> Share
                                                            </button>
                                                        </li>
                                                        <li>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); setMenuOpenFor(null); console.log('menu: delete clicked', c.id); window.dispatchEvent(new CustomEvent('conversation:delete',{detail:{id:c.id}})); }}
                                                                className="w-full text-left px-3 py-2 text-sm hover:bg-red-50 hover:text-red-600 flex items-center gap-2"
                                                            >
                                                                <Trash2 className="w-4 h-4" /> Hapus
                                                            </button>
                                                        </li>
                                                    </ul>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        
                    {/* Fallback if no conversations */}
                    {(conversations?.length === 0) && <div className={`${subtextColor} text-center mt-6 text-sm`}>No history yet.</div>}
                </div>

                {/* --- 4. FOOTER (Agent, KB, Status) --- */}
                <div className="pt-4 mt-auto border-t border-gray-700/50">
                    <div className="flex items-center justify-between">
                        <div className={`text-xs flex items-center gap-1 ${subtextColor}`}>
                            <Server className={`w-3 h-3 ${statusColor}`} />
                            <span className={statusColor}>Status: {ollamaStatus || 'Unknown'}</span>
                        </div>

                        {/* Moved Settings button next to status (bottom-right) */}
                        <button
                            onClick={() => setIsSettingsOpen(true)}
                            className={`p-2 rounded-lg ${isDark ? 'hover:bg-gray-800 text-gray-300' : 'hover:bg-gray-100 text-gray-600'}`}
                            aria-label="Open settings"
                        >
                            <Settings className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>
            {/* Rename Modal (simple) - rendered in portal */}
            {renameTarget && createPortal(
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/40" onClick={() => setRenameTarget(null)} />
                    <div className={`relative z-10 w-full max-w-md p-4 rounded-md ${isDark ? 'bg-gray-900 text-gray-100' : 'bg-white text-gray-900'} border` }>
                        <div className="text-lg font-medium mb-2">Ubah Judul</div>
                        <input value={renameValue} onChange={e=>setRenameValue(e.target.value)} className={`w-full p-2 rounded-md mb-3 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'}`} />
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setRenameTarget(null)} className="px-3 py-1 rounded-md">Batal</button>
                            <button onClick={async () => {
                                const id = renameTarget.id; const newTitle = renameValue.trim();
                                setRenameTarget(null);
                                if (!newTitle) return alert('Title cannot be empty');
                                try {
                                    const res = await fetch(`/conversations/${encodeURIComponent(id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: newTitle }) });
                                    if (!res.ok) throw new Error('failed');
                                    await fetchConversations();
                                    showToast('success','Title updated');
                                    return;
                                } catch (e) {
                                    // fallback: update store locally
                                    const curr = useStore.getState().conversations || [];
                                    const updated = curr.map(c => c.id === id ? { ...c, title: newTitle } : c);
                                    setConversations(updated);
                                    showToast('success','Title updated (offline)');
                                }
                            }} className="px-3 py-1 rounded-md bg-purple-600 text-white">Simpan</button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Delete Confirm Modal - rendered in portal */}
            {deleteTarget && createPortal(
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/40" onClick={() => setDeleteTarget(null)} />
                    <div className={`relative z-10 w-full max-w-sm p-4 rounded-md ${isDark ? 'bg-gray-900 text-gray-100' : 'bg-white text-gray-900'} border` }>
                        <div className="text-lg font-medium mb-2">Hapus Percakapan?</div>
                        <div className="mb-4 text-sm">Percakapan ini akan dihapus. Tindakan ini tidak dapat dibatalkan.</div>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setDeleteTarget(null)} className="px-3 py-1 rounded-md">Batal</button>
                            <button onClick={async () => {
                                const id = deleteTarget; setDeleteTarget(null);
                                try {
                                    const res = await fetch(`/conversations/${encodeURIComponent(id)}`, { method: 'DELETE' });
                                    if (!res.ok) throw new Error('failed');
                                    await fetchConversations();
                                    showToast('success','Conversation deleted');
                                    return;
                                } catch (e) {
                                    // fallback: remove from store locally
                                    const curr = useStore.getState().conversations || [];
                                    const updated = curr.filter(c => c.id !== id);
                                    setConversations(updated);
                                    showToast('success','Conversation deleted (offline)');
                                }
                            }} className="px-3 py-1 rounded-md bg-red-600 text-white">Hapus</button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Toast container - rendered in portal */}
            {createPortal(
                <div className="fixed bottom-6 right-6 z-60 flex flex-col items-end gap-2 pointer-events-none">
                    {toasts.map(t => (
                        <div key={t.id} className={`pointer-events-auto max-w-xs w-full rounded-md px-3 py-2 shadow-lg border ${t.type === 'success' ? 'bg-white border-green-200' : t.type === 'error' ? 'bg-white border-red-200' : 'bg-white border-gray-200'}`}>
                            <div className="flex items-center gap-2">
                                <div className={`text-sm ${t.type === 'success' ? 'text-green-700' : t.type === 'error' ? 'text-red-700' : 'text-gray-700'}`}>{t.message}</div>
                                <button className="ml-2 text-xs text-gray-400" onClick={() => setToasts(s => s.filter(x => x.id !== t.id))}>✕</button>
                            </div>
                        </div>
                    ))}
                </div>,
                document.body
            )}
        </aside>
    );
}