import { describe, expect, it } from 'vitest';
import { dayAfter } from './calendar';
import { deserializeSave, serializeSave } from './save';
import type { SavedCharacter } from './save';
import { changeReputation, enterAct, flagOf, newStory, passTime, setFlag, storyOf } from './story';

const oldCharacter: SavedCharacter = {
  name: 'Varro', level: 1, experience: 0, gold: 50, inventory: [],
  attributes: { might: 5, agility: 5, precision: 5, guard: 5, vitality: 5, stamina: 5, charm: 5, arcana: 5 },
  look: { skin: 0, face: 0, hair: 0, hairColor: 0, beard: 0, helmet: 0, armor: 0, shoulders: 0, greaves: 0, boots: 0, weapon: 'gladius' },
};

describe('calendar', () => {
  it('takes the shortest time unless told otherwise', () => {
    expect(dayAfter(1, 'fight')).toBe(2);
    expect(dayAfter(1, 'rest')).toBe(2);
    expect(dayAfter(1, 'dungeon', 2)).toBe(3);
    expect(dayAfter(1, 'travel')).toBe(3);
    expect(dayAfter(1, 'travel', 3)).toBe(4);
  });

  it('rejects a length the activity cannot take', () => {
    expect(() => dayAfter(1, 'fight', 2)).toThrow(RangeError);
    expect(() => dayAfter(1, 'travel', 1)).toThrow(RangeError);
    expect(() => dayAfter(0, 'rest')).toThrow(RangeError);
  });
});

describe('story state', () => {
  it('gives a save from before the story the opening state', () => {
    const loaded = deserializeSave(serializeSave(oldCharacter));
    expect(loaded.ok && loaded.character.story).toBeUndefined();
    expect(storyOf(oldCharacter)).toEqual(newStory());
  });

  it('survives saving and loading', () => {
    let story = setFlag(newStory(), 'd1', 'hammer');
    story = setFlag(story, 'goat_sold');
    story = changeReputation(enterAct(story, 2), { fame: 5, underworld: -10 });
    const character = passTime(passTime({ ...oldCharacter, story }, 'fight'), 'travel', 3);
    const loaded = deserializeSave(serializeSave(character));
    expect(loaded.ok && loaded.character.story).toEqual({
      act: 2, day: 5, flags: { d1: 'hammer', goat_sold: true },
      reputation: { fame: 5, order: 0, guild: 0, underworld: -10 },
    });
  });

  it('keeps reputation between -100 and 100', () => {
    const story = changeReputation(newStory(), { fame: 250, order: -250 });
    expect(story.reputation).toEqual({ fame: 100, order: -100, guild: 0, underworld: 0 });
  });

  it('leaves the given state unchanged', () => {
    const story = newStory();
    setFlag(story, 'a');
    changeReputation(story, { guild: 3 });
    passTime({ ...oldCharacter, story }, 'rest');
    expect(story).toEqual(newStory());
  });

  it('reads only its own flags and moves only forward', () => {
    expect(flagOf(newStory(), 'toString')).toBeUndefined();
    expect(() => enterAct(enterAct(newStory(), 2), 1)).toThrow(RangeError);
    expect(() => enterAct(newStory(), 5)).toThrow(RangeError);
    expect(() => setFlag(newStory(), ' ')).toThrow(RangeError);
  });

  it('refuses a save with a broken story', () => {
    const broken = [
      { ...newStory(), act: 9 },
      { ...newStory(), day: 0 },
      { ...newStory(), flags: { a: null } },
      { ...newStory(), reputation: { fame: 101, order: 0, guild: 0, underworld: 0 } },
    ];
    for (const story of broken) {
      const json = JSON.stringify({ version: 1, character: { ...oldCharacter, story } });
      expect(deserializeSave(json)).toEqual({ ok: false, reason: 'invalid' });
    }
  });
});
