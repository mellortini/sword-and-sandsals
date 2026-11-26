import { describe, expect, it } from 'vitest';
import { hudScaleFor } from './phone';

describe('hudScaleFor', () => {
  it('keeps the HUD as drawn on desktop and tablet screens', () => {
    expect(hudScaleFor(1)).toBe(1);
    expect(hudScaleFor(1280 / 1920)).toBe(1);
    expect(hudScaleFor(Math.min(1180 / 1920, 820 / 1080))).toBe(1);
  });

  it('enlarges it on a phone held sideways, at most by 30%', () => {
    const iphone = hudScaleFor(Math.min(844 / 1920, 390 / 1080));
    expect(iphone).toBe(1.3);
    expect(hudScaleFor(0.45)).toBeCloseTo(1.111, 3);
  });

  it('falls back to 1 for a missing scale', () => {
    expect(hudScaleFor(0)).toBe(1);
    expect(hudScaleFor(Number.NaN)).toBe(1);
  });
});
