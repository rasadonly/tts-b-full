import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizePunctuation, splitProsodyParts } from './punctuation';

test('preserves sentence and phrase punctuation for Piper prosody', () => {
  assert.deepEqual(
    splitProsodyParts('Wait—really?! Yes; absolutely...'),
    [
      { type: 'text', value: 'Wait' },
      { type: 'punctuation', value: '-' },
      { type: 'text', value: 'really' },
      { type: 'punctuation', value: '?!' },
      { type: 'text', value: ' Yes' },
      { type: 'punctuation', value: ';' },
      { type: 'text', value: ' absolutely' },
      { type: 'punctuation', value: '...' },
    ]
  );
});

test('normalizes typographic punctuation to Piper-supported symbols', () => {
  assert.deepEqual(normalizePunctuation('…—–'), ['.', '.', '.', '-', '-']);
});
