import { execSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
process.env.MODELS_DIR = '/opt/models';

console.log('Baking TTS models into image at /opt/models...');
execSync(`node "${path.join(scriptsDir, 'download-model.mjs')}"`, { stdio: 'inherit' });
execSync(`node "${path.join(scriptsDir, 'download-emotion-model.mjs')}"`, { stdio: 'inherit' });
console.log('Models baked into /opt/models.');