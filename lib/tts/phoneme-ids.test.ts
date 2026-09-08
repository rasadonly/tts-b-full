import assert from 'node:assert/strict';
import test from 'node:test';
import { phonemesToIds } from './phoneme-ids';
import { textToIds } from './phoneme';

const map = { '^': [1], '_': [0], '$': [2], h: [3], ə: [4], l: [5], o: [6] };

test('adds Piper padding after every recognized phoneme', () => {
  assert.deepEqual(phonemesToIds(['h', 'ə', 'l', 'o'], map), [
    1, 3, 0, 4, 0, 5, 0, 6, 0, 2,
  ]);
});

test('does not turn unsupported phonemes into padding-only inputs', () => {
  assert.deepEqual(phonemesToIds(['h', '🚀', 'o'], map), [1, 3, 0, 6, 0, 2]);
});

test('retains supported punctuation as Piper phoneme IDs', async () => {
  const punctuationMap = { '^': [1], '_': [0], '$': [2], h: [3], i: [4], '!': [5], ',': [6], '?': [7] };
  const ids = await textToIds('Hi! Hi, hi?', punctuationMap);

  assert.ok(ids.includes(5));
  assert.ok(ids.includes(6));
  assert.ok(ids.includes(7));
});
