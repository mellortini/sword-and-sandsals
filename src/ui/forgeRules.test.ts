import { describe, expect, it } from 'vitest';
import { upgradeForgeItem } from '../core/forge';
import type { SavedCharacter } from '../core/save';
import { resolveAttributes } from '../core/stats';
import { applyForge, forgeRows, forgeState, materialsText } from './forgeRules';

const character: SavedCharacter = {
  name: 'Aelia', level: 3, experience: 0, gold: 0, attributes: resolveAttributes(), inventory: ['helmet1', 'sword2^+3', 'nonsense'],
  look: { skin: 0, face: 0, hair: 0, hairColor: 0, beard: 0, helmet: 0, armor: 0, shoulders: 0, greaves: 0, boots: 0, weapon: 'gladius' },
  forgeMaterials: { scraps: 2, glue: 5, ink: 0, threads: 5 },
};

describe('forge screen rules', () => {
  it('lists known pack items with the number an upgrade raises and what is missing', () => {
    const [helmet, sword, ...rest] = forgeRows(forgeState(character));
    expect(rest).toEqual([]);
    expect(helmet).toMatchObject({ index: 0, label: 'Rag Wrap', level: 0, glow: 0, tier: 1, stat: { name: 'Armour', now: 1, next: 2 } });
    expect(helmet.cost).toEqual({ scraps: 2, glue: 1, ink: 0, threads: 1 });
    expect(helmet.missing).toEqual([]);
    expect(sword).toMatchObject({ index: 1, label: 'Pressed Pulp Sword +3', level: 3, glow: 0.3, stat: { name: 'Damage' } });
    expect(sword.stat.next).toBe(sword.stat.now + 1);
    expect(sword.missing).toEqual(['scraps', 'ink']);
    expect(sword.salvage).toEqual({ scraps: 3, glue: 1, ink: 0, threads: 0 });
  });

  it('shows no upgrade at +10 and starts a save without materials from zero', () => {
    const maxed = { ...character, inventory: ['boots4^+10'], forgeMaterials: undefined };
    const [row] = forgeRows(forgeState(maxed));
    expect(row).toMatchObject({ label: 'Studded Shoes +10', glow: 1, cost: undefined, missing: [], stat: { next: undefined } });
    expect(forgeState(maxed).materials).toEqual({ scraps: 0, glue: 0, ink: 0, threads: 0 });
  });

  it('writes the forged pack and materials back to the character only', () => {
    const result = upgradeForgeItem(forgeState(character), 'helmet1');
    expect(result.ok).toBe(true);
    const after = applyForge(character, result.state);
    expect(after).toEqual({ ...character, inventory: ['helmet1^+1', 'sword2^+3', 'nonsense'], forgeMaterials: { scraps: 0, glue: 4, ink: 0, threads: 4 } });
    expect(character.inventory[0]).toBe('helmet1');
  });

  it('names only the materials that are not zero', () => {
    expect(materialsText({ scraps: 3, glue: 0, ink: 1, threads: 0 })).toBe('3 Scraps · 1 Ink')
    expect(materialsText({ scraps: 1, glue: 2, ink: 0, threads: 1 })).toBe('1 Scrap · 2 Glue · 1 Thread');;
    expect(materialsText({ scraps: 0, glue: 0, ink: 0, threads: 0 })).toBe('nothing');
  });
});
