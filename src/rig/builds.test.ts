import { describe, expect, it } from 'vitest';
import { deserializeSave, serializeSave } from '../core/save';
import type { SavedCharacter } from '../core/save';
import { resolveAttributes } from '../core/stats';
import { newCharacter, startSpread } from '../ui/creatorRules';
import { BUILDS, DEFAULT_BUILD, widthScale } from './builds';

describe('body builds (#27)', () => {
  it('slim is narrower and heavy wider than average, on the body and the limbs only', () => {
    for (const bone of ['torso', 'pelvis', 'arm_f_up', 'leg_b_lo']) {
      expect(widthScale(0, bone)).toBeLessThan(1);
      expect(widthScale(DEFAULT_BUILD, bone)).toBe(1);
      expect(widthScale(2, bone)).toBeGreaterThan(1);
    }
    for (const bone of ['head', 'hand_f', 'foot_b', 'weapon']) for (let b = 0; b < BUILDS.length; b++) expect(widthScale(b, bone)).toBe(1);
  });

  it('an old look without a build, or an unknown build, is average', () => {
    expect(widthScale(undefined, 'torso')).toBe(1);
    expect(widthScale(7, 'torso')).toBe(1);
  });

  it('the saved gladiator keeps its build; a build outside 0..2 is not a valid save', () => {
    const c: SavedCharacter = {
      name: 'Varro', level: 1, experience: 0, gold: 0, attributes: resolveAttributes({}), inventory: [],
      look: { skin: 3, face: 0, hair: 1, hairColor: 1, beard: 2, helmet: 0, armor: 0, shoulders: 0, greaves: 0, boots: 0, weapon: 'gladius', build: 2 },
    };
    expect(deserializeSave(serializeSave(c))).toEqual({ ok: true, character: c });
    expect(() => serializeSave({ ...c, look: { ...c.look, build: 3 } })).toThrow();
    expect(deserializeSave(serializeSave(c).replace('"build": 2', '"build": 3')).ok).toBe(false);
  });

  it('the creator puts the chosen build into the new gladiator', () => {
    const spread = startSpread();
    const free = { ...spread, free: 0 };
    const hero = newCharacter('Varro', { skin: 1, face: 2, hair: 3, hairColor: 4, beard: 5, build: 0 }, free);
    expect(hero.look.build).toBe(0);
  });
});
