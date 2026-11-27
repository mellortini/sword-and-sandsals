import { describe, expect, it } from 'vitest';
import { ARC, dayState, mixColor } from './dayCycle';

describe('dayState', () => {
  it('puts the sun high at noon with the lamps out', () => {
    const s = dayState(0.25);
    expect(s.body.moon).toBe(false);
    expect(s.body.y).toBeCloseTo(ARC.peak);
    expect(s.lights).toBe(0);
    expect(s.tint).toBe(0xffffff);
  });

  it('moves the sun from left to right across the day', () => {
    expect(dayState(0.1).body.x).toBeLessThan(dayState(0.4).body.x);
  });

  it('lights the lamps and shows the moon and stars at midnight', () => {
    const s = dayState(0.75);
    expect(s.body.moon).toBe(true);
    expect(s.lights).toBe(1);
    expect(s.stars).toBe(1);
  });

  it('keeps the lamps on through the night until after sunrise', () => {
    expect(dayState(0.99).lights).toBeGreaterThan(0.5);
    expect(dayState(0.12).lights).toBe(0);
  });

  it('changes colours smoothly (no jump across phase 1 -> 0)', () => {
    const a = dayState(0.9999).skyTop, b = dayState(0).skyTop;
    expect(Math.abs((a >> 16) - (b >> 16))).toBeLessThan(3);
  });
});

describe('shop shutters', () => {
  it('are open in the evening with the lamps lit and closed at midnight', () => {
    expect(dayState(0.52).lights).toBeGreaterThan(0.5);
    expect(dayState(0.52).shutters).toBe(0);
    expect(dayState(0.75).shutters).toBe(1);
    expect(dayState(0.25).shutters).toBe(0);
  });
});

describe('mixColor', () => {
  it('mixes per channel', () => {
    expect(mixColor(0x000000, 0xffffff, 0.5)).toBe(0x808080);
    expect(mixColor(0xff0000, 0x0000ff, 1)).toBe(0x0000ff);
  });
});
