import { describe, expect, it } from 'vitest';
import { bake, sample } from './clip';
import { CLIPS, bakeAll } from './clips';

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
    for (const clip of CLIPS.filter((c) => !c.loop && !c.hold)) {
      const end = sample(baked[clip.name], clip.length);
      expect({ clip: clip.name, y: end.y, air: end.air }).toEqual({ clip: clip.name, y: 0, air: false });
    }
  });
});
