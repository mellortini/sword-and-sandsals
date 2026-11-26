import { describe, expect, it } from 'vitest';
import type { SavedCharacter } from '../core/save';
import { deriveStats, resolveAttributes } from '../core/stats';
import { healingText, remedyRows } from './templeRules';

const attributes = resolveAttributes();
const max = deriveStats(attributes).maxHealth;
const character: SavedCharacter = {
  name: 'Aelia', level: 2, experience: 0, gold: 10, attributes, inventory: ['glue-tonic', 'helmet1', 'glue-tonic'],
  look: { skin: 0, face: 0, hair: 0, hairColor: 0, beard: 0, helmet: 0, armor: 0, shoulders: 0, greaves: 0, boots: 0, weapon: 'gladius' },
};

describe('temple screen rules', () => {
  it('lists the three remedies with price, owned count and whether the gold is enough', () => {
    expect(remedyRows(character)).toEqual([
      expect.objectContaining({ id: 'glue-tonic', name: 'Glue Tonic', price: 6, owned: 2, affordable: true }),
      expect.objectContaining({ id: 'repair-tape', name: 'Repair Tape', price: 10, owned: 0, affordable: true }),
      expect.objectContaining({ id: 'staples', name: 'Staples', price: 14, owned: 0, affordable: false }),
    ]);
  });

  it('offers healing only when hurt, and says when the gold is short', () => {
    expect(healingText(character)).toEqual({ line: `Health ${max} / ${max} · no wounds to mend`, price: 0, canHeal: false });
    const hurt = { ...character, health: max - 18 };
    expect(healingText(hurt)).toEqual({ line: `Health ${max - 18} / ${max} · mend 18 HP for 6 gold`, price: 6, canHeal: true });
    expect(healingText({ ...hurt, gold: 5 }).canHeal).toBe(false);
  });
});
