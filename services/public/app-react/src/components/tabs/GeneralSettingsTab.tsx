import React, { useEffect, useState } from 'react';

type Props = {
  appearance: 'system'|'light'|'dark';
  applyAppearance: (v: 'system'|'light'|'dark') => void;
};

const ACCENTS = [
  { id: 'purple', color: '#7c3aed' },
  { id: 'green', color: '#10b981' },
  { id: 'blue', color: '#2563eb' },
  { id: 'teal', color: '#14b8a6' },
  { id: 'gray', color: '#6b7280' }
];

function setAccentCSS(hex: string) {
  try {
    const root = document.documentElement;
    root.style.setProperty('--accent-color', hex);
    // small darker hover variant
    const darker = shadeColor(hex, -12);
    root.style.setProperty('--accent-color-hover', darker);
  } catch (e) {
    // noop
  }
}

// simple shade function (amount -100..100)
function shadeColor(hex: string, percent: number) {
  const h = hex.replace('#','');
  const num = parseInt(h,16);
  let r = (num >> 16) + Math.round(255 * (percent/100));
  let g = ((num >> 8) & 0x00FF) + Math.round(255 * (percent/100));
  let b = (num & 0x0000FF) + Math.round(255 * (percent/100));
  r = Math.max(0, Math.min(255, r));
  g = Math.max(0, Math.min(255, g));
  b = Math.max(0, Math.min(255, b));
  return `#${(r<<16 | g<<8 | b).toString(16).padStart(6,'0')}`;
}

export default function GeneralSettingsTab({ appearance, applyAppearance }: Props) {
  const [accent, setAccent] = useState<string>(() => {
    if (typeof window === 'undefined') return ACCENTS[0].color;
    return localStorage.getItem('accentColor') || ACCENTS[0].color;
  });

  useEffect(() => {
    setAccentCSS(accent);
    try { localStorage.setItem('accentColor', accent); } catch(e) {}
  }, [accent]);

  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="bg-white/60 dark:bg-[#071026]/60 p-4 rounded-lg shadow-sm border border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-3">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-gray-700 dark:text-gray-200">
            <path d="M12 3v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M12 19v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M4.2 4.2l1.4 1.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M18.4 18.4l1.4 1.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <div>
            <div className="text-sm font-medium text-gray-700 dark:text-gray-200">Appearance</div>
            <div className="mt-1 text-xs text-gray-500 dark:text-gray-300">Choose theme preference</div>
          </div>
        </div>

        <div className="mt-3 flex gap-3">
          <label className={`px-3 py-2 rounded-md border ${appearance === 'system' ? 'border-gray-300 bg-white' : 'border-transparent bg-white/30 dark:bg-[#071026]'} text-sm cursor-pointer flex items-center gap-2`}>
            <input type="radio" name="appearance" checked={appearance==='system'} onChange={()=>applyAppearance('system')} className="mr-2"/>
            {/* Computer icon */}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M8 19h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            System
          </label>

          <label className={`px-3 py-2 rounded-md border ${appearance === 'light' ? 'border-gray-300 bg-white' : 'border-transparent bg-white/30 dark:bg-[#071026]'} text-sm cursor-pointer flex items-center gap-2`}>
            <input type="radio" name="appearance" checked={appearance==='light'} onChange={()=>applyAppearance('light')} className="mr-2"/>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 3v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            Light
          </label>

          <label className={`px-3 py-2 rounded-md border ${appearance === 'dark' ? 'border-gray-300 bg-white' : 'border-transparent bg-white/30 dark:bg-[#071026]'} text-sm cursor-pointer flex items-center gap-2`}>
            <input type="radio" name="appearance" checked={appearance==='dark'} onChange={()=>applyAppearance('dark')} className="mr-2"/>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Dark
          </label>
        </div>
      </div>

      <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-gray-700 dark:text-gray-200">Accent color</div>
            <div className="mt-2 text-xs text-gray-500 dark:text-gray-300">Pick an accent — affects primary actions like the Send button.</div>
          </div>
          <div className="text-xs text-gray-400">Preview</div>
        </div>

        <div className="mt-3 flex items-center gap-3">
          {ACCENTS.map(a => (
            <button
              key={a.id}
              onClick={() => setAccent(a.color)}
              aria-label={`Accent ${a.id}`}
              className={`w-9 h-9 rounded-full flex items-center justify-center ring-2 transition-shadow duration-150 ${accent===a.color ? 'ring-white/90 ring-offset-2 shadow' : 'ring-transparent'}`}
              style={{ backgroundColor: a.color }}
            >
              {accent===a.color && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              )}
            </button>
          ))}

          <div className="ml-4">
            <button
              className="px-3 py-2 rounded-md text-sm text-white font-semibold"
              style={{ backgroundColor: 'var(--accent-color)' }}
              onClick={() => { /* small demo only */ }}
            >
              Send (preview)
            </button>
          </div>
        </div>
      </div>

      <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
        <div className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Other</div>
        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-semibold mb-1 text-gray-600 dark:text-gray-300">Language</label>
            <select className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#071026] p-2 text-sm">
              <option value="en">English</option>
              <option value="id">Bahasa Indonesia</option>
              <option value="jp">日本語</option>
              <option value="es">Español</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1 text-gray-600 dark:text-gray-300">Voice</label>
            <select className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#071026] p-2 text-sm">
              <option value="default">Default</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="robot">Robot</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
