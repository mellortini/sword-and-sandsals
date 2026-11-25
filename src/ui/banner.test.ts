import { describe, expect, it } from 'vitest';
import { BANNER_HOLD, BANNER_IN, BANNER_TIME, bannerOffset } from './banner';

describe('title banner timing', () => {
  it('slides in over six frames, holds a second and leaves the way it came', () => {
    expect(BANNER_IN).toBeCloseTo(0.2, 5);
    expect(bannerOffset(0)).toBe(-1);
    expect(bannerOffset(BANNER_IN / 2)).toBeGreaterThan(-1);
    expect(bannerOffset(BANNER_IN + 0.5)).toBe(0);
    expect(bannerOffset(BANNER_IN + BANNER_HOLD + 0.1)).toBeGreaterThan(0);
    expect(bannerOffset(BANNER_TIME)).toBe(1);
  });

  it('overshoots a little on arrival and never jumps backwards when leaving', () => {
    const arrival = Array.from({ length: 21 }, (_, i) => bannerOffset((BANNER_IN * i) / 20));
    expect(Math.max(...arrival)).toBeGreaterThan(0);
    expect(Math.max(...arrival)).toBeLessThan(0.2);
    let last = 0;
    for (let i = 1; i <= 10; i++) {
      const o = bannerOffset(BANNER_IN + BANNER_HOLD + (BANNER_TIME - BANNER_IN - BANNER_HOLD) * i / 10);
      expect(o).toBeGreaterThanOrEqual(last);
      last = o;
    }
  });
});
