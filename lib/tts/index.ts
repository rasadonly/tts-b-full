import { synthesize, SynthesisOptions } from './inference';
import { encodeWav, shapeEmotionAudio } from './audio';
import {
  detectEmotion,
  resolveEmotion,
  type Emotion,
  type EmotionProfile,
  type EmotionSelection,
} from './emotion';

export interface TTSOptions extends SynthesisOptions {
  maxCharacters?: number;
  emotion?: EmotionSelection;
}

export interface TTSSegment {
  text: string;
  emotion: Emotion;
  confidence: number;
}

export interface TTSResult {
  wavBuffer: Buffer;
  sampleRate: number;
  durationMs: number;
  emotion: Emotion;
  emotionConfidence: number;
  segments: TTSSegment[];
}

const INTER_SEGMENT_SILENCE_S = 0.08;

function splitSentences(text: string): string[] {
  const matches = text.match(/[^.!?…]+[.!?…]+["'”’)\]]*|[^.!?…]+$/g) || [text];
  return matches.map((s) => s.trim()).filter((s) => s.length > 0);
}

function splitLongText(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text];
  const parts: string[] = [];
  let current = '';
  for (const word of text.split(/\s+/)) {
    if (current.length + word.length + 1 > maxChars && current.length > 0) {
      parts.push(current.trim());
      current = word;
    } else {
      current += (current ? ' ' : '') + word;
    }
  }
  if (current.trim().length > 0) {
    parts.push(current.trim());
  }
  return parts;
}

function chunksForSynthesis(text: string, maxChars: number): string[] {
  return splitSentences(text).flatMap((sentence) =>
    sentence.length > maxChars ? splitLongText(sentence, maxChars) : [sentence]
  );
}

function dominantEmotion(profiles: EmotionProfile[]): {
  emotion: Emotion;
  confidence: number;
} {
  const counts = new Map<Emotion, number>();
  const best = new Map<Emotion, number>();
  for (const profile of profiles) {
    counts.set(profile.emotion, (counts.get(profile.emotion) ?? 0) + 1);
    best.set(
      profile.emotion,
      Math.max(best.get(profile.emotion) ?? 0, profile.confidence)
    );
  }
  let emotion: Emotion = 'neutral';
  let count = -1;
  for (const [candidate, total] of Array.from(counts)) {
    if (total > count) {
      emotion = candidate;
      count = total;
    }
  }
  return { emotion, confidence: best.get(emotion) ?? 0 };
}

export async function generateSpeech(
  text: string,
  options: TTSOptions = {}
): Promise<TTSResult> {
  const maxChars = options.maxCharacters || 500;
  const chunks = chunksForSynthesis(text, maxChars);
  const forcedEmotion =
    options.emotion && options.emotion !== 'auto' ? options.emotion : null;

  let profiles: EmotionProfile[];
  if (forcedEmotion === null) {
    profiles = await Promise.all(chunks.map((chunk) => detectEmotion(chunk)));
  } else {
    const forced = await resolveEmotion(forcedEmotion, text);
    profiles = chunks.map(() => ({ ...forced }));
  }

  const segments: TTSSegment[] = chunks.map((chunk, i) => ({
    text: chunk,
    emotion: profiles[i].emotion,
    confidence: profiles[i].confidence,
  }));

  const allAudio: Float32Array[] = [];
  let sampleRate = 22050;

  for (let i = 0; i < chunks.length; i++) {
    const profile = profiles[i];
    const result = await synthesize(chunks[i], {
      ...options,
      noiseScale: (options.noiseScale ?? 0.667) * profile.noiseScale,
      lengthScale: (options.lengthScale ?? 1) * profile.lengthScale,
      noiseW: (options.noiseW ?? 0.8) * profile.noiseW,
    });
    sampleRate = result.sampleRate;
    const shaped = shapeEmotionAudio(
      result.audio,
      sampleRate,
      profile.gain,
      profile.warmth,
      profile.pitchRate
    );
    allAudio.push(shaped);
  }

  const gapSamples = Math.round(sampleRate * INTER_SEGMENT_SILENCE_S);
  const parts: Float32Array[] = [];
  for (let i = 0; i < allAudio.length; i++) {
    if (i > 0) parts.push(new Float32Array(gapSamples));
    parts.push(allAudio[i]);
  }

  const totalLength = parts.reduce((sum, a) => sum + a.length, 0);
  const combined = new Float32Array(totalLength);
  let offset = 0;
  for (const audio of parts) {
    combined.set(audio, offset);
    offset += audio.length;
  }

  const { emotion, confidence } = dominantEmotion(profiles);
  const wavBuffer = encodeWav(combined, sampleRate);
  const durationMs = (combined.length / sampleRate) * 1000;

  return {
    wavBuffer,
    sampleRate,
    durationMs,
    emotion,
    emotionConfidence: confidence,
    segments,
  };
}

export { synthesize, encodeWav };