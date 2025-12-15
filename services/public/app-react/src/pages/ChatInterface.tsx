import React, { useEffect, useRef, useState } from 'react';
import CodeBlock from '../components/CodeBlock';
import { Plus, Mic as Microphone, ArrowUp, Copy, Volume2, Check, Edit3 } from 'lucide-react';

type Props = { isDark: boolean };

type Message = { id: string; role: 'user' | 'assistant'; content: string; isCode?: boolean; lang?: string };

function genId() { return String(Date.now()) + Math.random().toString(36).slice(2, 6); }

export default function ChatInterface({ isDark }: Props) {
  const [text, setText] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [sending, setSending] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // initial mock messages
  useEffect(() => {
    const mock: Message[] = [
      { id: genId(), role: 'assistant', content: 'Halo! Saya bantuan Vyre Dev Assistant. Mau lihat contoh jawaban yang menyertakan kode?', },
      { id: genId(), role: 'user', content: 'Ya, berikan contoh fungsi JavaScript sederhana untuk menambahkan dua angka.' },
      {
        id: genId(),
        role: 'assistant',
        content: "Berikut contoh fungsi sederhana:\n\n```javascript\nfunction add(a, b) {\n  return a + b;\n}\n```\n\nSelain itu saya juga bisa menjelaskan langkah-langkahnya.",
        isCode: false, // Set false karena content sudah campuran teks dan kode di dalam code block (```)
        lang: ''
      }
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
    // if editing an existing user message, update it and do not trigger assistant reply
    if (editingId) {
      setMessages(prev => prev.map(pm => pm.id === editingId ? { ...pm, content: text.trim() } : pm));
      setEditingId(null);
      setText('');
      setSuggestions([]);
      return;
    }

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
  useEffect(() => {
    if (!text.trim()) { setSuggestions([]); return; }
    const pool = [
      'Contoh fungsi add',
      'Cara menggunakan API',
      'Contoh query SQL',
      'Bagaimana cara deploy aplikasi React?'
    ];
    const matches = pool.filter(p => p.toLowerCase().includes(text.toLowerCase())).slice(0, 3);
    setSuggestions(matches);
  }, [text]);

  function renderMessage(m: Message) {
    const isUser = m.role === 'user';
    // consistent bubble width: full on mobile, capped on larger screens
    const base = 'w-full sm:max-w-[520px] px-5 py-3 whitespace-pre-wrap';

    // modern assistant bubble
    if (m.isCode) {
      return (
        <div key={m.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
          <CodeBlock code={m.content} />
        </div>
      );
    }

    // parse content for fenced code blocks (```lang\n...```) so we can render text + multiple embedded CodeBlock segments
    function parseFenced(content: string) {
      const parts: Array<{ type: 'text' | 'code'; lang?: string; content: string }> = [];
      const regex = /```([a-zA-Z0-9+\-_.]*)\n([\s\S]*?)```/g;
      let lastIndex = 0;
      let mres: RegExpExecArray | null;
      while ((mres = regex.exec(content)) !== null) {
        const idx = mres.index;
        if (idx > lastIndex) {
          parts.push({ type: 'text', content: content.slice(lastIndex, idx) });
        }
        parts.push({ type: 'code', lang: mres[1] || undefined, content: mres[2] });
        lastIndex = regex.lastIndex;
      }
      if (lastIndex < content.length) parts.push({ type: 'text', content: content.slice(lastIndex) });
      return parts;
    }

    const segments = parseFenced(m.content);

    return (
      <div key={m.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-1`}>
        <div className={`relative group`}>
          <div className={`rounded-2xl shadow-sm ${isUser ? 'bg-gradient-to-br from-purple-600 to-purple-500 text-white rounded-br-none' : (isDark ? 'bg-gray-800 text-white' : 'bg-white text-gray-900 border border-gray-200')} ${base}`}>
            {segments.map((seg, idx) => (
              seg.type === 'text' ? (
                <div key={idx} className="whitespace-pre-wrap">
                  {seg.content}
                </div>
              ) : (
                <CodeBlock key={idx} code={seg.content} embedded />
              )
            ))}
          </div>

          {/* action icons below bubble, centered; appear on hover */}
          <div className="mt-1 flex justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-150">
            <div className="flex items-center gap-2">
              {m.role === 'user' ? (
                <>
                  <button
                    onClick={() => {
                      setText(m.content);
                      setEditingId(m.id);
                      setSuggestions([]);
                    }}
                    title="Edit"
                    className="p-1 rounded-full bg-white text-gray-600 hover:shadow">
                    <Edit3 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={async () => { try { await navigator.clipboard.writeText(m.content); setCopiedId(m.id); setTimeout(() => setCopiedId(null), 1400); } catch (e) { } }}
                    title="Copy"
                    className="p-1 rounded-full bg-white text-gray-600 hover:shadow">
                    {copiedId === m.id ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={async () => { try { await navigator.clipboard.writeText(m.content); setCopiedId(m.id); setTimeout(() => setCopiedId(null), 1400); } catch (e) { } }}
                    title="Copy"
                    className="p-1 rounded-full bg-white text-gray-600 hover:shadow">
                    {copiedId === m.id ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  </button>

                  <button
                    onClick={() => { /* speech disabled */ }}
                    title="Speech (disabled)"
                    className="p-1 rounded-full bg-white text-gray-400 opacity-60 cursor-not-allowed">
                    <Volume2 className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderMessages() {
    const out: JSX.Element[] = [];
    const base = 'w-full sm:max-w-[520px] px-5 py-3 whitespace-pre-wrap';
    for (let i = 0; i < messages.length; i++) {
      const m = messages[i];
      const isUser = m.role === 'user';

      // group assistant text + immediate assistant code into one bubble
      if (!m.isCode && m.role === 'assistant' && messages[i + 1] && messages[i + 1].isCode && messages[i + 1].role === 'assistant') {
        const codeMsg = messages[i + 1];
        out.push(
          <div key={m.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-1`}>
            <div className={`relative group`}>
              <div className={`rounded-2xl shadow-sm ${isUser ? 'bg-gradient-to-br from-purple-600 to-purple-500 text-white rounded-br-none' : (isDark ? 'bg-gray-800 text-white' : 'bg-white text-gray-900 border border-gray-200')} ${base}`}>
                <div>{m.content}</div>
                <CodeBlock code={codeMsg.content} embedded />
              </div>

              {/* icons below combined bubble */}
              <div className="mt-1 flex justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                <div className="flex items-center gap-2">
                  <button
                    onClick={async () => { try { await navigator.clipboard.writeText(m.content + '\n\n' + codeMsg.content); setCopiedId(m.id); setTimeout(() => setCopiedId(null), 1400); } catch (e) { } }}
                    title="Copy"
                    className="p-1 rounded-full bg-white text-gray-600 hover:shadow">
                    {copiedId === m.id ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  </button>

                  <button
                    onClick={() => { /* speech disabled */ }}
                    title="Speech (disabled)"
                    className="p-1 rounded-full bg-white text-gray-400 opacity-60 cursor-not-allowed">
                    <Volume2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
        i++; // skip the code message we consumed
        continue;
      }

      // otherwise fallback to single-message render
      out.push(renderMessage(m));
    }

    return out;
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

          {renderMessages()}
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
