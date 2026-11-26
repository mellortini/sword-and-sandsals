import { describe, expect, it } from 'vitest';
import { resolveAttributes } from '../core/stats';
import { DEFAULT_LOOK, EQUIP_SLOTS } from '../rig/PaperRig';
import { NEXT_MAX_GAIN, nextOpponent } from './opponents';

const sum = (a: object) => Object.values(a).reduce((x: number, y) => x + (y as number), 0);
const lcg = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

const current = {
  name: 'Spiculus', level: 9,
  look: { ...DEFAULT_LOOK, helmet: 6, armor: 6, shoulders: 0, greaves: 6, boots: 6, weapon: 'axe6' },
  attributes: { might: 9, agility: 7, precision: 8, guard: 6, vitality: 10, stamina: 8, charm: 5, arcana: 5 },
};

describe('next opponent', () => {
  it('is never weaker and at most 5% stronger in total attributes', () => {
    const before = sum(resolveAttributes(current.attributes));
    for (let s = 1; s < 400; s++) {
      const seed = s * 7919 + 12345;
      const next = nextOpponent(current, 5, lcg(seed));
      const after = sum(next.attributes);
      expect(after).toBeGreaterThanOrEqual(before);
      expect(after).toBeLessThanOrEqual(before * (1 + NEXT_MAX_GAIN));
      for (const [k, v] of Object.entries(current.attributes)) expect(next.attributes[k as keyof typeof next.attributes]).toBeGreaterThanOrEqual(v);
      expect(next.attributes.arcana).toBe(5);
    }
    expect(Math.max(...Array.from({ length: 200 }, (_, s) => sum(nextOpponent(current, 5, lcg(s * 7919 + 12345)).attributes)))).toBeGreaterThan(before);
  });

  it('keeps the gear and weapon, changes the face and the name', () => {
    const next = nextOpponent(current, 5, lcg(7));
    for (const slot of EQUIP_SLOTS) expect(next.look[slot]).toBe(current.look[slot]);
    expect(next.look.weapon).toBe('axe6');
    expect(next.name).not.toBe('Spiculus');
  });

  it('is at most one level above the player', () => {
    expect(nextOpponent(current, 5, lcg(3)).level).toBe(6);
    expect(nextOpponent({ ...current, level: 4 }, 5, lcg(3)).level).toBe(4);
    expect(nextOpponent({ ...current, level: undefined }, 1, lcg(3)).level).toBe(1);
  });
});
