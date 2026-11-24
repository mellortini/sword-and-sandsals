import { afterEach, expect, it } from 'vitest';
import example from '../../assets/mods/example.json';
import { createCombat } from '../core/combat';
import { getShopStock } from '../core/shop';
import { activateModPack, getActiveModPack, getModOpponent, loadModPack, parseModPack } from './mods';

afterEach(() => activateModPack());

it('loads the example file and uses its armour, weapon and opponent in real combat and shops', async () => {
  const file = new Blob([JSON.stringify(example)], { type: 'application/json' });
  const pack = await loadModPack(file);
  activateModPack(pack);
  expect(getActiveModPack()).toBe(pack);
  const opponent = getModOpponent('quay-cup', 0);
  expect(opponent).toMatchObject({ id: 'quay-duellist', profile: 'aggressor' });
  const fight = createCombat(1, {}, opponent!.setup);
  expect(fight.fighters.enemy).toMatchObject({
    name: 'Vesper of the Quay', level: 2, weapon: { id: 'quay-blade' }, stats: { armour: 3, attackPower: 12 },
  });
  expect(getShopStock('weaponsmith', 'bronze')).toContainEqual(expect.objectContaining({ id: 'quay-blade', price: 25 }));
  activateModPack();
  expect(getShopStock('weaponsmith', 'bronze')).not.toContainEqual(expect.objectContaining({ id: 'quay-blade' }));
});

it('rejects an unknown version, broken reference and out-of-range item without changing the active mod', () => {
  const active = parseModPack(JSON.stringify(example));
  activateModPack(active);
  expect(() => parseModPack('{"version":2}')).toThrow(TypeError);
  expect(() => parseModPack('{"version":1,"armour":[{"id":"armor1","armor":999}]}')).toThrow(RangeError);
  expect(() => parseModPack('{"version":1,"leagues":[{"id":"broken-cup","name":"Broken Cup","opponents":["unknown"]}]}')).toThrow(TypeError);
  expect(getActiveModPack()).toBe(active);
});
