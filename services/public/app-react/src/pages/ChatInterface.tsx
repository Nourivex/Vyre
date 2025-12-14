import React, { useEffect, useRef, useState } from 'react';
import CodeBlock from '../components/CodeBlock';
import { Plus, Mic as Microphone, ArrowUp } from 'lucide-react';

type Props = { isDark: boolean };

type Message = { id: string; role: 'user' | 'assistant'; content: string; isCode?: boolean; lang?: string };

function genId() { return String(Date.now()) + Math.random().toString(36).slice(2,6); }

export default function ChatInterface({ isDark }: Props) {
  const [text, setText] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
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
    setSuggestions([]);

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

  // simple suggestion mock: filter a small list
  useEffect(()=>{
    if (!text.trim()) { setSuggestions([]); return; }
    const pool = [
      'Contoh fungsi add',
      'Cara menggunakan API',
      'Contoh query SQL',
      'Bagaimana cara deploy aplikasi React?'
    ];
    const matches = pool.filter(p => p.toLowerCase().includes(text.toLowerCase())).slice(0,3);
    setSuggestions(matches);
  }, [text]);

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

        <div className="mt-4">
          <div className="relative">
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full shadow-sm px-3 py-2 flex items-center gap-3">
              <button className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
                <Plus className="w-5 h-5 text-gray-500" />
              </button>

              <input
                type="text"
                placeholder="Ask anything"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
                className="flex-1 bg-transparent text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none px-2"
              />

              <div className="flex items-center">
                <button onClick={() => { if (!text.trim()) { /* mic action */ } else handleSend(); }} className="ml-2 bg-blue-500 hover:bg-blue-600 text-white p-3 rounded-full shadow-md">
                  {text.trim() ? <ArrowUp className="w-4 h-4" /> : <Microphone className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* suggestions dropdown */}
            {suggestions.length > 0 && (
              <div className="absolute left-3 right-3 mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-40 overflow-hidden">
                {suggestions.map((s, i) => (
                  <button key={i} onClick={() => { setText(s); setSuggestions([]); }} className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700">
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
