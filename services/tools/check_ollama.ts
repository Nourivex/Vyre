import { execFile } from 'child_process';
import { promisify } from 'util';
// Use global fetch available in Node 18+ to avoid extra dependency
const execFileAsync = promisify(execFile);

async function tryCli(model = 'llama2') {
  const cmd = process.env.OLLAMA_CMD || 'ollama';
  const testText = 'Vyre test';
  const args = ['embed', model, '--text', testText, '--json'];
  try {
    const { stdout } = await execFileAsync(cmd, args, { maxBuffer: 10 * 1024 * 1024 });
    try {
      const parsed = JSON.parse(stdout);
      if (Array.isArray(parsed)) return { ok: true, vectorLen: parsed.length, source: 'cli' };
    } catch (e) {
      return { ok: true, raw: stdout, source: 'cli' };
    }
  } catch (err: any) {
    return { ok: false, err: String(err.message || err) };
  }
}

async function tryHttp(model = 'llama2') {
  const url = process.env.OLLAMA_HTTP || 'http://127.0.0.1:11434/embed';
  const body = { model, text: 'Vyre test' };
  try {
    const res = await (globalThis as any).fetch(url, { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } } as any);
    if (!res.ok) return { ok: false, status: res.status };
    const j = await res.json();
    if (Array.isArray(j)) return { ok: true, vectorLen: j.length, source: 'http' };
    if (j?.data) return { ok: true, source: 'http', data: j };
    return { ok: true, source: 'http', raw: j };
  } catch (err: any) {
    return { ok: false, err: String(err.message || err) };
  }
}

async function main() {
  console.log('Checking Ollama availability (CLI then HTTP)...');
  const cmd = process.env.OLLAMA_CMD || 'ollama';
  // print version and help to help troubleshooting
  try {
    const { stdout: ver } = await execFileAsync(cmd, ['--version']);
    console.log('ollama --version:\n', ver.trim());
  } catch (e) {
    // ignore
  }
  try {
    const { stdout: help } = await execFileAsync(cmd, ['--help']);
    console.log('ollama --help:\n', help.substring(0, 4000));
  } catch (e) {
    // ignore
  }

  const cli = await tryCli(process.env.OLLAMA_MODEL || 'llama2');
  console.log('CLI check:', cli);
  const http = await tryHttp(process.env.OLLAMA_MODEL || 'llama2');
  console.log('HTTP check:', http);
  if ((cli as any).ok || (http as any).ok) {
    console.log('Ollama appears available.');
    process.exit(0);
  }
  console.error('Ollama not available via CLI or HTTP.');
  process.exit(2);
}

if (require.main === module) main().catch(e=>{ console.error(e); process.exit(1)});
