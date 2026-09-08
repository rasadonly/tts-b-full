import * as fs from 'fs';
import * as path from 'path';
import { modelsDir } from './paths';

export interface ModelConfig {
  audio: {
    sample_rate: number;
    quality: string;
  };
  espeak: {
    voice: string;
  };
  inference: {
    noise_scale: number;
    length_scale: number;
    noise_w: number;
  };
  phoneme_type: string;
  phoneme_id_map: Record<string, number[]>;
  num_speakers: number;
}

let cachedConfig: ModelConfig | null = null;

export function loadModelConfig(overrideDir?: string): ModelConfig {
  if (cachedConfig) return cachedConfig;

  const dir = overrideDir || modelsDir();
  const files = fs.readdirSync(dir);
  const jsonFile = files.find(f => f.endsWith('.onnx.json'));

  if (!jsonFile) {
    throw new Error(`No .onnx.json config found in ${dir}`);
  }

  const raw = fs.readFileSync(path.join(dir, jsonFile), 'utf-8');
  cachedConfig = JSON.parse(raw) as ModelConfig;
  return cachedConfig;
}

export function getModelPath(overrideDir?: string): string {
  const dir = overrideDir || modelsDir();
  const files = fs.readdirSync(dir);
  const onnxFile = files.find(f => f.endsWith('.onnx') && !f.endsWith('.json'));

  if (!onnxFile) {
    throw new Error(`No .onnx model file found in ${dir}`);
  }

  return path.join(dir, onnxFile);
}

export function resetConfigCache(): void {
  cachedConfig = null;
}
