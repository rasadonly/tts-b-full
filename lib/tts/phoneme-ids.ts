export type PhonemeIdMap = Record<string, number[]>;

/**
 * Encode the phoneme stream exactly as Piper expects it.
 *
 * Piper's models are trained with a padding token after *every* phoneme, not
 * just between words. Omitting those tokens changes the sequence alignment and
 * produces garbled or unnatural speech.
 */
export function phonemesToIds(
  phonemes: string[],
  phonemeIdMap: PhonemeIdMap
): number[] {
  const ids = [...(phonemeIdMap['^'] ?? [1])];
  const padding = phonemeIdMap['_'] ?? [0];

  for (const phoneme of phonemes) {
    const mapped = phonemeIdMap[phoneme];
    if (!mapped) continue;

    ids.push(...mapped, ...padding);
  }

  ids.push(...(phonemeIdMap['$'] ?? [2]));
  return ids;
}
