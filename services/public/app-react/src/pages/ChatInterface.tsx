import React, { useEffect, useRef, useState } from 'react';
import CodeBlock from '../components/CodeBlock';

type Props = { isDark: boolean };

type Message = { id: string; role: 'user' | 'assistant'; content: string; isCode?: boolean; lang?: string };

function genId() { return String(Date.now()) + Math.random().toString(36).slice(2,6); }

export default function ChatInterface({ isDark }: Props) {
  const [text, setText] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // initial mock messages
  useEffect(() => {
    const mock: Message[] = [
      { id: genId(), role: 'assistant', content: 'Halo! Saya bantuan Vyre Dev Assistant. Mau lihat contoh jawaban yang menyertakan kode?', },
      { id: genId(), role: 'user', content: 'Ya, berikan contoh fungsi JavaScript sederhana untuk menambahkan dua angka.' },
      { id: genId(), role: 'assistant', content: "Berikut contoh fungsi sederhana:\n\nfunction add(a, b) {\n  return a + b;\n}", isCode: true, lang: 'javascript' },
      { id: genId(), role: 'assistant', content: 'Selain itu saya juga bisa menjelaskan langkah-langkahnya.' }
    ];
    setMessages(mock);
  }, []);

  // auto-scroll to bottom on messages change
  useEffect(() => {
    const el = scrollRef.current;
    if (el) { el.scrollTop = el.scrollHeight; }
  }, [messages]);

  async function handleSend() {
    if (!text.trim()) return;
    const userMsg: Message = { id: genId(), role: 'user', content: text.trim() };
    setMessages(m => [...m, userMsg]);
    setText('');
    setSending(true);

    // simulate assistant typing
    const typingId = genId();
    setMessages(m => [...m, { id: typingId, role: 'assistant', content: '...', }]);

    // fake network delay and response
    setTimeout(() => {
      setMessages(prev => prev.map(pm => pm.id === typingId ? { ...pm, content: 'Membalas...' } : pm));
    }, 600);

    setTimeout(() => {
      // replace typing with a structured assistant reply (text + code)
      setMessages(prev => prev.flatMap(pm => pm.id === typingId ? [
        { id: genId(), role: 'assistant', content: `Berikut fungsi add yang diminta:` },
        { id: genId(), role: 'assistant', content: `function add(a, b) {\n  return a + b;\n}`, isCode: true, lang: 'javascript' }
      ] : [pm]));
      setSending(false);
    }, 1400);
  }

  function renderMessage(m: Message){
    const isUser = m.role === 'user';
    const base = 'max-w-[70%] px-5 py-3 whitespace-pre-wrap';

    // modern assistant bubble
    if (m.isCode) {
      return (
        <div key={m.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
          <CodeBlock code={m.content} />
        </div>
      );
    }

    return (
      <div key={m.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-1`}> 
        <div className={`rounded-2xl shadow-sm ${isUser ? 'bg-gradient-to-br from-purple-600 to-purple-500 text-white rounded-br-none' : (isDark ? 'bg-gray-800 text-white' : 'bg-white text-gray-900 border border-gray-200') } ${base}`}>
          {m.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex-1 p-6 flex flex-col relative">
        <div className="absolute left-6 right-6 -top-2 flex items-center justify-between z-10">
          <h2 className={`text-2xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Chat Area</h2>
          <span className={isDark ? 'text-gray-300' : 'text-gray-500'}>Agent: Vyre Dev Assistant</span>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 py-4 pt-12">
          {messages.length === 0 && (
            <p className={`chat-placeholder italic ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>
              Mulai percakapan dengan mengetik pesan di bawah.
            </p>
          )}

          {messages.map(m => renderMessage(m))}
        </div>

        <div className="mt-4 flex space-x-3">
          <input
            type="text"
            placeholder="Type your message here..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
            className={`${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'} flex-1 p-3 border rounded-lg focus:outline-none`}
          />
          <button
            onClick={handleSend}
            disabled={sending}
            className={`text-white font-bold py-3 px-6 rounded-lg transition duration-150 ${sending ? 'opacity-60 pointer-events-none' : ''}`}
            style={{ backgroundColor: 'var(--accent-color, #7c3aed)' }}
          >
            {sending ? '...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}
