import * as fs from 'fs';
import { loadModelConfig, getModelPath } from './config';
import { textToIds } from './phoneme';

type TensorData = ArrayBufferView;
type OrtSessionLike = {
  run: (
    feeds: Record<string, unknown>
  ) => Promise<Record<string, { data: Float32Array }>>;
};
type OrtLike = {
  InferenceSession: {
    create: (source: string | Uint8Array, options: object) => Promise<OrtSessionLike>;
  };
  Tensor: new (type: string, data: TensorData, dims: number[]) => unknown;
};

let nodeOrt: OrtLike | undefined;
let webOrt: OrtLike | undefined;
let modelSession: OrtSessionLike | null = null;

async function getOrt(): Promise<{ ort: OrtLike; createSource: () => string | Uint8Array }> {
  if (process.env.ORT_BACKEND === 'wasm') {
    if (!webOrt) {
      const mod = await import('onnxruntime-web');
      if ('env' in mod && mod.env?.wasm) mod.env.wasm.numThreads = 1;
      webOrt = mod as unknown as OrtLike;
    }
    const modelPath = getModelPath();
    return { ort: webOrt, createSource: () => fs.readFileSync(modelPath) };
  }
  if (!nodeOrt) {
    nodeOrt = (await import('onnxruntime-node')) as unknown as OrtLike;
  }
  return { ort: nodeOrt, createSource: getModelPath };
}

async function getSession(): Promise<OrtSessionLike> {
  if (modelSession) return modelSession;
  const { ort, createSource } = await getOrt();
  modelSession = await ort.InferenceSession.create(createSource(), {
    executionProviders: process.env.ORT_BACKEND === 'wasm' ? ['wasm'] : ['cpu'],
    graphOptimizationLevel: 'all',
  });
  return modelSession;
}

export interface SynthesisOptions {
  noiseScale?: number;
  lengthScale?: number;
  noiseW?: number;
  speakerId?: number;
}

export interface SynthesisResult {
  audio: Float32Array;
  sampleRate: number;
}

export async function synthesize(
  text: string,
  options: SynthesisOptions = {}
): Promise<SynthesisResult> {
  const config = loadModelConfig();
  const sess = await getSession();
  const { ort } = await getOrt();

  const noiseScale = options.noiseScale ?? config.inference.noise_scale;
  const lengthScale = options.lengthScale ?? config.inference.length_scale;
  const noiseW = options.noiseW ?? config.inference.noise_w;

  const phonemeIds = await textToIds(text, config.phoneme_id_map);

  if (phonemeIds.length === 0) {
    throw new Error('No valid phonemes generated from input text');
  }

  const inputTensor = new ort.Tensor(
    'int64',
    BigInt64Array.from(phonemeIds.map(BigInt)),
    [1, phonemeIds.length]
  );

  const inputLengthsTensor = new ort.Tensor(
    'int64',
    BigInt64Array.from([BigInt(phonemeIds.length)]),
    [1]
  );

  const scalesTensor = new ort.Tensor(
    'float32',
    new Float32Array([noiseScale, lengthScale, noiseW]),
    [3]
  );

  const feeds: Record<string, unknown> = {
    input: inputTensor,
    input_lengths: inputLengthsTensor,
    scales: scalesTensor,
  };

  if (config.num_speakers > 1 && options.speakerId !== undefined) {
    const sidTensor = new ort.Tensor(
      'int64',
      BigInt64Array.from([BigInt(options.speakerId)]),
      [1]
    );
    feeds.sid = sidTensor;
  }

  const output = await sess.run(feeds);

  const outputKey = Object.keys(output)[0];
  const audioTensor = output[outputKey];
  const audioData = audioTensor.data as Float32Array;

  return {
    audio: audioData,
    sampleRate: config.audio.sample_rate,
  };
}