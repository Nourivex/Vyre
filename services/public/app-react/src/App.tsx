// App.jsx
import React, { useEffect, useState } from "react";
import Sidebar from "./components/Sidebar";
import { Settings } from 'lucide-react';
import SettingsModal from './components/SettingsModal';
import ChatInterface from "./pages/ChatInterface";
import KnowledgeBasePage from "./pages/KnowledgeBasePage";
import useStore from './store/useStore';

export default function App() {
  const { page, setPage, isSettingsOpen, setIsSettingsOpen } = useStore();
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

  // navigation and settings are handled via global store

  return (
    // toggle `dark` class by applying conditional className
    <div className={`${isDark ? 'dark' : ''}`}>
      <div className={`flex h-screen ${isDark ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'} font-sans`}>

        {/* app-sidebar */}
        <Sidebar isDark={isDark} setIsDark={setIsDark} setIsSettingsOpen={setIsSettingsOpen} />

        {/* app-main */}
        <main className="flex flex-col flex-1 p-6">
          {page === 'chat' ? <ChatInterface isDark={isDark} /> : <KnowledgeBasePage />}
        </main>
        <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} isDark={isDark} setIsDark={setIsDark} />
      </div>
    </div>
  );
}