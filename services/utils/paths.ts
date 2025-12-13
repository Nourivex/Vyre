import path from 'path';
import os from 'os';

function findProjectRoot(): string {
  // Assume services/ is at projectRoot/services
  return path.resolve(__dirname, '..', '..');
}

export function getDbPath(): string {
  if (process.env.VYRE_DB_PATH) return process.env.VYRE_DB_PATH;

  if (process.env.NODE_ENV === 'production') {
    const appdata = process.env.APPDATA || (process.env.HOME ? path.join(process.env.HOME, 'AppData', 'Roaming') : os.tmpdir());
    return path.join(appdata, 'Vyre', 'vyre.db');
  }

  // Development: use repository root/database/vyre.db (deterministic)
  const projectRoot = findProjectRoot();
  return path.join(projectRoot, 'database', 'vyre.db');
}
