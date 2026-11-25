import { describe, expect, it } from 'vitest';
import { createCombat, performAction } from '../core/combat';
import type { SavedCharacter } from '../core/save';
import { deserializeSave, serializeSave } from '../core/save';
import { resolveAttributes } from '../core/stats';
import { equipmentSignal, recordForCareer, trophyCount, trophyList } from './achievementRules';

const c: SavedCharacter = {
  name: 'Aelia', level: 3, experience: 0, gold: 0, attributes: resolveAttributes(), inventory: [],
  look: { skin: 0, face: 0, hair: 0, hairColor: 0, beard: 0, helmet: 0, armor: 0, shoulders: 0, greaves: 0, boots: 0, weapon: 'gladius' },
};

describe('achievement rules', () => {
  it('records a won bout once and saves the progress', () => {
    const start = createCombat(1, { position: 4, attributes: { might: 1000 } }, { position: 5 });
    const won = performAction(start, 'normal');
    const first = recordForCareer(c, { type: 'fight', id: 'bout-1', state: won.state, events: won.events });
    expect(first.unlocked.map((b) => b.id)).toEqual(expect.arrayContaining(['first-win', 'perfect-win']));
    expect(first.character.achievements?.counters.wins).toBe(1);
    expect(recordForCareer(first.character, { type: 'fight', id: 'bout-1', state: won.state, events: won.events }).unlocked).toEqual([]);
    expect(deserializeSave(serializeSave(first.character))).toEqual({ ok: true, character: first.character });
    expect(trophyCount(first.character)).toBe(`${first.unlocked.length} / 25`);
  });

  it('unlocks the full set from the equipment and lists every badge', () => {
    const set = { helmet: 2, armor: 2, shoulders: 2, greaves: 2, boots: 2 };
    const { character, unlocked } = recordForCareer(c, equipmentSignal(set));
    expect(unlocked.map((b) => b.id)).toEqual(['full-set']);
    const list = trophyList(character);
    expect(list).toHaveLength(25);
    expect(list.filter((t) => t.earned).map((t) => t.badge.id)).toEqual(['full-set']);
  });

  it('leaves the character untouched when nothing changes', () => {
    expect(recordForCareer(c).character).toBe(c);
  });
});
