import { execFile, spawn } from 'child_process';
import { promisify } from 'util';
const execFileAsync = promisify(execFile);

type CallResult = { ok: true; text: string } | { ok: false; err: string };

function parseOutput(out: string): string {
  const trimmed = String(out || '').trim();
  const lines = trimmed.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);
      if (typeof parsed === 'string') return parsed;
      if (parsed?.output && typeof parsed.output === 'string') return parsed.output;
      if (Array.isArray(parsed?.choices) && parsed.choices[0]?.text) return parsed.choices[0].text;
      if (parsed?.text) return parsed.text;
      if (Array.isArray(parsed?.results) && parsed.results[0]?.text) return parsed.results[0].text;
    } catch (e) {
      // not JSON
    }
  }
  const match = trimmed.match(/(?:Assistant|Response|Output)[:\s\n]+([\s\S]{1,4000})$/i);
  if (match) return match[1].trim();
  return trimmed;
}

/**
 * Try HTTP API, then CLI via positional prompt, then CLI via stdin.
 */
export async function callModel(prompt: string, model = process.env.OLLAMA_MODEL || 'gemma3:4b'): Promise<CallResult> {
  const httpUrl = process.env.OLLAMA_HTTP || 'http://127.0.0.1:11434/run';
  try {
    const body = JSON.stringify({ model, prompt });
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 3000);
    try {
      const res = await (globalThis as any).fetch(httpUrl, { method: 'POST', body, headers: { 'Content-Type': 'application/json' }, signal: ac.signal } as any);
      if (res && res.ok) {
        const j = await res.json();
        const t = typeof j === 'string' ? j : (j?.output || j?.text || (Array.isArray(j?.choices) && j.choices[0]?.text) || '');
        if (t) return { ok: true, text: t };
      }
    } finally {
      clearTimeout(timer);
    }
  } catch (e) {
    // ignore HTTP error and fallback to CLI
  }

  const cmd = process.env.OLLAMA_CMD || 'ollama';
  // First try execFile with the prompt as positional arg (fast path)
  try {
    const args = ['run', model, prompt];
    const { stdout } = await execFileAsync(cmd, args, { maxBuffer: 20 * 1024 * 1024, timeout: 60000 });
    return { ok: true, text: parseOutput(String(stdout)) };
  } catch (e: any) {
    // Try spawn and write prompt to stdin (some ollama versions read stdin)
    try {
      const child = spawn(cmd, ['run', model], { stdio: ['pipe', 'pipe', 'pipe'] });
      const killTimer = setTimeout(() => { try { child.kill('SIGKILL'); } catch (e) {} }, 60000);
      let out = '';
      let err = '';
      child.stdout.on('data', (d) => out += String(d));
      child.stderr.on('data', (d) => err += String(d));
      child.stdin.write(prompt);
      child.stdin.end();
      const code: number = await new Promise((resolve, reject) => {
        child.on('error', reject);
        child.on('close', (c) => resolve(typeof c === 'number' ? c : 0));
      });
      clearTimeout(killTimer);
      if (code === 0) return { ok: true, text: parseOutput(out) };
      return { ok: false, err: `spawn_exit_${code} stderr:${err.slice(0,2000)}` };
    } catch (ee: any) {
      return { ok: false, err: String(ee && (ee.message || ee) || ee) };
    }
  }
}

export default { callModel };
