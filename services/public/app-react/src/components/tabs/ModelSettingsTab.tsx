import React, { useState } from 'react';

export default function ModelSettingsTab() {
  const PROVIDERS = [
    { id: 'ollama', label: 'Ollama', enabled: true, note: 'Local Ollama (active)' },
    { id: 'openai', label: 'OpenAI', enabled: false, note: 'Disabled (not configured)' },
    { id: 'other', label: 'Other', enabled: false, note: 'Disabled' },
  ];

  const [provider, setProvider] = useState<string>('ollama');
  const [agentModel, setAgentModel] = useState<string>('agent-v1');
  const [modelName, setModelName] = useState<string>('ollama-agent-v1');
  const [temperature, setTemperature] = useState<number>(0.2);

  const AGENT_OPTIONS = [
    { id: 'agent-v1', label: 'agent-v1' },
    { id: 'agent-mini', label: 'agent-mini' },
  ];

  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="bg-white/60 dark:bg-[#071026]/60 p-4 rounded-lg shadow-sm border border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-3">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-gray-700 dark:text-gray-200">
            <path d="M3 7h18" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M6 11h12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M9 15h6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div>
            <div className="text-sm font-medium text-gray-700 dark:text-gray-200">Model Providers</div>
            <div className="mt-1 text-xs text-gray-500 dark:text-gray-300">Pilih provider model. Saat ini hanya Ollama yang aktif.</div>
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-2">
          {PROVIDERS.map(p => (
            <label key={p.id} className={`flex items-center justify-between p-3 rounded-md border ${provider === p.id ? 'border-gray-300 bg-white' : 'border-transparent bg-white/30 dark:bg-[#071026]'} text-sm`}> 
              <div className="flex items-center gap-3">
                <input
                  type="radio"
                  name="provider"
                  value={p.id}
                  checked={provider === p.id}
                  onChange={() => setProvider(p.id)}
                  disabled={!p.enabled}
                  className="mr-2"
                />
                <div>
                  <div className="font-medium text-gray-700 dark:text-gray-200">{p.label} {p.enabled ? '' : ' (disabled)'}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-300">{p.note}</div>
                </div>
              </div>
              {!p.enabled && <div className="text-xs text-red-400">Disabled</div>}
            </label>
          ))}
        </div>
      </div>

      {/* Ollama specific settings */}
      {provider === 'ollama' && (
        <div className="bg-white/60 dark:bg-[#071026]/60 p-4 rounded-lg shadow-sm border border-gray-100 dark:border-gray-800">
          <div className="text-sm font-medium text-gray-700 dark:text-gray-200">Ollama — Agent & Model</div>
          <div className="mt-2 text-xs text-gray-500 dark:text-gray-300">Pilih Agent model yang akan aktif dan atur parameter model.</div>

          <div className="mt-4 grid grid-cols-1 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1 text-gray-600 dark:text-gray-300">Agent Model</label>
              <select value={agentModel} onChange={e => setAgentModel(e.target.value)} className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#071026] p-2 text-sm">
                {AGENT_OPTIONS.map(o => (
                  <option key={o.id} value={o.id}>{o.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1 text-gray-600 dark:text-gray-300">Model Name</label>
              <input value={modelName} onChange={e => setModelName(e.target.value)} className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#071026] p-2 text-sm" />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1 text-gray-600 dark:text-gray-300">Temperature</label>
              <input type="range" min={0} max={1} step={0.05} value={temperature} onChange={e => setTemperature(Number(e.target.value))} className="w-full" />
              <div className="text-xs text-gray-500 dark:text-gray-300 mt-1">{temperature}</div>
            </div>

            <div className="flex justify-end">
              <button className="px-3 py-2 rounded-md text-sm text-white font-semibold" style={{ backgroundColor: 'var(--accent-color, #2563eb)' }} onClick={() => { /* small-demo: persist locally */ try { localStorage.setItem('vyre:model:provider', provider); localStorage.setItem('vyre:model:agent', agentModel); localStorage.setItem('vyre:model:name', modelName); localStorage.setItem('vyre:model:temp', String(temperature)); } catch(e) {} }}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {provider !== 'ollama' && (
        <div className="text-sm text-gray-500 dark:text-gray-400">Preview only — pilih Ollama untuk mengatur Agent dan model.</div>
      )}
    </div>
  );
}
