import { describe, expect, it } from 'vitest';
import { createCombat } from '../core/combat';
import type { SavedCharacter } from '../core/save';
import { deserializeSave, serializeSave } from '../core/save';
import { resolveAttributes } from '../core/stats';
import { applyInventory, careerLoadout, gearItem, savedInventory, takeOff, wear, wearProblem } from './gearRules';

const base: SavedCharacter = {
  name: 'Aelia', level: 6, experience: 0, gold: 0, attributes: resolveAttributes({ might: 6 }),
  look: { skin: 3, face: 0, hair: 1, hairColor: 1, beard: 2, helmet: 2, armor: 0, shoulders: 0, greaves: 0, boots: 0, weapon: 'gladius' },
  armourImprovements: { helmet: 3 },
  inventory: ['sword2^+1~fire~1', 'armor1', 'glue-tonic', 'hammer9'],
};

describe('gear rules', () => {
  it('reads worn armour from the look with its forge level and the hands from the save', () => {
    expect(savedInventory(base).equipped).toEqual({ helmet: 'helmet2^+3' });
    expect(savedInventory({ ...base, hands: { weapon: 'axe1' } }).equipped).toEqual({ helmet: 'helmet2^+3', weapon: 'axe1' });
    // an older save without hands holds the catalogue weapon its puppet shows
    expect(savedInventory({ ...base, look: { ...base.look, weapon: 'spear3' } }).equipped.weapon).toBe('spear3');
  });

  it('wears an enchanted, upgraded weapon: hands, puppet look and combat follow', () => {
    const worn = wear(base, 'sword2^+1~fire~1');
    expect(worn.ok).toBe(true);
    const c = worn.character;
    expect(c.hands).toEqual({ weapon: 'sword2^+1~fire~1' });
    expect(c.look.weapon).toBe('sword2');
    expect(c.inventory).toEqual(['armor1', 'glue-tonic', 'hammer9']);
    const fighter = createCombat(1, { equipment: careerLoadout(c) }).fighters.player;
    expect(fighter.weapon).toMatchObject({ id: 'sword2^+1~fire~1', enchantment: { element: 'fire', power: 1 } });
    expect(deserializeSave(serializeSave(c))).toEqual({ ok: true, character: c });
  });

  it('swaps armour into the pack and keeps forge levels with the piece', () => {
    const c = wear(takeOff(base, 'helmet').character, 'armor1').character;
    expect(c.look).toMatchObject({ helmet: 0, armor: 1 });
    expect(c.armourImprovements).toBeUndefined();
    expect(c.inventory).toContain('helmet2^+3');
    const back = wear(c, 'helmet2^+3').character;
    expect(back.look.helmet).toBe(2);
    expect(back.armourImprovements).toEqual({ helmet: 3 });
  });

  it('says why an item cannot be worn', () => {
    expect(wearProblem(base, 'hammer9')).toBe('needs level 25');
    expect(wear(base, 'hammer9')).toMatchObject({ ok: false, problem: 'needs level 25' });
    expect(wearProblem(base, 'glue-tonic')).toBe('not wearable');
    expect(gearItem('sword2^+1~fire~1')).toMatchObject({ name: 'Pressed Pulp Sword +1 (fire 1)', slot: 'hand' });
  });

  it('round-trips when nothing changes', () => {
    expect(applyInventory(base, savedInventory(base))).toEqual({ ...base, hands: {} });
  });
});
