import { describe, expect, it } from 'vitest';
import kitJson from '../../assets/chars/kit/kit.json';
import type { KitJson } from './PaperRig';
import { turnedLayers } from './shield';
import { WOUND_STAGES, woundSprite, woundStage } from './wounds';

const kit = kitJson as unknown as KitJson;
const table = kit.wounds!;

describe('body damage stages (#284)', () => {
  it('moves one stage for every 10 % of health lost', () => {
    const stages = [100, 91, 90, 81, 80, 71, 70, 51, 50, 21, 20, 11, 10, 1, 0].map((hp) => woundStage(hp, 100));
    expect(stages).toEqual([1, 1, 2, 2, 3, 3, 4, 5, 6, 8, 9, 9, 10, 10, 10]);
    expect(woundStage(180, 200)).toBe(2);
    expect(woundStage(130, 100)).toBe(1);
    expect(woundStage(5, 0)).toBe(1);
  });

  it('has a sprite for every wound the table names, and none on an unhurt fighter', () => {
    for (const [part, keys] of Object.entries(table)) {
      expect(keys, part).toHaveLength(WOUND_STAGES);
      expect(keys[0], part).toBeNull();
      // a part with no wound in the design (the back shin) stays clean all the way
      if (keys.some(Boolean)) expect(keys[WOUND_STAGES - 1], part).not.toBeNull();
      for (const key of keys) if (key) expect(kit.sprites[key], key).toBeDefined();
    }
    expect(woundSprite(table, 'torso', 1)).toBeNull();
    expect(woundSprite(table, 'torso')).toBeNull();
    expect(woundSprite(table, 'nowhere', 5)).toBeNull();
  });

  it('draws each wound on its own skin, also in the quarter turn', () => {
    for (const layers of [kit.layers, turnedLayers(kit.layers)]) {
      const wounds = layers.filter((l) => l.slot === 'wound');
      expect(wounds.map((l) => l.piece).sort()).toEqual(Object.keys(table).sort());
      for (const wound of wounds.filter((l) => l.bone !== 'head' && l.bone !== 'torso')) {
        const at = layers.indexOf(wound);
        // right above the bare limb, shaded the same way, so armour still covers it
        expect(layers[at - 1], wound.piece).toMatchObject({ bone: wound.bone, slot: 'body' });
        expect(!!layers[at - 1].back, wound.piece).toBe(!!wound.back);
      }
    }
  });
});
