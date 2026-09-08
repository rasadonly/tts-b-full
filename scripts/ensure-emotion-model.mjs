import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const modelRoot = path.join(
  process.env.MODELS_DIR || path.join(__dirname, '..', 'models'),
  'onnx-community',
  'emotion-english-distilroberta-base-ONNX'
);
const downloadScript = path.join(__dirname, 'download-emotion-model.mjs');

function modelReady() {
  const onnxPath = path.join(modelRoot, 'onnx', 'model_quantized.onnx');
  if (!fs.existsSync(onnxPath)) return false;

  const size = fs.statSync(onnxPath).size;
  return size > 1024 * 1024;
}

if (modelReady()) {
  console.log('Emotion classifier model files present in models/, skipping download.');
} else {
  console.log('Emotion classifier model files missing. Downloading...');
  execSync(`node "${downloadScript}"`, { stdio: 'inherit' });
}