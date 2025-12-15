import React, { useEffect, useRef, useState } from 'react';
import hljs from 'highlight.js';
// Ganti dengan theme yang lebih netral dan modern, misalnya 'atom-one-dark.css' atau 'monokai.css'
import 'highlight.js/styles/atom-one-dark.css'; 
import { Copy, Check } from 'lucide-react';

type Props = {
  code: string;
  embedded?: boolean;
};

/**
 * Mendeteksi bahasa dan mengekstrak KODE BERSIH dari string input.
 * Penting: Jika input adalah fenced block (```lang\ncode\n```), hanya 'code' yang diekstrak.
 */
function detectLanguage(raw: string){
  // 1. Handle fenced blocks: ```python\n...\n```
  // Menggunakan flag 's' (dotall) agar '.' juga match newline, tapi karena kita mau match ``` awal/akhir, kita pakai 'm' (multiline)
  const fence = raw.match(/^```([a-zA-Z0-9+\-_.]+)\n([\s\S]*?)\n```$/m);
  if (fence) {
    // KODE BERSIH ada di fence[2]
    return { lang: fence[1], code: fence[2] };
  }

  const trimmed = raw.trim();
  
  // 2. Heuristik deteksi bahasa (sama seperti sebelumnya, tapi kita pastikan 'code' adalah 'trimmed')
  try{
    JSON.parse(trimmed);
    return { lang: 'json', code: trimmed };
  }catch(e){}

  if (/^\s*(def |class |import |from )/m.test(trimmed)) return { lang: 'python', code: trimmed };
  if (/^\s*<\w+/.test(trimmed)) return { lang: 'html', code: trimmed };

  const lines = trimmed.split(/\r?\n/);
  const keyValueLines = lines.filter(l => /^\s*[\w"'\-]+\s*:\s+/.test(l));
  const dashLines = lines.filter(l => /^\s*-\s+/.test(l));
  if (trimmed.startsWith('---') || keyValueLines.length >= 2 || dashLines.length >= 2) {
    return { lang: 'yaml', code: trimmed };
  }

  if (/\bfunction\b|=>|console\.log\(|var |let |const /m.test(trimmed)) return { lang: 'javascript', code: trimmed };

  // Default: text, dan kode adalah konten yang sudah di-trim
  return { lang: 'text', code: trimmed };
}

// Helper untuk menyalin teks yang lebih robust
async function copyText(text: string) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text);
  }

  return new Promise<void>((resolve, reject) => {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      if (ok) resolve(); else reject(new Error('Copy failed'));
    } catch (e) { reject(e); }
  });
}

export default function CodeBlock({ code, embedded }: Props){
  const [copied, setCopied] = useState(false);
  // detectedLang dan content sudah BERSIH dari fence Markdown
  const { lang: detectedLang, code: content } = detectLanguage(code);
  const codeRef = useRef<HTMLElement | null>(null);
  const [lang, setLang] = useState(detectedLang);

  // Highlighting Logic
  useEffect(()=>{
    if (!codeRef.current) return;
    try{
      let res;
      if (detectedLang && detectedLang !== 'text' && hljs.getLanguage(detectedLang)) {
        res = hljs.highlight(content, { language: detectedLang });
        setLang(detectedLang);
      } else {
        res = hljs.highlightAuto(content);
        if (res.language) setLang(res.language);
      }
      // Kita pakai innerHTML dari hasil highlight.js
      codeRef.current.innerHTML = res.value; 
    } catch(e){
      // Fallback: Jika gagal highlight, tampilkan konten mentah
      codeRef.current.textContent = content;
    }
  }, [content, detectedLang]);

  // Copy Handler (menggunakan 'content' yang sudah bersih)
  async function handleCopy(e: React.MouseEvent){
    e.stopPropagation();
    try{
      await copyText(content); // <<< HANYA KONTEN BERSIH YANG DISALIN
      setCopied(true);
      setTimeout(()=> setCopied(false), 1600);
    } catch {
      // ignore
    }
  }

  // Common styles
  const buttonStyle = "flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-colors duration-200";
  const headerStyle = "flex items-center justify-between px-3 py-2 border-b border-gray-700/50 bg-gray-800/80 backdrop-blur-sm";

  // --- RENDERING BLOCK UTAMA (Default / Not Embedded) ---
  if (!embedded) {
    return (
      // Container utama, dibuat sedikit lebih besar dan shadow yang lebih deep
      <div className="w-full sm:max-w-[650px] shadow-2xl rounded-xl">
        <div className="relative rounded-xl overflow-hidden bg-[#282C34] text-white"> 
          
          {/* Header Bar */}
          <div className={headerStyle}>
            <div className="text-[11px] font-semibold uppercase text-sky-400">{lang}</div>
            <button 
              onClick={handleCopy} 
              className={`${buttonStyle} text-gray-300 hover:bg-white/10`}
              title="Copy code to clipboard"
            >
              {copied 
                ? <><Check className="w-3 h-3 text-green-400" /> Copied!</> 
                : <><Copy className="w-3 h-3" /> Copy</>
              }
            </button>
          </div>

          {/* Code Content */}
          <div className="p-4 overflow-auto text-sm max-h-[400px]">
            {/* Menggunakan class 'hljs' untuk memastikan highlight.js theme bekerja */}
            <pre className="m-0 hljs"><code ref={el => codeRef.current = el as HTMLElement} className={`language-${lang}`}>{content}</code></pre>
          </div>

        </div>
      </div>
    );
  }

  // --- RENDERING BLOCK EMBEDDED (Sits inside a chat bubble) ---
  return (
    <div className="w-full mt-3">
      <div className="rounded-lg overflow-hidden bg-[#282C34]/90 border border-gray-700/50"> 
        
        {/* Header Bar Embedded */}
        <div className={headerStyle}>
          <div className="text-[10px] font-medium uppercase text-sky-400">{lang}</div>
          <button 
            onClick={handleCopy} 
            className={`${buttonStyle} text-gray-300 hover:bg-white/10`}
            title="Copy code to clipboard"
          >
            {copied 
              ? <Check className="w-3 h-3 text-green-400" /> 
              : <Copy className="w-3 h-3" />
            }
          </button>
        </div>

        {/* Code Content Embedded (lebih compact) */}
        <div className="p-3 text-sm overflow-auto max-h-[200px]">
          <pre className="m-0 hljs"><code ref={el => codeRef.current = el as HTMLElement} className={`language-${lang}`}>{content}</code></pre>
        </div>
        
      </div>
    </div>
  );
}