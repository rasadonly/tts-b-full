import assert from 'node:assert/strict';
import test from 'node:test';
import { shapeEmotionAudio } from './audio';

test('slows and lowers the output when a deep-voice pitch rate is requested', () => {
  const audio = new Float32Array([0, 0.5, 1, 0.5]);
  const shaped = shapeEmotionAudio(audio, 22050, 1, 0, 0.5);

  assert.equal(shaped.length, 8);
  assert.equal(shaped[2], 0.5);
});
