import { describe, expect, it } from 'vitest';
import { ITEMS } from '../data/equipment';
import { WEAPONS } from '../data/weapons';
import { createCombat } from './combat';
import { generateEnemy } from './enemies';
import { LEAGUE_MAX_TIER } from './leagues';
import type { League } from './leagues';

const slots = ['helmet', 'armor', 'shoulders', 'greaves', 'boots'] as const;
const leagues = Object.keys(LEAGUE_MAX_TIER) as League[];

describe('enemy generation', () => {
  it('replays the same opponent for a seed and generates diverse names and looks', () => {
    const first = generateEnemy(42, 12, 'silver');
    expect(generateEnemy(42, 12, 'silver')).toEqual(first);
    const batch = Array.from({ length: 16 }, (_, seed) => generateEnemy(seed, 12, 'silver'));
    expect(new Set(batch.map((enemy) => enemy.name)).size).toBeGreaterThan(5);
    expect(new Set(batch.map((enemy) => JSON.stringify(enemy.look))).size).toBeGreaterThan(10);
  });

  it('respects level and league bounds for every attribute, visual index and equipment slot', () => {
    for (const playerLevel of [1, 15, 30, 60]) {
      for (const league of leagues) {
        for (let seed = 0; seed < 10; seed++) {
          const enemy = generateEnemy(seed * 1009, playerLevel, league);
          expect(enemy.level).toBeGreaterThanOrEqual(Math.max(1, playerLevel - 2));
          expect(enemy.level).toBeLessThanOrEqual(Math.min(60, playerLevel + 2));
          const baseline = 4 + Math.floor((enemy.level - 1) / 4);
          for (const value of Object.values(enemy.attributes)) {
            expect(value).toBeGreaterThanOrEqual(baseline - 2);
            expect(value).toBeLessThanOrEqual(baseline + 2);
          }
          for (const index of [enemy.look.skin, enemy.look.face, enemy.look.hair, enemy.look.hairColor, enemy.look.beard]) {
            expect(index).toBeGreaterThanOrEqual(0);
            expect(index).toBeLessThan(10);
          }
          for (const slot of slots) {
            const tier = enemy.look[slot];
            expect(enemy.equipment[slot] ?? 0).toBe(tier);
            expect(tier).toBeLessThanOrEqual(LEAGUE_MAX_TIER[league]);
            if (tier) expect(ITEMS.find((item) => item.slot === slot && item.tier === tier)!.minLevel).toBeLessThanOrEqual(enemy.level);
          }
          const weapon = WEAPONS.find((item) => item.id === enemy.equipment.weapon);
          expect(weapon).toMatchObject({ family: 'sword' });
          expect(weapon!.tier).toBeLessThanOrEqual(LEAGUE_MAX_TIER[league]);
          expect(weapon!.minLevel).toBeLessThanOrEqual(enemy.level);
          expect(weapon!.minMight).toBeLessThanOrEqual(enemy.attributes.might);
        }
      }
    }
  });

  it('uses stronger gear in higher leagues and feeds the combat engine directly', () => {
    const bronze = generateEnemy(42, 60, 'bronze');
    const legend = generateEnemy(42, 60, 'legend');
    const beginner = createCombat(2, {}, bronze).fighters.enemy;
    const veteran = createCombat(2, {}, legend).fighters.enemy;
    expect(veteran).toMatchObject({ name: legend.name, attributes: legend.attributes });
    expect(veteran.stats.armour).toBeGreaterThan(beginner.stats.armour);
    expect(() => generateEnemy(42, 0, 'bronze')).toThrow(RangeError);
  });
});
