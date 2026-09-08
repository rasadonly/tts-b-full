import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const modelsDir = process.env.MODELS_DIR || path.join(__dirname, '..', 'models');

const MODEL_BASE_URL = 'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_GB/cori/medium';

const MODEL_FILES = [
  'en_GB-cori-medium.onnx',
  'en_GB-cori-medium.onnx.json',
];

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const follow = (targetUrl, redirects) => {
      https
        .get(targetUrl, { headers: { 'User-Agent': 'tts-generator/1.0' } }, (response) => {
          if ([301, 302, 303, 307, 308].includes(response.statusCode) && response.headers.location) {
            if (redirects > 5) {
              reject(new Error('Too many redirects'));
              return;
            }
            response.resume();
            follow(new URL(response.headers.location, url).toString(), redirects + 1);
            return;
          }

          if (response.statusCode !== 200) {
            reject(new Error('Failed to download ' + url + ': HTTP ' + response.statusCode));
            return;
          }

          const totalSize = parseInt(response.headers['content-length'] || '0', 10);
          let downloaded = 0;
          const file = fs.createWriteStream(dest);

          response.on('data', (chunk) => {
            downloaded += chunk.length;
            if (totalSize > 0) {
              const percent = ((downloaded / totalSize) * 100).toFixed(1);
              process.stdout.write('\r  Downloading ' + path.basename(dest) + ': ' + percent + '%');
            }
          });

          response.pipe(file);

          file.on('finish', () => {
            file.close();
            console.log('');
            resolve();
          });

          file.on('error', (err) => {
            if (fs.existsSync(dest)) fs.unlinkSync(dest);
            reject(err);
          });
        })
        .on('error', (err) => {
          if (fs.existsSync(dest)) fs.unlinkSync(dest);
          reject(err);
        });
    };

    follow(url, 0);
  });
}

async function main() {
  if (!fs.existsSync(modelsDir)) {
    fs.mkdirSync(modelsDir, { recursive: true });
  }

  console.log('Downloading VITS Piper TTS model (en_GB-cori-medium)...\n');

  for (const filename of MODEL_FILES) {
    const dest = path.join(modelsDir, filename);

    if (fs.existsSync(dest)) {
      console.log('  ' + filename + ' already exists, skipping.');
      continue;
    }

    const url = MODEL_BASE_URL + '/' + filename;
    console.log('  Downloading ' + filename + '...');
    await downloadFile(url, dest);
  }

  console.log('\nModel downloaded successfully!');
  console.log('Files saved to: ' + modelsDir);
}

main().catch((err) => {
  console.error('Failed to download model:', err);
  process.exit(1);
});