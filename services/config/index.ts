import path from 'path';
import fs from 'fs';

const CONFIG_PATH = path.join(__dirname, '..', 'config.json');

export function readConfig() {
  try {
    if (!fs.existsSync(CONFIG_PATH)) return {};
    const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
    return JSON.parse(raw || '{}');
  } catch (e) {
    return {};
  }
}

export function writeConfig(obj: any) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(obj, null, 2), 'utf8');
}

export function getDefaultModel() {
  const c = readConfig();
  return c.default_model || process.env.OLLAMA_MODEL || 'gemma3:4b';
}

export function setDefaultModel(name: string) {
  const c = readConfig();
  c.default_model = name;
  writeConfig(c);
}

export default { readConfig, writeConfig, getDefaultModel, setDefaultModel };
