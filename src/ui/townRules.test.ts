import { describe, expect, it } from 'vitest';
import type { SavedCharacter } from '../core/save';
import { resolveAttributes } from '../core/stats';
import { townNote } from './townRules';

const c: SavedCharacter = {
  name: 'Aelia', level: 3, experience: 0, gold: 0, attributes: resolveAttributes(), inventory: [],
  look: { skin: 0, face: 0, hair: 0, hairColor: 0, beard: 0, helmet: 0, armor: 0, shoulders: 0, greaves: 0, boots: 0, weapon: 'gladius' },
};

describe('town note', () => {
  it('names what needs attention, or the places when nothing does', () => {
    expect(townNote(c)).toBe('gear, forge, temple, trainer…');
    expect(townNote({ ...c, health: 3, attributePoints: 1, skillPoints: 2 })).toBe('wounded · 1 attribute point · 2 skill points');
  });
});
