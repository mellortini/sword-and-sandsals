import { describe, expect, it } from 'vitest';
import { AFFIXES } from '../data/affixes';
import { ITEMS } from '../data/equipment';
import { WEAPONS } from '../data/weapons';
import { equipmentTotals } from './inventory';
import { lootArmourTotals, lootModifiers, RARITIES, rollLoot } from './items';
import type { LootItem } from './items';

const affix = (id: string) => AFFIXES.find((entry) => entry.id === id)!;

describe('loot', () => {
  it('is seeded and only drops equipment the character can use by level', () => {
    expect(rollLoot(1234, 15)).toEqual(rollLoot(1234, 15));
    for (const level of [1, 6, 15, 30, 60]) {
      const counts = new Set<string>();
      for (let seed = 0; seed < 60; seed++) {
        const { item, rngState } = rollLoot(seed * 1039, level);
        expect(item.base.minLevel).toBeLessThanOrEqual(level);
        expect(rngState).not.toBe(seed * 1039);
        counts.add(item.base.id);
      }
      expect(counts.size).toBeGreaterThan(3);
    }
  });

  it('rolls all five rarities, with matching, distinct affixes and unique frame colours', () => {
    const encountered = new Set<string>();
    for (let seed = 0; seed < 1200; seed++) {
      const { item } = rollLoot(seed * 983, 30);
      encountered.add(item.rarity);
      const rules = RARITIES.find((rarity) => rarity.id === item.rarity)!;
      expect(item.affixes).toHaveLength(rules.affixCount);
      expect(new Set(item.affixes.map(({ id }) => id)).size).toBe(rules.affixCount);
      expect(item.affixes.every(({ fits }) => fits === ('slot' in item.base ? 'armour' : 'weapon'))).toBe(true);
    }
    expect(encountered.size).toBe(RARITIES.length);
    expect(new Set(RARITIES.map(({ frameColor }) => frameColor)).size).toBe(RARITIES.length);
  });

  it('exposes Kindling as a burning modifier and retains effects with a complete mixed-rarity set', () => {
    const sword: LootItem = { base: WEAPONS[0], rarity: 'rare', affixes: [affix('kindling'), affix('jagged')] };
    expect(lootModifiers(sword)).toMatchObject({ attack: 2, onHit: [{ kind: 'on-hit', status: 'burning', chance: 25 }] });

    const pieces = ITEMS.filter((item) => item.tier === 5);
    const loadout = Object.fromEntries(pieces.map((item) => [item.slot, item.tier]));
    const withoutAffixes = equipmentTotals(loadout);
    const loot = Object.fromEntries(pieces.map((base) => [
      base.slot,
      { base, rarity: base.slot === 'helmet' ? 'rare' : 'common', affixes: base.slot === 'helmet' ? [affix('glued'), affix('reinforced')] : [] } satisfies LootItem,
    ]));
    expect(lootArmourTotals(loot)).toEqual({ ...withoutAffixes, fullSet: true, armour: withoutAffixes.armour + 2, regeneration: 2 });
    expect(lootArmourTotals({ ...loot, helmet: sword }).fullSet).toBe(false);
  });
});
