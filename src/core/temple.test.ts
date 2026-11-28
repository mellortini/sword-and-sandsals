import { expect, it } from 'vitest';
import { applyCombatStatus, createCombat, performAction } from './combat';
import { deserializeSave, serializeSave } from './save';
import type { SavedCharacter } from './save';
import { resolveAttributes } from './stats';
import { buyTempleRemedy, healAtTemple, recoverFromDefeat, settleTempleCombat, templeCombatSlots, templeHealingQuote } from './temple';

const character: SavedCharacter = {
  name: 'Aelia', level: 1, experience: 0, gold: 25, health: 40, attributes: resolveAttributes(), inventory: ['sword1'],
  look: { skin: 3, face: 0, hair: 1, hairColor: 1, beard: 2, helmet: 0, armor: 0, shoulders: 0, greaves: 0, boots: 0, weapon: 'gladius' },
};

it('charges for missing health and preserves the save when funds are insufficient', () => {
  expect(templeHealingQuote(character)).toEqual({ health: 40, maxHealth: 70, price: 8 });
  expect(healAtTemple(character)).toMatchObject({ ok: true, price: 8, character: { gold: 17, health: 70 } });
  const broke = { ...character, gold: 7 };
  expect(healAtTemple(broke)).toEqual({ ok: false, character: broke, reason: 'insufficient-gold' });
  const oldSave = { ...character, health: undefined };
  expect(healAtTemple(oldSave)).toEqual({ ok: false, character: oldSave, reason: 'already-healed' });
});

it('buys one remedy and prevents purchases without enough gold', () => {
  expect(buyTempleRemedy(character, 'glue-tonic')).toMatchObject({
    ok: true, price: 6, character: { gold: 19, inventory: ['sword1', 'glue-tonic'] },
  });
  const broke = { ...character, gold: 13 };
  expect(buyTempleRemedy(broke, 'staples')).toEqual({ ok: false, character: broke, reason: 'insufficient-gold' });
});

it('uses staples in combat and persists remaining potions and health', () => {
  const equipped = { ...character, inventory: ['glue-tonic', 'staples', 'sword1', 'staples', 'repair-tape'] };
  const initial = createCombat(1, { health: equipped.health, slots: templeCombatSlots(equipped.inventory) });
  const wounded = applyCombatStatus(initial, 'player', 'torn');
  const action = performAction(wounded, { slot: 2, target: 'player' });
  expect(action.state.fighters.player).toMatchObject({ health: 44, statuses: [] });
  const saved = settleTempleCombat(equipped, action.state.fighters.player);
  expect(saved).toMatchObject({ health: 44, inventory: ['glue-tonic', 'staples', 'sword1', 'repair-tape'] });
  expect(deserializeSave(serializeSave(saved))).toEqual({ ok: true, character: saved });
  expect(() => createCombat(1, { health: 0 })).toThrow(RangeError);
});

it('patches a beaten gladiator up to half health for free, never taking health away', () => {
  const beaten = { ...character, gold: 0, health: 0 };
  expect(recoverFromDefeat(beaten)).toEqual({ ...beaten, health: 35 });
  const stillStrong = { ...character, health: 60 };
  expect(recoverFromDefeat(stillStrong)).toBe(stillStrong);
  const unhurt = { ...character, health: undefined };
  expect(recoverFromDefeat(unhurt)).toBe(unhurt);
});
