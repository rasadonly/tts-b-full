import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveEmotion } from './emotion';

test('uses the requested delivery profile without loading the classifier', async () => {
  const profile = await resolveEmotion('excited', 'What fantastic news!');

  assert.equal(profile.emotion, 'excited');
  assert.ok(profile.gain > 1);
  assert.ok(profile.lengthScale < 1);
});

test('safely normalizes unsupported delivery values to neutral', async () => {
  const profile = await resolveEmotion('unsupported' as never, 'Hello');
  assert.equal(profile.emotion, 'neutral');
});
