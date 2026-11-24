import { describe, expect, it } from 'vitest';
import { ACTION_GROUPS, cardKey, placeBar } from './actionBar';

describe('action bar', () => {
  it('has one card for every combat action, keyed 1–9 then 0', () => {
    const all = ACTION_GROUPS.flatMap((g) => g.actions);
    expect(new Set(all).size).toBe(10);
    expect(all.map((_, i) => cardKey(i)).join('')).toBe('1234567890');
  });

  it('sits between the HUD panels when it fits there', () => {
    const slot = { left: 284, right: 996, bottom: 705, ceiling: 46, floor: 150 };
    const p = placeBar(751, 107, slot, 1280);
    expect(p).toMatchObject({ x: 640, y: 705, edge: 'bottom' });
    expect(p.scale).toBeCloseTo((712 - 20) / 751, 3);
    expect(placeBar(751, 107, { left: 426, right: 1494, bottom: 1058, ceiling: 46, floor: 600 }, 1920).scale).toBe(1.25);
  });

  it('moves over the fighters on a phone, small enough to clear their heads', () => {
    const p = placeBar(751, 107, { left: 300, right: 544, bottom: 382, ceiling: 46, floor: 136 }, 844);
    expect(p).toMatchObject({ x: 422, y: 46, edge: 'top' });
    expect(p.scale).toBeCloseTo(90 / 107, 3);
    expect(placeBar(751, 107, { left: 250, right: 420, bottom: 330, ceiling: 6, floor: 300 }, 667).scale).toBeCloseTo(647 / 751, 3);
  });

  it('grows with a larger text size only as far as the room allows', () => {
    const wide = { left: 426, right: 1494, bottom: 1058, ceiling: 46, floor: 600 };
    expect(placeBar(751, 107, wide, 1920, 1.3).scale).toBeCloseTo((1068 - 20) / 751, 3);
    const roomy = { left: 0, right: 3000, bottom: 1058, ceiling: 46, floor: 600 };
    expect(placeBar(751, 107, roomy, 3000, 1.3).scale).toBeCloseTo(1.25 * 1.3, 3);
  });
});
