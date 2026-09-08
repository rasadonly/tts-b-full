import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { hasTokenizerFiles, tokenizeIntoIds } from './roberta-tokenizer';
import { modelsDir } from './paths';

type Session = {
  run: (feeds: Record<string, unknown>) => Promise<Record<string, { data: Float32Array }>>;
};

let sessionPromise: Promise<Session> | undefined;
let ortPromise: Promise<typeof import('onnxruntime-web')> | undefined;

function getOrt(): Promise<typeof import('onnxruntime-web')> {
  ortPromise ??= import('onnxruntime-web').then((mod) => {
    mod.env.wasm.numThreads = 1;
    return mod;
  });
  return ortPromise;
}

async function getSession(): Promise<Session> {
  if (!sessionPromise) {
    const ort = await getOrt();
    const modelPath = path.join(
      modelsDir(),
      'onnx-community',
      'emotion-english-distilroberta-base-ONNX',
      'onnx',
      'model_quantized.onnx'
    );
    const bytes = readFileSync(modelPath);
    sessionPromise = ort.InferenceSession.create(bytes, {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all',
    }) as Promise<Session>;
  }
  return sessionPromise;
}

const LABELS = [
  'anger',
  'disgust',
  'fear',
  'joy',
  'neutral',
  'sadness',
  'surprise',
];

function softmax(logits: Float32Array): number[] {
  let max = -Infinity;
  for (let i = 0; i < logits.length; i++) if (logits[i] > max) max = logits[i];
  let sum = 0;
  const exp = new Array(logits.length);
  for (let i = 0; i < logits.length; i++) {
    exp[i] = Math.exp(logits[i] - max);
    sum += exp[i];
  }
  for (let i = 0; i < exp.length; i++) exp[i] /= sum;
  return exp;
}

export async function classifyEmotionWasm(text: string): Promise<{ label: string; score: number }> {
  if (!hasTokenizerFiles()) {
    throw new Error('Emotion tokenizer files missing');
  }
  const session = await getSession();
  const ids = tokenizeIntoIds(text);
  const inputIds = BigInt64Array.from([BigInt(0), ...ids.map(BigInt), BigInt(2)]);
  const mask = BigInt64Array.from({ length: inputIds.length }, () => BigInt(1));
  const ort = await getOrt();

  const result = await session.run({
    input_ids: new ort.Tensor('int64', inputIds, [1, inputIds.length]),
    attention_mask: new ort.Tensor('int64', mask, [1, mask.length]),
  });

  const logits = result.logits.data;
  const probs = softmax(logits);
  let best = 0;
  for (let i = 1; i < probs.length; i++) if (probs[i] > probs[best]) best = i;
  return { label: LABELS[best], score: probs[best] };
}