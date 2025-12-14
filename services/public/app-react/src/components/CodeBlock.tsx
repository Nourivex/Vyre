import React, { useEffect, useRef, useState } from 'react';
import hljs from 'highlight.js';
import 'highlight.js/styles/github.css';

type Props = {
  code: string;
};

function detectLanguage(raw: string){
  // handle fenced blocks like ```python\n...\n```
  const fence = raw.match(/^```([a-zA-Z0-9+\-_.]+)\n([\s\S]*?)\n```$/m);
  if (fence) return { lang: fence[1], code: fence[2] };

  const trimmed = raw.trim();
  // try JSON
  try{
    JSON.parse(trimmed);
    return { lang: 'json', code: trimmed };
  }catch(e){}

  // heuristics
  if (/^\s*(def |class |import |from )/m.test(trimmed)) return { lang: 'python', code: trimmed };
  if (/^\s*<\w+/.test(trimmed)) return { lang: 'html', code: trimmed };

  // stronger YAML detection:
  // - explicit document start '---'
  // - multiple lines that look like key: value
  // - multiple list items starting with '- '
  const lines = trimmed.split(/\r?\n/);
  const keyValueLines = lines.filter(l => /^\s*[\w"'\-]+\s*:\s+/.test(l));
  const dashLines = lines.filter(l => /^\s*-\s+/.test(l));
  if (trimmed.startsWith('---') || keyValueLines.length >= 2 || dashLines.length >= 2) {
    return { lang: 'yaml', code: trimmed };
  }

  if (/\bfunction\b|=>|console\.log\(|var |let |const /m.test(trimmed)) return { lang: 'javascript', code: trimmed };

  return { lang: 'text', code: trimmed };
}

export default function CodeBlock({ code }: Props){
  const [copied, setCopied] = useState(false);
  const { lang: detectedLang, code: content } = detectLanguage(code);
  const codeRef = useRef<HTMLElement | null>(null);
  const [lang, setLang] = useState(detectedLang);

  useEffect(()=>{
    if (!codeRef.current) return;
    try{
      // If our heuristic detected a language and highlight.js supports it,
      // prefer explicit highlight with that language to avoid wrong auto-detection (e.g. 'ada').
      if (detectedLang && detectedLang !== 'text' && hljs.getLanguage(detectedLang)) {
        const res = hljs.highlight(content, { language: detectedLang });
        codeRef.current.innerHTML = res.value;
        setLang(detectedLang);
      } else {
        const res = hljs.highlightAuto(content);
        codeRef.current.innerHTML = res.value;
        if (res.language) setLang(res.language);
      }
    } catch(e){
      codeRef.current.textContent = content;
    }
  }, [content, detectedLang]);

  async function handleCopy(e: React.MouseEvent){
    e.stopPropagation();
    try{
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(()=> setCopied(false), 1600);
    } catch {
      // ignore
    }
  }

  return (
    <div className="w-full max-w-[70%] px-0">
      <div className="relative rounded-2xl overflow-hidden shadow-sm bg-white text-gray-900 border border-gray-200">
        <div className="flex items-center justify-between px-3 py-1 bg-gray-50 border-b border-gray-100 text-xs">
          <div className="text-muted text-[11px] font-medium">{lang.toUpperCase()}</div>
          <div className="flex items-center gap-2">
            <button onClick={handleCopy} className="text-xs px-2 py-0.5 rounded-md bg-gray-100 hover:bg-gray-200">
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>

        <div className="p-4 pt-3 overflow-auto text-sm font-mono" style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, monospace' }}>
          <pre className="m-0 whitespace-pre-wrap"><code ref={el => codeRef.current = el as HTMLElement}>{content}</code></pre>
        </div>
      </div>
    </div>
  );
}
