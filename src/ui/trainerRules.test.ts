import { describe, expect, it } from 'vitest';
import type { SavedCharacter } from '../core/save';
import { resolveAttributes } from '../core/stats';
import { pointsText, trainerView } from './trainerRules';

const character: SavedCharacter = {
  name: 'Aelia', level: 3, experience: 0, gold: 40, attributePoints: 2,
  attributes: resolveAttributes({ might: 8, agility: 6 }), inventory: [],
  look: { skin: 0, face: 0, hair: 0, hairColor: 0, beard: 0, helmet: 0, armor: 0, shoulders: 0, greaves: 0, boots: 0, weapon: 'gladius' },
};

describe('trainer screen rules', () => {
  it('shows trained points per attribute and the reset offer', () => {
    const view = trainerView(character);
    expect(view.rows[0]).toEqual({ key: 'might', label: 'Might', value: 8, trained: 3 });
    expect(view.rows[1]).toMatchObject({ key: 'agility', trained: 1 });
    expect(view).toMatchObject({ points: 2, price: 35, refund: 4, resetBlocked: undefined });
  });

  it('says why a reset cannot be bought', () => {
    expect(trainerView({ ...character, gold: 34 }).resetBlocked).toBe('insufficient-gold');
    expect(trainerView({ ...character, attributes: resolveAttributes() }).resetBlocked).toBe('nothing-to-reset');
  });

  it('counts points in words', () => {
    expect(pointsText(1)).toBe('1 point');
    expect(pointsText(4)).toBe('4 points');
  });
});
