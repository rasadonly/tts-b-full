/**
 * Piper's eSpeak models are trained with these punctuation symbols in their
 * phoneme map. Keeping them in the input lets the model learn phrase breaks,
 * sentence-final intonation, and emphasis from punctuation instead of treating
 * every sentence as an unbroken word sequence.
 */
const PIPER_PUNCTUATION = new Set(['.', '!', '?', ',', ';', ':', '-']);
const PUNCTUATION_RUN = /^[.!?;,:\-…—–]+$/;
const PROSODY_PARTS = /[^.!?;,:\-…—–]+|[.!?;,:\-…—–]+/g;

export type ProsodyPart =
  | { type: 'text'; value: string }
  | { type: 'punctuation'; value: string };

export function normalizePunctuation(value: string): string[] {
  const normalized = value
    .replace(/…/g, '...')
    .replace(/[—–]/g, '-');

  return Array.from(normalized).filter((symbol) => PIPER_PUNCTUATION.has(symbol));
}

export function splitProsodyParts(text: string): ProsodyPart[] {
  return (text.match(PROSODY_PARTS) ?? []).map<ProsodyPart>((value) => {
    if (PUNCTUATION_RUN.test(value)) {
      return { type: 'punctuation', value: normalizePunctuation(value).join('') };
    }

    return { type: 'text', value };
  }).filter((part) => part.value.length > 0);
}
