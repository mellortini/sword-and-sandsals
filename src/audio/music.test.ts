import { describe, expect, it } from 'vitest';
import { BEATS_PER_BAR, THEMES, barNotes, degreeToMidi } from './music';
import type { Theme } from './music';

const inScale = (theme: Theme, midi: number) => THEMES[theme].scale.includes((((midi - THEMES[theme].root) % 12) + 12) % 12);

describe('the paper themes (#73)', () => {
  it('maps scale degrees across octaves', () => {
    expect(degreeToMidi('arena', 0)).toBe(50);
    expect(degreeToMidi('arena', 7)).toBe(62);
    expect(degreeToMidi('arena', -1)).toBe(48);
    expect(degreeToMidi('town', 5)).toBe(67);
  });

  it('writes every note of every bar in the theme, inside the bar', () => {
    for (const theme of ['arena', 'town'] as const) {
      for (let bar = 0; bar < 32; bar++) {
        const notes = barNotes(theme, bar, 5);
        expect(notes.filter((n) => n.voice === 'drone')).toHaveLength(2);
        for (const n of notes) {
          expect(n.beat).toBeGreaterThanOrEqual(0);
          expect(n.beat).toBeLessThan(BEATS_PER_BAR);
          expect(n.dur).toBeGreaterThan(0);
          expect(n.vel).toBeGreaterThan(0);
          expect(n.vel).toBeLessThanOrEqual(1);
          if (n.voice === 'lyre') {
            expect(inScale(theme, n.midi), `${theme} bar ${bar} midi ${n.midi}`).toBe(true);
            expect(n.midi).toBeGreaterThanOrEqual(THEMES[theme].root);
            expect(n.midi).toBeLessThanOrEqual(THEMES[theme].root + 26);
          }
        }
      }
    }
  });

  it('drums only in the arena', () => {
    expect(barNotes('arena', 0).some((n) => n.voice === 'drum')).toBe(true);
    for (let bar = 0; bar < 8; bar++) expect(barNotes('town', bar).some((n) => n.voice === 'drum')).toBe(false);
  });

  it('is the same music for the same seed, and different for another', () => {
    expect(barNotes('town', 3, 9)).toEqual(barNotes('town', 3, 9));
    const tune = (seed: number) => Array.from({ length: 8 }, (_, b) => barNotes('arena', b, seed).filter((n) => n.voice === 'lyre').map((n) => n.midi)).flat();
    expect(tune(1)).not.toEqual(tune(2));
  });

  it('moves the harmony away and home every four bars', () => {
    const drone = (bar: number) => barNotes('arena', bar).find((n) => n.voice === 'drone')!.midi;
    expect(drone(0)).toBe(drone(3));
    expect(drone(4)).not.toBe(drone(0));
    expect(drone(8)).toBe(drone(0));
  });
});
