/** Advance the 32-bit seed and return a uniform value in [0, 1). */
export function nextRandom(state: number): { state: number; value: number } {
  const next = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
  return { state: next, value: next / 0x1_0000_0000 };
}
