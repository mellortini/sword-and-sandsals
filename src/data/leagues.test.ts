import { expect, it } from 'vitest';
import { createCombat } from '../core/combat';
import { nextPulpportBronzeBout, PULPPORT_BRONZE, PULPPORT_CHAMPION_WEAPON } from './leagues';
import { WEAPONS } from './weapons';

it('orders five challengers before the champion and completes the league after all six victories', () => {
  const defeated: string[] = [];
  expect(PULPPORT_BRONZE).toHaveLength(6);
  expect(new Set(PULPPORT_BRONZE.map(({ id }) => id)).size).toBe(6);
  for (const bout of PULPPORT_BRONZE) {
    expect(nextPulpportBronzeBout(defeated)).toBe(bout);
    expect(!!bout.champion).toBe(defeated.length === 5);
    const state = createCombat(1, {}, bout.setup);
    expect(state.fighters.enemy).toMatchObject({ name: bout.name, level: bout.level });
    defeated.push(bout.id);
  }
  expect(nextPulpportBronzeBout(defeated)).toBeUndefined();
});

it('gives the champion a line and a prize outside the regular weapon stock', () => {
  const champion = PULPPORT_BRONZE.at(-1)?.champion;
  expect(champion?.line).toBeTruthy();
  expect(champion?.weapon).toBe(PULPPORT_CHAMPION_WEAPON);
  expect(WEAPONS.some(({ id }) => id === champion?.weapon.id)).toBe(false);
});
