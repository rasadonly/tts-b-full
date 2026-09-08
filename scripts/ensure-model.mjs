import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const modelsDir = process.env.MODELS_DIR || path.join(__dirname, '..', 'models');
const downloadScript = path.join(__dirname, 'download-model.mjs');

function modelReady() {
  if (!fs.existsSync(modelsDir)) return false;
  const files = fs.readdirSync(modelsDir);
  const hasModel = files.some((f) => f.endsWith('.onnx') && !f.endsWith('.json'));
  const hasConfig = files.some((f) => f.endsWith('.onnx.json'));
  if (!hasModel || !hasConfig) return false;

  const modelSize = fs.statSync(path.join(modelsDir, files.find((f) => f.endsWith('.onnx')))).size;
  return modelSize > 1024 * 1024;
}

if (modelReady()) {
  console.log('TTS model files present in models/, skipping download.');
} else {
  console.log('TTS model files missing. Downloading...');
  execSync(`node "${downloadScript}"`, { stdio: 'inherit' });
}