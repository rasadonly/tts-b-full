import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { modelsDir } from './paths';

const MODEL_DIR = path.join(
  'onnx-community',
  'emotion-english-distilroberta-base-ONNX'
);

const PAT = /'s|'t|'re|'ve|'m|'ll|'d| ?\p{L}+| ?\p{N}+| ?[^\s\p{L}\p{N}]+|\s+(?!\S)|\s+/gu;

let encoder: Record<string, number> | undefined;
let ranks: Map<string, number> | undefined;
let byteToChar: Map<number, string> | undefined;

export function getVocab(): Record<string, number> {
  if (!encoder) {
    encoder = JSON.parse(
      readFileSync(path.join(modelsDir(), MODEL_DIR, 'vocab.json'), 'utf-8')
    ) as Record<string, number>;
  }
  return encoder;
}

export function hasTokenizerFiles(): boolean {
  const dir = path.join(modelsDir(), MODEL_DIR);
  try {
    return !!(encoder || readFileSync(path.join(dir, 'vocab.json'), 'utf-8'));
  } catch {
    return false;
  }
}

function getRanks(): Map<string, number> {
  if (!ranks) {
    const raw = readFileSync(path.join(modelsDir(), MODEL_DIR, 'merges.txt'), 'utf-8');
    const lines = raw.split('\n');
    if (lines[0]?.startsWith('#version')) lines.shift();
    const map = new Map<string, number>();
    lines.forEach((line, i) => {
      const slim = line.replace(/\s+/, ' ').trim();
      if (slim) map.set(slim, i);
    });
    ranks = map;
  }
  return ranks;
}

function getByteToChar(): Map<number, string> {
  if (!byteToChar) {
    const bytes = Array.from({ length: 256 }, (_, i) => i);
    const chars = bytes.slice();
    let n = 0;
    for (let b = 0; b < 256; b++) {
      const keep =
        (b >= 0x21 && b <= 0x7e) || (b >= 0xa1 && b <= 0xac) || b === 0xad;
      if (!keep) chars[b] = 256 + n++;
    }
    byteToChar = new Map();
    for (let i = 0; i < bytes.length; i++) byteToChar.set(bytes[i], String.fromCharCode(chars[i]));
  }
  return byteToChar;
}

function byteEncode(token: string): string[] {
  const mapping = getByteToChar();
  const bytes = new TextEncoder().encode(token);
  return Array.from(bytes, (b) => mapping.get(b) ?? String.fromCharCode(0xfffd));
}

function mergePair(word: string[], a: string, b: string): string[] {
  const merged: string[] = [];
  let i = 0;
  while (i < word.length) {
    if (word[i] === a && i + 1 < word.length && word[i + 1] === b) {
      merged.push(a + b);
      i += 2;
    } else {
      merged.push(word[i]);
      i++;
    }
  }
  return merged;
}

function bpe(pieces: string[]): string[] {
  let word = pieces.slice();
  const rankMap = getRanks();
  while (word.length > 1) {
    let best = '';
    let bestRank = Number.POSITIVE_INFINITY;
    for (let i = 0; i < word.length - 1; i++) {
      const pair = word[i] + ' ' + word[i + 1];
      const r = rankMap.get(pair);
      if (r !== undefined && r < bestRank) {
        best = pair;
        bestRank = r;
      }
    }
    if (best === '') break;
    const [a, b] = best.split(' ');
    word = mergePair(word, a, b);
  }
  return word;
}

/** Returns GPT2/RoBERTa style BPE byte-level token ids for the input text. */
export function tokenizeIntoIds(text: string): number[] {
  const vocab = getVocab();
  const ids: number[] = [];
  const unk = vocab['<unk>'] ?? 3;
  const tokens = text.match(PAT) ?? [];
  for (const token of tokens) {
    const pieces = bpe(byteEncode(token));
    for (const piece of pieces) {
      const id = vocab[piece];
      ids.push(id === undefined ? unk : id);
    }
  }
  return ids;
}