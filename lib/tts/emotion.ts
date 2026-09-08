import * as path from 'path';
import { classifyEmotionWasm } from './emotion-wasm';
import { modelsDir } from './paths';

export type Emotion = 'neutral' | 'angry' | 'excited' | 'sad' | 'happy' | 'emotional';
export type EmotionSelection = Emotion | 'auto';

export interface EmotionProfile {
  emotion: Emotion;
  confidence: number;
  gain: number;
  lengthScale: number;
  noiseScale: number;
  noiseW: number;
  warmth: number;
  pitchRate: number;
}

type ClassifierResult = { label: string; score: number }[];
type EmotionClassifier = (text: string, options?: Record<string, unknown>) => Promise<ClassifierResult>;

let classifierPromise: Promise<EmotionClassifier> | undefined;

const profiles: Record<Emotion, Omit<EmotionProfile, 'emotion' | 'confidence'>> = {
  neutral: { gain: 1, lengthScale: 1, noiseScale: 1, noiseW: 1, warmth: 0, pitchRate: 1 },
  angry: { gain: 1.25, lengthScale: 1.08, noiseScale: 1.12, noiseW: 1.05, warmth: 0.05, pitchRate: 1 },
  excited: { gain: 1.2, lengthScale: 0.9, noiseScale: 1.2, noiseW: 1.12, warmth: 0, pitchRate: 1.02 },
  sad: { gain: 0.8, lengthScale: 1.18, noiseScale: 0.82, noiseW: 0.85, warmth: 0.5, pitchRate: 0.94 },
  happy: { gain: 1.08, lengthScale: 0.94, noiseScale: 1.08, noiseW: 1.04, warmth: 0.08, pitchRate: 1.01 },
  emotional: { gain: 0.88, lengthScale: 1.12, noiseScale: 0.9, noiseW: 0.9, warmth: 0.4, pitchRate: 0.96 },
};

const emotionNames = new Set<Emotion>(Object.keys(profiles) as Emotion[]);

function profileFor(emotion: Emotion, confidence = 1): EmotionProfile {
  return { emotion, confidence, ...profiles[emotion] };
}

function mapModelLabel(label: string): Emotion {
  switch (label.toLowerCase()) {
    case 'anger':
    case 'disgust':
      return 'angry';
    case 'joy':
      return 'happy';
    case 'surprise':
      return 'excited';
    case 'sadness':
    case 'fear':
      return 'sad';
    default:
      return 'neutral';
  }
}

async function getClassifier(): Promise<EmotionClassifier> {
  if (process.env.ORT_BACKEND === 'wasm') {
    return async (text: string): Promise<ClassifierResult> => {
      const { label, score } = await classifyEmotionWasm(text);
      return [{ label, score }];
    };
  }

  classifierPromise ??= (async () => {
    const { env, pipeline } = await import('@huggingface/transformers');
    env.allowRemoteModels = false;
    env.localModelPath = modelsDir() + path.sep;
    return pipeline(
      'text-classification',
      'onnx-community/emotion-english-distilroberta-base-ONNX',
      { dtype: 'q8' }
    ) as Promise<EmotionClassifier>;
  })();
  return classifierPromise;
}

/** Detects emotion using a transformer model; a transient model-load failure remains safe for TTS. */
export async function detectEmotion(text: string): Promise<EmotionProfile> {
  try {
    const classifier = await getClassifier();
    const results = await classifier(text, { top_k: 1 });
    const result = results[0];
    return profileFor(mapModelLabel(result?.label ?? 'neutral'), result?.score ?? 0);
  } catch (error) {
    classifierPromise = undefined;
    console.warn('Emotion model unavailable; using neutral delivery.', error);
    return profileFor('neutral', 0);
  }
}

export async function resolveEmotion(
  selection: EmotionSelection | undefined,
  text: string
): Promise<EmotionProfile> {
  if (!selection || selection === 'auto') return detectEmotion(text);
  return profileFor(emotionNames.has(selection as Emotion) ? selection as Emotion : 'neutral');
}