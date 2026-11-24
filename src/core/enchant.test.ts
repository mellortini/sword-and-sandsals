import { expect, it } from 'vitest';
import { createCombat, performAction } from './combat';
import { ENCHANT_ELEMENTS, enchantmentPrice, enchantWeapon } from './enchant';
import { equipItem, equipmentLoadout } from './inventory';
import { deserializeSave, serializeSave } from './save';
import type { SavedCharacter } from './save';
import { resolveAttributes } from './stats';

const character: SavedCharacter = {
  name: 'Aelia', level: 4, experience: 240, gold: 100, attributes: resolveAttributes(), inventory: ['sword1', 'sword1'],
  hands: { offHand: 'axe1' },
  look: { skin: 3, face: 0, hair: 1, hairColor: 1, beard: 2, helmet: 0, armor: 0, shoulders: 0, greaves: 0, boots: 0, weapon: 'gladius' },
};

it('charges by base weapon value and power, and enchants just one owned copy', () => {
  const result = enchantWeapon(character, 'sword1', 'backpack', { element: 'fire', power: 2 });
  expect(result).toMatchObject({ ok: true, id: 'sword1~fire~2', character: { inventory: ['sword1~fire~2', 'sword1'] } });
  expect(enchantmentPrice('sword2', 2)).toBeGreaterThan(enchantmentPrice('sword1', 2)!);
  expect(enchantmentPrice('sword1', 3)).toBeGreaterThan(enchantmentPrice('sword1', 1)!);
  expect(enchantWeapon(character, 'hammer3', 'backpack', { element: 'fire', power: 1 })).toMatchObject({ ok: false, reason: 'not-owned' });
  expect(enchantWeapon({ ...character, gold: 0 }, 'sword1', 'backpack', { element: 'fire', power: 1 })).toMatchObject({
    ok: false, reason: 'insufficient-gold',
  });
  expect(enchantWeapon(character, 'axe1', 'offHand', { element: 'ink', power: 3 })).toMatchObject({
    ok: true, character: { hands: { offHand: 'axe1~ink~3' } },
  });
  expect(deserializeSave(serializeSave(result.character))).toEqual({ ok: true, character: result.character });
});

it('equips a saved enchantment as a real weapon and deals all four elements at three strengths', () => {
  for (const element of ENCHANT_ELEMENTS) {
    for (const [power, damage] of [[1, 2], [2, 4], [3, 7]] as const) {
      const id = `sword1~${element}~${power}`;
      const equip = equipItem({ backpack: [id], equipped: {} }, id, { level: 4, might: 5 });
      expect(equip.ok).toBe(true);
      const state = createCombat(1, { position: 4, equipment: equipmentLoadout(equip.inventory.equipped) }, { position: 5 });
      const result = performAction(state, 'normal');
      expect(result.events).toContainEqual({ type: 'elemental', actor: 'player', target: 'enemy', element, power, damage });
      if (element === 'wind') expect(result.events).toContainEqual(expect.objectContaining({ type: 'move', kind: 'knockback' }));
      if (element === 'fire') expect(result.events).toContainEqual(expect.objectContaining({ type: 'status', kind: 'burning' }));
    }
  }
});

it('does not trigger the enchantment when the attack is blocked', () => {
  const initial = createCombat(1, { position: 4, equipment: { weapon: 'sword1~fire~3' } }, { position: 5 });
  const enemy = { ...initial.fighters.enemy, guarding: true };
  const result = performAction({ ...initial, fighters: { ...initial.fighters, enemy } }, 'normal');
  expect(result.events).toContainEqual(expect.objectContaining({ type: 'attack', blocked: true }));
  expect(result.events.some(({ type }) => type === 'elemental')).toBe(false);
});
