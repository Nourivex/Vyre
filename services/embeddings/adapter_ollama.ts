import crypto from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';
const execFileAsync = promisify(execFile);

// Try HTTP endpoint (ollama serve) then CLI `ollama run` invocation. Fallback to pseudo-embedding.

async function tryHttpOllama(text: string, model = 'gemma3:4b') {
  const url = process.env.OLLAMA_HTTP || 'http://127.0.0.1:11434/api/embeddings';
  try {
    const res = await (globalThis as any).fetch(url, { method: 'POST', body: JSON.stringify({ model, prompt: text }), headers: { 'Content-Type': 'application/json' } } as any);
    if (!res.ok) return null;
    const j = await res.json();
    // common shapes: { embedding: [...] } or { data: [...] } or raw array
    if (Array.isArray(j)) return j.map((v: any) => Number(v));
    if (Array.isArray(j.embedding)) return j.embedding.map((v: any) => Number(v));
    if (Array.isArray(j.data)) return j.data.map((v: any) => Number(v));
    return null;
  } catch (e) {
    return null;
  }
}

async function tryRunCli(text: string, model = 'gemma3:4b') {
  const cmd = process.env.OLLAMA_CMD || 'ollama';
  // Use `run` subcommand which is available in your `ollama` version.
  // Try `--json` and `--prompt` flags; behavior varies by model wrapper.
  try {
    const args = ['run', model, '--prompt', text, '--json'];
    const { stdout } = await execFileAsync(cmd, args, { maxBuffer: 20 * 1024 * 1024 });
    const parsed = JSON.parse(stdout);
    if (Array.isArray(parsed)) return parsed.map((v: any) => Number(v));
    if (parsed?.embedding && Array.isArray(parsed.embedding)) return parsed.embedding.map((v: any) => Number(v));
  } catch (e) {
    // ignore
  }
  return null;
}

function pseudoEmbed(text: string, dim = 512): number[] {
  const hash = crypto.createHash('sha256').update(text).digest();
  const out: number[] = new Array(dim).fill(0);
  for (let i = 0; i < dim; i++) {
    const hi = hash[i % hash.length];
    out[i] = (hi / 255) * 2 - 1 + (i % 7) * 1e-3;
  }
  return out;
}

export async function embedText(text: string, dim = 512, model = process.env.OLLAMA_MODEL || 'gemma3:4b') {
  // Try HTTP first (ostensibly fastest if `ollama serve` is running)
  const httpVec = await tryHttpOllama(text, model).catch(() => null);
  if (httpVec && httpVec.length > 0) return httpVec.slice(0, dim).concat(new Array(Math.max(0, dim - httpVec.length)).fill(0));

  // Try CLI run
  const cliVec = await tryRunCli(text, model).catch(() => null);
  if (cliVec && cliVec.length > 0) return cliVec.slice(0, dim).concat(new Array(Math.max(0, dim - cliVec.length)).fill(0));

  // Fallback
  return pseudoEmbed(text, dim);
}

export default { embedText };
