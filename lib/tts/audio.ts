export function encodeWav(
  samples: Float32Array,
  sampleRate: number,
  numChannels: number = 1,
  bitsPerSample: number = 16
): Buffer {
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = samples.length * bytesPerSample;
  const headerSize = 44;
  const totalSize = headerSize + dataSize;

  const buffer = Buffer.alloc(totalSize);
  let offset = 0;

  buffer.write('RIFF', offset, 'ascii');
  offset += 4;

  buffer.writeUInt32LE(totalSize - 8, offset);
  offset += 4;

  buffer.write('WAVE', offset, 'ascii');
  offset += 4;

  buffer.write('fmt ', offset, 'ascii');
  offset += 4;

  buffer.writeUInt32LE(16, offset);
  offset += 4;

  buffer.writeUInt16LE(1, offset);
  offset += 2;

  buffer.writeUInt16LE(numChannels, offset);
  offset += 2;

  buffer.writeUInt32LE(sampleRate, offset);
  offset += 4;

  buffer.writeUInt32LE(sampleRate * blockAlign, offset);
  offset += 4;

  buffer.writeUInt16LE(blockAlign, offset);
  offset += 2;

  buffer.writeUInt16LE(bitsPerSample, offset);
  offset += 2;

  buffer.write('data', offset, 'ascii');
  offset += 4;

  buffer.writeUInt32LE(dataSize, offset);
  offset += 4;

  let maxAbs = 0.01;
  for (let i = 0; i < samples.length; i++) {
    const abs = Math.abs(samples[i]);
    if (abs > maxAbs) maxAbs = abs;
  }
  const scale = 1 / maxAbs;

  for (let i = 0; i < samples.length; i++) {
    const sample = Math.max(-1, Math.min(1, samples[i] * scale));
    const intSample =
      sample < 0 ? sample * 0x8000 : sample * 0x7fff;

    if (bitsPerSample === 16) {
      buffer.writeInt16LE(Math.round(intSample), offset);
      offset += 2;
    } else {
      buffer.writeFloatLE(sample, offset);
      offset += 4;
    }
  }

  return buffer;
}

export function shapeEmotionAudio(
  samples: Float32Array,
  sampleRate: number,
  gain: number,
  warmth: number,
  pitchRate: number
): Float32Array {
  const resampledLength = Math.ceil(samples.length / pitchRate);
  const shaped = new Float32Array(resampledLength);
  const cutoff = 700 + (1 - warmth) * 10000;
  const alpha = Math.min(1, (2 * Math.PI * cutoff) / sampleRate);
  let low = 0;

  for (let i = 0; i < resampledLength; i++) {
    const sourceIndex = Math.min(i * pitchRate, samples.length - 1);
    const left = Math.floor(sourceIndex);
    const right = Math.min(left + 1, samples.length - 1);
    const sample =
      samples[left] +
      (samples[right] - samples[left]) * (sourceIndex - left);
    low += alpha * (sample - low);
    const warmed = sample * (1 - warmth * 0.35) + low * warmth * 0.35;
    shaped[i] = Math.max(-1, Math.min(1, warmed * gain));
  }

  return shaped;
}

export function float32ToInt16(float32: Float32Array): Int16Array {
  const int16 = new Int16Array(float32.length);
  let maxAbs = 0.01;
  for (let i = 0; i < float32.length; i++) {
    const abs = Math.abs(float32[i]);
    if (abs > maxAbs) maxAbs = abs;
  }
  const scale = 1 / maxAbs;
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i] * scale));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return int16;
}
