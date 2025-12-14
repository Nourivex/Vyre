// App.jsx
import React, { useEffect, useState } from "react";
import Sidebar from "./components/Sidebar";
import { Settings } from 'lucide-react';
import ChatInterface from "./pages/ChatInterface";
import KnowledgeBasePage from "./pages/KnowledgeBasePage";

export default function App() {
  const [page, setPage] = useState<'chat'|'collections'>('chat');
  const [isDark, setIsDark] = useState<boolean>(() => {
    try {
      const v = localStorage.getItem('vyre:theme');
      if (v === 'dark') return true;
      if (v === 'light') return false;
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch (e) {
      return true;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('vyre:theme', isDark ? 'dark' : 'light');
    } catch (e) {}
  }, [isDark]);

  useEffect(() => {
    try {
      const doc = document.documentElement;
      if (isDark) doc.classList.add('dark');
      else doc.classList.remove('dark');
    } catch (e) {}
  }, [isDark]);

  useEffect(() => {
    function onNavigate(e: CustomEvent){ setPage('collections'); }
    function onOpenChat(e: CustomEvent){ setPage('chat'); }
    window.addEventListener('navigate:collections', onNavigate as EventListener);
    window.addEventListener('open:chat', onOpenChat as EventListener);
    return () => {
      window.removeEventListener('navigate:collections', onNavigate as EventListener);
      window.removeEventListener('open:chat', onOpenChat as EventListener);
    };
  }, []);

  return (
    // toggle `dark` class by applying conditional className
    <div className={`${isDark ? 'dark' : ''}`}>
      <div className={`flex h-screen ${isDark ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'} font-sans`}>

        {/* app-sidebar */}
        <aside className={`w-64 flex-shrink-0 border-r ${isDark ? 'bg-[rgba(31,41,55,0.5)] border-gray-800' : 'bg-white border-gray-200'}`}>
          <div className="p-4 flex flex-col h-full">
            <div className="flex items-center justify-between">
              <div>
                <div className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Vyre <span className={`text-xs ml-1 ${isDark ? 'text-purple-300' : 'text-purple-600'}`}>v0.1</span></div>
              </div>
              <div>
                <button
                  onClick={() => setIsDark(d => !d)}
                  className="theme-toggle btn-press"
                  aria-label="Toggle theme"
                >
                  {isDark ? (
                    <svg className="icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" fill="currentColor" />
                    </svg>
                  ) : (
                    <svg className="icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 3v2M12 19v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42M12 7a5 5 0 100 10 5 5 0 000-10z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto mt-4">
              <Sidebar />
            </div>

            <div className="mt-4 text-xs text-gray-400 pt-3 border-t flex items-center justify-between" style={{borderColor: isDark ? 'rgba(148,163,184,0.08)' : undefined}}>
              <span>Status: Ollama Ready</span>
              <button
                onClick={() => window.dispatchEvent(new CustomEvent('open:settings'))}
                aria-label="Open settings"
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <Settings className="w-4 h-4 text-gray-400" />
              </button>
            </div>
          </div>
        </aside>

        {/* app-main */}
        <main className="flex flex-col flex-1 p-6">
          {page === 'chat' ? <ChatInterface isDark={isDark} /> : <KnowledgeBasePage />}
        </main>
      </div>
    </div>
  );
}