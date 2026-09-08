import { execFile } from 'child_process';
import { promisify } from 'util';
import { phonemize } from 'phonemizer';
import { phonemesToIds, type PhonemeIdMap } from './phoneme-ids';
import { splitProsodyParts } from './punctuation';

const execFileAsync = promisify(execFile);

const ESPEAK_BIN = process.env.ESPEAK_PATH || 'espeak-ng';
const ESPEAK_VOICE = process.env.ESPEAK_VOICE || 'en-us';

const VOWEL_MAP: Record<string, string> = {
  a: 'a',
  e: 'ɛ',
  i: 'ɪ',
  o: 'ɔ',
  u: 'ʊ',
  y: 'ɪ',
};

const DIGRAPH_PHONEMES: Record<string, string> = {
  dge: 'dʒ',
  tch: 'tʃ',
  th: 'θ',
  sh: 'ʃ',
  ch: 'tʃ',
  ng: 'ŋ',
  ck: 'k',
  kn: 'n',
  wr: 'ɹ',
  gn: 'n',
  ph: 'f',
  wh: 'w',
  ai: 'aɪ',
  ei: 'eɪ',
  oi: 'ɔɪ',
  ou: 'aʊ',
  ow: 'oʊ',
  oo: 'uː',
  ea: 'iː',
  ee: 'iː',
  ie: 'aɪ',
  ue: 'uː',
  ew: 'uː',
  aw: 'ɔː',
  ay: 'eɪ',
  ey: 'eɪ',
  oa: 'oʊ',
};

const CONSONANT_PHONEMES: Record<string, string> = {
  b: 'b',
  d: 'd',
  f: 'f',
  g: 'ɡ',
  h: 'h',
  j: 'dʒ',
  k: 'k',
  l: 'l',
  m: 'm',
  n: 'n',
  p: 'p',
  r: 'ɹ',
  s: 's',
  t: 't',
  v: 'v',
  w: 'w',
  z: 'z',
  ð: 'ð',
};

function isVowelChar(ch: string): boolean {
  return 'aeiouy'.includes(ch);
}

async function phonemizeWasm(text: string): Promise<string | null> {
  try {
    const result = await phonemize(text, ESPEAK_VOICE);
    if (!result || result.length === 0) return null;
    return result.join(' ');
  } catch {
    return null;
  }
}

async function phonemizeEspeak(text: string): Promise<string | null> {
  try {
    const cleaned = text.replace(/\s+/g, ' ').trim();

    if (!cleaned) return null;

    const { stdout } = await execFileAsync(
      ESPEAK_BIN,
      ['-q', '--ipa', '-v', ESPEAK_VOICE, cleaned],
      { encoding: 'utf8', maxBuffer: 1024 * 1024 }
    );

    return stdout.replace(/[\n\r]+/g, ' ').trim();
  } catch {
    return null;
  }
}

function processWordFallback(word: string): string[] {
  if (!word) return [];

  const lower = word.toLowerCase();
  const phonemes: string[] = [];

  let i = 0;
  while (i < lower.length) {
    const remaining = lower.slice(i);
    let matched = false;

    const sortedGraphemes = Object.entries(DIGRAPH_PHONEMES).sort(
      (a, b) => b[0].length - a[0].length
    );

    for (const [grapheme, phoneme] of sortedGraphemes) {
      if (remaining.startsWith(grapheme)) {
        phonemes.push(phoneme);
        i += grapheme.length;
        matched = true;
        break;
      }
    }

    if (matched) continue;

    const ch = lower[i];

    if (ch === 'c') {
      const nextChar = i + 1 < lower.length ? lower[i + 1] : '';
      phonemes.push('eiy'.includes(nextChar) ? 's' : 'k');
      i++;
      continue;
    }

    if (ch === 'x') {
      phonemes.push('k', 's');
      i++;
      continue;
    }

    if (ch === 'q') {
      phonemes.push('k');
      i++;
      continue;
    }

    if (ch === 'y' && (i === 0 || (i > 0 && !isVowelChar(lower[i - 1])))) {
      phonemes.push('j');
      i++;
      continue;
    }

    if (CONSONANT_PHONEMES[ch]) {
      phonemes.push(CONSONANT_PHONEMES[ch]);
      i++;
      continue;
    }

    if (isVowelChar(ch)) {
      phonemes.push(VOWEL_MAP[ch] || ch);
      i++;
      continue;
    }

    i++;
  }

  return phonemes;
}

async function textToIdsEspeak(
  text: string,
  phonemeIdMap: PhonemeIdMap
): Promise<number[] | null> {
  const phonemes: string[] = [];

  for (const part of splitProsodyParts(text)) {
    if (part.type === 'punctuation') {
      phonemes.push(...Array.from(part.value).filter((symbol) => symbol in phonemeIdMap));
      continue;
    }

    let ipa = await phonemizeWasm(part.value);
    if (ipa === null) ipa = await phonemizeEspeak(part.value);
    if (ipa) {
      phonemes.push(...Array.from(ipa).filter((phoneme) => phoneme in phonemeIdMap));
    }
  }

  return phonemes.length > 0 ? phonemesToIds(phonemes, phonemeIdMap) : null;
}

export async function textToIds(
  text: string,
  phonemeIdMap: PhonemeIdMap
): Promise<number[]> {
  const espeakIds = await textToIdsEspeak(text, phonemeIdMap);
  if (espeakIds && espeakIds.length > 2) {
    return espeakIds;
  }

  const phonemes = splitProsodyParts(text).flatMap((part) => {
    if (part.type === 'punctuation') return Array.from(part.value);

    return part.value
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 0)
      .flatMap(processWordFallback);
  });

  return phonemesToIds(phonemes, phonemeIdMap);
}
