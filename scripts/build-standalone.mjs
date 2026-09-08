import { build } from 'esbuild';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const outDir = path.join(root, 'dist');
const scriptsDir = path.join(outDir, 'scripts');

if (fs.existsSync(outDir)) {
  for (const entry of fs.readdirSync(outDir)) {
    if (entry === '.git') continue;
    fs.rmSync(path.join(outDir, entry), { recursive: true, force: true });
  }
}
fs.mkdirSync(scriptsDir, { recursive: true });

await build({
  entryPoints: [path.join(root, 'server.mts')],
  outfile: path.join(outDir, 'server.mjs'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node18',
  external: [
    'onnxruntime-node',
    'onnxruntime-web',
    '@huggingface/transformers',
    'phonemizer',
  ],
  sourcemap: true,
});

for (const f of ['ensure-model.mjs', 'ensure-emotion-model.mjs', 'download-model.mjs', 'download-emotion-model.mjs', 'bake-models.mjs']) {
  fs.copyFileSync(path.join(root, 'scripts', f), path.join(scriptsDir, f));
}

const packageJson = {
  name: 'tts-b-bonto',
  version: '1.0.0',
  private: true,
  type: 'module',
  engine: { node: '20.x' },
  engines: { node: '20.x' },
  scripts: {
    start: 'node scripts/ensure-model.mjs && node scripts/ensure-emotion-model.mjs && node server.mjs',
  },
  dependencies: {
    '@huggingface/transformers': '^4.2.0',
    'onnxruntime-node': '1.29.0',
    'phonemizer': '^1.2.1',
  },
  overrides: {
    'onnxruntime-node': '1.29.0',
  },
};

fs.writeFileSync(path.join(outDir, 'package.json'), JSON.stringify(packageJson, null, 2));
fs.writeFileSync(
  path.join(outDir, '.gitignore'),
  'node_modules/\nmodels/\n.env\n'
);

fs.copyFileSync(path.join(root, 'nixpacks.toml'), path.join(outDir, 'nixpacks.toml'));

console.log('Bonto deploy bundle written to', outDir);