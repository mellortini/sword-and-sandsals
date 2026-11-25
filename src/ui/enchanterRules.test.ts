import { describe, expect, it } from 'vitest';
import type { SavedCharacter } from '../core/save';
import { resolveAttributes } from '../core/stats';
import { applyEnchantment, effectText, enchantPrice, enchantTargets } from './enchanterRules';

const character: SavedCharacter = {
  name: 'Aelia', level: 6, experience: 0, gold: 100, attributes: resolveAttributes(),
  look: { skin: 0, face: 0, hair: 0, hairColor: 0, beard: 0, helmet: 0, armor: 0, shoulders: 0, greaves: 0, boots: 0, weapon: 'sword2' },
  hands: { weapon: 'sword2^+1' }, inventory: ['helmet1', 'axe1~water~1', 'glue-tonic'],
};

describe('enchanter rules', () => {
  it('offers the held weapon first, then weapons from the pack', () => {
    expect(enchantTargets(character)).toEqual([
      expect.objectContaining({ key: 'hand:weapon', id: 'sword2^+1', source: 'weapon', where: 'main hand', current: undefined }),
      expect.objectContaining({ key: 'pack:1', id: 'axe1~water~1', source: 'backpack', current: { element: 'water', power: 1 } }),
    ]);
  });

  it('describes what an enchantment does', () => {
    expect(effectText({ element: 'fire', power: 2 })).toBe('+4 damage on a hit, sets the foe burning');
    expect(effectText({ element: 'wind', power: 1 })).toBe('+2 damage on a hit, knocks the foe back 1');
  });

  it('enchants the held weapon, keeps its forge level and replaces an older enchantment', () => {
    const [held, axe] = enchantTargets(character);
    const price = enchantPrice(held, 3)!;
    const result = applyEnchantment(character, held, { element: 'ink', power: 3 });
    expect(result).toMatchObject({ ok: true, character: { gold: 100 - price, hands: { weapon: 'sword2^+1~ink~3' } } });
    const again = applyEnchantment(character, axe, { element: 'fire', power: 1 });
    expect(again.ok && again.character.inventory[1]).toBe('axe1~fire~1');
  });
});
