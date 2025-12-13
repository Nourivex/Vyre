import path from 'path';
import os from 'os';

export function getDbPath(): string {
  // If explicitly provided, use it
  if (process.env.VYRE_DB_PATH) return process.env.VYRE_DB_PATH;

  // Production builds should use %APPDATA%/Vyre/vyre.db on Windows
  if (process.env.NODE_ENV === 'production') {
    const appdata = process.env.APPDATA || (process.env.HOME ? path.join(process.env.HOME, 'AppData', 'Roaming') : os.tmpdir());
    return path.join(appdata, 'Vyre', 'vyre.db');
  }

  // Default for development: repository-local database/vyre.db
  return path.join(process.cwd(), 'database', 'vyre.db');
}
