import { expect, it } from 'vitest';
import { createCombat, performAction } from './combat';
import { enchantmentPrice } from './enchant';
import { forgeFightLoot, forgePresentation, forgeUpgradeCost, salvageForgeItem, upgradeForgeItem } from './forge';
import type { ForgeState } from './forge';
import { equipItem, equipmentLoadout } from './inventory';
import { deserializeSave, serializeSave } from './save';
import type { SavedCharacter } from './save';
import { resolveAttributes } from './stats';
import { combatWeapon } from './weapons';

const initial: ForgeState = {
  inventory: { backpack: ['helmet1', 'helmet1', 'sword1'], equipped: {} },
  materials: { scraps: 1_000, glue: 1_000, ink: 1_000, threads: 1_000 },
};

it('improves exactly one owned item and caps upgrades at +10', () => {
  let state = initial;
  let id = 'helmet1';
  for (let level = 1; level <= 10; level++) {
    const upgrade = upgradeForgeItem(state, id);
    expect(upgrade.ok).toBe(true);
    state = upgrade.state;
    id = `helmet1^+${level}`;
    expect(state.inventory.backpack).toEqual([id, 'helmet1', 'sword1']);
  }
  expect(forgeUpgradeCost(id)).toBeUndefined();
  expect(forgePresentation(id)).toMatchObject({ label: 'Rag Wrap +10', glow: 1 });
  expect(upgradeForgeItem(state, id)).toEqual({ ok: false, state, reason: 'unavailable' });
  const broke = { ...initial, materials: { scraps: 0, glue: 0, ink: 0, threads: 0 } };
  expect(upgradeForgeItem(broke, 'helmet1')).toEqual({ ok: false, state: broke, reason: 'insufficient-materials' });
});

it('adds stats through the normal inventory and combat loadout', () => {
  const inventory = { equipped: {}, backpack: ['helmet1^+2', 'sword1^+3'] };
  const readied = equipItem(inventory, 'helmet1^+2', { level: 4, might: 5 }).inventory;
  const armed = equipItem(readied, 'sword1^+3', { level: 4, might: 5 }).inventory;
  const setup = equipmentLoadout(armed.equipped);
  expect(setup).toMatchObject({ helmet: 1, weapon: 'sword1^+3', improvements: { helmet: 2 } });
  expect(createCombat(1, { equipment: setup }).fighters.player).toMatchObject({
    stats: { armour: 3, attackPower: 12 }, armourByZone: { head: 3 },
  });
});

it('salvages one piece and persists materials, while fights grant loot only on victory', () => {
  const salvage = salvageForgeItem(initial, 'helmet1');
  expect(salvage).toMatchObject({
    ok: true, state: { inventory: { backpack: ['helmet1', 'sword1'] }, materials: { scraps: 1_001, glue: 1_001, threads: 1_001 } },
  });
  const fight = createCombat(1, { position: 4, attributes: { might: 1000 } }, { position: 5, level: 6 });
  expect(forgeFightLoot(fight)).toEqual({ scraps: 0, glue: 0, ink: 0, threads: 0 });
  expect(forgeFightLoot(performAction(fight, 'normal').state)).toEqual({ scraps: 3, glue: 1, ink: 1, threads: 1 });
  const character: SavedCharacter = {
    name: 'Aelia', level: 6, experience: 0, gold: 20, attributes: resolveAttributes(), inventory: [],
    look: { skin: 3, face: 0, hair: 1, hairColor: 1, beard: 2, helmet: 1, armor: 0, shoulders: 0, greaves: 0, boots: 0, weapon: 'gladius' },
    forgeMaterials: salvage.state.materials, armourImprovements: { helmet: 2 },
  };
  expect(deserializeSave(serializeSave(character))).toEqual({ ok: true, character });
});

it('keeps the upgrade when an upgraded weapon is enchanted', () => {
  const weapon = combatWeapon('sword1^+3~fire~2');
  expect(weapon).toMatchObject({ id: 'sword1^+3~fire~2', damage: combatWeapon('sword1')!.damage + 3, enchantment: { element: 'fire', power: 2 } });
  expect(enchantmentPrice('sword1^+3', 1)).toBe(enchantmentPrice('sword1', 1));
  const inventory = { equipped: {}, backpack: ['sword1^+3~fire~2'] };
  expect(equipItem(inventory, 'sword1^+3~fire~2', { level: 1, might: 5 }).ok).toBe(true);
});
