import React, { useEffect, useState } from 'react';
import { Settings, Bell, Palette, Layers } from 'lucide-react';
import GeneralSettingsTab from './tabs/GeneralSettingsTab';
import NotificationsTab from './tabs/NotificationsTab';
import PersonalizationTab from './tabs/PersonalizationTab';
import ModelSettingsTab from './tabs/ModelSettingsTab';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  isDark: boolean;
  setIsDark: (v: boolean | ((x: boolean) => boolean)) => void;
};

type TabId = 'General' | 'Notifications' | 'Personalization' | 'Models';

const TABS: { id: TabId; title: string; Icon: any }[] = [
  { id: 'General', title: 'General', Icon: Settings },
  { id: 'Notifications', title: 'Notifications', Icon: Bell },
  { id: 'Personalization', title: 'Personalization', Icon: Palette },
  { id: 'Models', title: 'Models', Icon: Layers },
];

export default function SettingsModal({
  isOpen,
  onClose,
  isDark,
  setIsDark,
}: Props) {
  const [appearance, setAppearance] = useState<'system' | 'light' | 'dark'>(() => {
    try {
      const v = localStorage.getItem('vyre:theme');
      if (v === 'dark') return 'dark';
      if (v === 'light') return 'light';
      return 'system';
    } catch {
      return 'system';
    }
  });

  const [activeTab, setActiveTab] = useState<TabId>('General');

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    if (isOpen) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  function applyAppearance(v: typeof appearance) {
    setAppearance(v);
    try {
      localStorage.setItem('vyre:theme', v);
    } catch {}

    if (v === 'system') {
      const prefersDark =
        window.matchMedia &&
        window.matchMedia('(prefers-color-scheme: dark)').matches;
      setIsDark(prefersDark);
    } else {
      setIsDark(v === 'dark');
    }
  }

  /* ===========================
     THEME (ANTI TRANSPARAN)
     =========================== */
    // Sidebar tetap biru, border responsif tema
    const modalBg = 'bg-blue-50 dark:bg-blue-900/80'; // sidebar
    // Konten utama: dua var tergantung mode
    const contentBgDark = 'bg-gray-700 dark:bg-white';
    const contentBgLight = 'bg-gray-50 dark:bg-white';
    // Border modal: putih saat gelap, abu/gelap saat terang
    const modalBorder = 'border border-gray-900 dark:border-white';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/80"
        onClick={onClose}
      />

      {/* Modal */}
      <div
          className={`relative w-[900px] max-w-full h-[80vh] ${modalBorder} rounded-xl shadow-2xl overflow-hidden`}
      >
        {/* Close */}
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 z-20 p-2 rounded
          hover:bg-gray-100 dark:hover:bg-gray-900/30"
        >
          ✕
        </button>

        <div className="flex h-full">
          {/* Sidebar */}
          <nav
            className={`w-64 p-4 border-r border-gray-200 dark:border-gray-800 ${modalBg}`}
          >
            <div className="mb-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
              Settings
            </div>

            <div className="space-y-2">
              {TABS.map(tab => {
                const active = tab.id === activeTab;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2
                    rounded-md text-sm transition-colors
                    ${
                      active
                        ? 'bg-gray-600 text-white dark:bg-gray-700'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900/30'
                    }`}
                  >
                    <tab.Icon
                      className={`h-4 w-4 ${
                        active
                          ? 'text-white'
                          : 'text-gray-500 dark:text-gray-400'
                      }`}
                    />
                    <span>{tab.title}</span>
                  </button>
                );
              })}
            </div>
          </nav>

          {/* Content */}
          <section
            className={`flex-1 h-full overflow-auto p-6 ${isDark ? contentBgDark : contentBgLight} ${isDark ? 'text-gray-100' : 'text-gray-900'}`}
          >
            {/* Sticky Header */}
            <div
              className={`sticky top-0 z-10 pb-4 ${isDark ? contentBgDark : contentBgLight}`}
            >
              <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{activeTab}</h3>
            </div>

            <div className="mt-6">
              {activeTab === 'General' && (
                <GeneralSettingsTab
                  appearance={appearance}
                  applyAppearance={applyAppearance}
                />
              )}

              {activeTab === 'Notifications' && <NotificationsTab />}

              {activeTab === 'Personalization' && <PersonalizationTab />}

              {activeTab === 'Models' && <ModelSettingsTab />}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
