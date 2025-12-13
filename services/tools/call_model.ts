import { execFile } from 'child_process';
import { promisify } from 'util';
const execFileAsync = promisify(execFile);

type CallResult = { ok: true; text: string } | { ok: false; err: string };
    const out = String(stdout).trim();
    // Try to parse JSON from stdout (may be raw text or JSON-lines)
    try {
      // handle multiple JSON objects per-line
      const lines = out.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          if (typeof parsed === 'string') return { ok: true, text: parsed };
          if (parsed?.output && typeof parsed.output === 'string') return { ok: true, text: parsed.output };
          if (Array.isArray(parsed?.choices) && parsed.choices[0]?.text) return { ok: true, text: parsed.choices[0].text };
          if (parsed?.text) return { ok: true, text: parsed.text };
          // sometimes shape is { results: [{ text: '...' }] }
          if (Array.isArray(parsed?.results) && parsed.results[0]?.text) return { ok: true, text: parsed.results[0].text };
        } catch (e) {
          // not JSON, continue
        }
      }
    } catch (e) {
      // fall through
    }

    // fallback: if output contains a recognizable generated block, try to extract
    // common prefix labels
    const match = out.match(/(?:Assistant|Response|Output)[:\s\n]+([\s\S]{1,4000})$/i);
    if (match) return { ok: true, text: match[1].trim() };
    // otherwise return full stdout
    return { ok: true, text: out };
    const res = await (globalThis as any).fetch(httpUrl, { method: 'POST', body, headers: { 'Content-Type': 'application/json' } } as any);
    if (res.ok) {
      const j = await res.json();
      // common shapes: { output: 'text' } or { text: '...' } or { choices: [...] }
      if (typeof j === 'string') return { ok: true, text: j };
      if (j?.output && typeof j.output === 'string') return { ok: true, text: j.output };
      if (Array.isArray(j?.choices) && j.choices[0]?.text) return { ok: true, text: j.choices[0].text };
      if (j?.text) return { ok: true, text: j.text };
    }
  } catch (e: any) {
    // ignore and try CLI
  }

  // Fallback to CLI `ollama run` which exists in user's environment
  const cmd = process.env.OLLAMA_CMD || 'ollama';
  try {
      // Some ollama versions accept prompt as a positional argument; avoid unknown flags.
      const args = ['run', model, prompt];
    const { stdout } = await execFileAsync(cmd, args, { maxBuffer: 20 * 1024 * 1024 });
    try {
      const parsed = JSON.parse(String(stdout));
      if (typeof parsed === 'string') return { ok: true, text: parsed };
      if (parsed?.output && typeof parsed.output === 'string') return { ok: true, text: parsed.output };
      if (Array.isArray(parsed?.choices) && parsed.choices[0]?.text) return { ok: true, text: parsed.choices[0].text };
      if (parsed?.text) return { ok: true, text: parsed.text };
      return { ok: true, text: String(stdout) };
    } catch (e) {
      return { ok: true, text: String(stdout) };
    }
  } catch (err: any) {
    return { ok: false, err: String(err.message || err) };
  }
}

export default { callModel };
