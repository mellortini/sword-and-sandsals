import { describe, expect, it } from 'vitest';
import { serializeSave } from '../core/save';
import {
  ATTRIBUTE_BASE, ATTRIBUTE_INFO, ATTRIBUTE_MAX, STARTING_POINTS,
  canLower, lower, nameProblem, newCharacter, raise, randomSpread, startSpread,
} from './creatorRules';

const appearance = { skin: 2, face: 4, hair: 6, hairColor: 1, beard: 0 };

describe('creator rules', () => {
  it('covers all eight attributes, each starting at the base', () => {
    const s = startSpread();
    expect(ATTRIBUTE_INFO.map((a) => a.key).sort()).toEqual(Object.keys(s.attributes).sort());
    expect(Object.values(s.attributes).every((v) => v === ATTRIBUTE_BASE)).toBe(true);
    expect(s.free).toBe(STARTING_POINTS);
  });

  it('moves points in and out without going below the base or above the cap', () => {
    let s = startSpread();
    expect(canLower(s, 'might')).toBe(false);
    expect(lower(s, 'might')).toBe(s);
    for (let i = 0; i < 20; i++) s = raise(s, 'might');
    expect(s.attributes.might).toBe(ATTRIBUTE_MAX);
    expect(s.free).toBe(STARTING_POINTS - (ATTRIBUTE_MAX - ATTRIBUTE_BASE));
    s = lower(s, 'might');
    expect(s.attributes.might).toBe(ATTRIBUTE_MAX - 1);
    expect(s.free).toBe(STARTING_POINTS - (ATTRIBUTE_MAX - ATTRIBUTE_BASE) + 1);
  });

  it('random spread spends every point within the limits', () => {
    let r = 7;
    const random = () => ((r = (r * 48271) % 2147483647) / 2147483647);
    for (let i = 0; i < 50; i++) {
      const s = randomSpread(random);
      const values = Object.values(s.attributes);
      expect(s.free).toBe(0);
      expect(values.reduce((a, b) => a + b, 0)).toBe(ATTRIBUTE_BASE * values.length + STARTING_POINTS);
      expect(values.every((v) => v >= ATTRIBUTE_BASE && v <= ATTRIBUTE_MAX)).toBe(true);
    }
  });

  it('checks names', () => {
    expect(nameProblem('  ')).toMatch(/name/);
    expect(nameProblem('Spartacus the Very Long Name')).toMatch(/20/);
    expect(nameProblem('R2-D2')).toMatch(/Letters/);
    expect(nameProblem("Varro O'Fold")).toBeNull();
    expect(nameProblem('Łucja Zgięta')).toBeNull();
  });

  it('builds a level 1 character the save accepts', () => {
    const c = newCharacter('  Varro   Fold ', appearance, randomSpread());
    expect(c).toMatchObject({ name: 'Varro Fold', level: 1, experience: 0, inventory: [] });
    expect(c.look).toMatchObject({ ...appearance, helmet: 0, armor: 0, shoulders: 0, greaves: 0, boots: 0 });
    expect(() => serializeSave(c)).not.toThrow();
  });

  it('refuses an unfinished draft', () => {
    expect(() => newCharacter('', appearance, randomSpread())).toThrow();
    expect(() => newCharacter('Varro', appearance, startSpread())).toThrow(/point/);
  });
});
