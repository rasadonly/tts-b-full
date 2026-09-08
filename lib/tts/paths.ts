import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

let cachedDir: string | undefined;

export function modelsDir(): string {
  if (cachedDir) return cachedDir;

  const candidates = [
    process.env.MODELS_DIR,
    path.join(process.cwd(), 'models'),
    '/opt/models',
    path.join(os.homedir(), 'tts-models'),
    '/tmp/tts-models',
  ].filter((d): d is string => !!d);

  for (const dir of candidates) {
    try {
      if (fs.existsSync(dir)) {
        fs.accessSync(dir, fs.constants.R_OK);
        cachedDir = dir;
        return dir;
      }
    } catch {
      // not readable; try to create/write
    }
    try {
      fs.mkdirSync(dir, { recursive: true });
      fs.accessSync(dir, fs.constants.W_OK);
      cachedDir = dir;
      return dir;
    } catch {
      // try next candidate
    }
  }

  cachedDir = candidates[candidates.length - 1];
  return cachedDir;
}