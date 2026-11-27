import { describe, expect, it } from 'vitest';
import { bake, sample } from './clip';
import { ALL_CLIPS, bakeAll } from './clips';

describe('bake: root height', () => {
  it('puts a grounded key without y back on the floor after air keys', () => {
    const c = bake({
      name: 't', length: 10, keys: [
        { f: 0 },
        { f: 4, air: true, y: 2 },
        { f: 6, air: true },
        { f: 10 },
      ],
    }, {});
    expect(c.full.map((k) => k.y)).toEqual([0, 2, 2, 0]);
  });

  it('keeps an explicit y on a grounded key', () => {
    const c = bake({ name: 't', length: 4, keys: [{ f: 0 }, { f: 4, y: -0.5 }] }, {});
    expect(c.full[1].y).toBe(-0.5);
  });

  it('ends every non-looping, non-holding clip with both feet planted (root y = 0, grounded)', () => {
    const baked = bakeAll({});
    for (const clip of ALL_CLIPS.filter((c) => !c.loop && !c.hold)) {
      const end = sample(baked[clip.name], clip.length);
      expect({ clip: clip.name, y: end.y, air: end.air }).toEqual({ clip: clip.name, y: 0, air: false });
    }
  });
});

describe('dodge (#13)', () => {
  const baked = bakeAll({});

  it('lasts 10-14 frames, leans away with a step back and ends where it started', () => {
    const c = baked.dodge;
    expect(c.length).toBeGreaterThanOrEqual(10);
    expect(c.length).toBeLessThanOrEqual(14);
    const deepest = sample(c, 3);
    expect(deepest.x).toBeLessThan(-0.5);
    expect(deepest.pose.torso).toBeGreaterThan(15);
    expect(sample(c, c.length).x).toBe(0);
  });

  it('has hammer and spear variants that keep the weapon in its ready angle while leaning', () => {
    for (const fam of ['hammer', 'spear']) {
      const v = baked[`dodge@${fam}`];
      const ready = baked[`idle@${fam}`].full[0].pose;
      const mid = sample(v, 3).pose;
      expect(mid.arm_f_up).toBeCloseTo(ready.arm_f_up ?? 0);
      expect(mid.torso).toBeGreaterThan(15);
      expect(sample(v, v.length).x).toBe(0);
    }
  });
});
