import { expect, it } from 'vitest';
import { ITEMS } from './equipment';
import { WEAPONS, WEAPON_FAMILIES, weapon } from './weapons';

it('defines ten progressively stronger weapons per family with unique identifiers', () => {
  expect(WEAPONS).toHaveLength(50);
  expect(new Set(WEAPONS.map(({ id }) => id)).size).toBe(50);

  for (const family of WEAPON_FAMILIES) {
    const entries = WEAPONS.filter((entry) => entry.family === family);
    expect(entries.map(({ tier }) => tier)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    for (let index = 1; index < entries.length; index++) {
      expect(entries[index].damage).toBeGreaterThan(entries[index - 1].damage);
      expect(entries[index].price).toBeGreaterThan(entries[index - 1].price);
      expect(entries[index].minMight).toBeGreaterThan(entries[index - 1].minMight);
    }
  }

  expect(weapon('sword', 0)).toBeUndefined();
  expect(weapon('sword', 11)).toBeUndefined();
});

it('prices weapons against armour from the same tier and uses the same minimum level', () => {
  for (const entry of WEAPONS) {
    const set = ITEMS.filter(({ tier }) => tier === entry.tier);
    const price = set.reduce((total, piece) => total + piece.price, 0);
    expect(entry.price % 5).toBe(0);
    expect(entry.price).toBeGreaterThanOrEqual(price * 0.45 - 2.5);
    expect(entry.price).toBeLessThanOrEqual(price * 0.6 + 2.5);
    expect(entry.minLevel).toBe(Math.max(...set.map(({ minLevel }) => minLevel)));
  }
});

it('models distinct family roles at the same tier', () => {
  expect(weapon('sword', 5)).toMatchObject({ damageType: 'cut', range: 2, speed: 1 });
  expect(weapon('axe', 5)).toMatchObject({ damageType: 'cut', damage: 16 });
  expect(weapon('spear', 5)).toMatchObject({ damageType: 'pierce', range: 3 });
  expect(weapon('hammer', 5)).toMatchObject({ damageType: 'crush', damage: 18, speed: 0.72 });
});
