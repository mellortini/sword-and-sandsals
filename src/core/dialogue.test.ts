import { describe, expect, it } from 'vitest';
import { DIALOGUES } from '../data/dialogues';
import { OLD_HASK } from '../data/dialogues/oldHask';
import {
  applyEffects, checkChance, choiceOptions, choose, conditionLabel, dialogueProblems, findNode, meets,
} from './dialogue';
import type { Condition } from './dialogue';
import type { SavedCharacter } from './save';
import { deserializeSave, serializeSave } from './save';
import { changeReputation, flagOf, newStory, setFlag, storyOf } from './story';
import { DEFAULT_LOOK } from '../rig/PaperRig';

const hero = (patch: Partial<SavedCharacter> = {}): SavedCharacter => ({
  name: 'Blank', level: 3, experience: 0, gold: 20, inventory: ['armor1'], look: DEFAULT_LOOK,
  attributes: { might: 5, agility: 5, precision: 7, guard: 5, vitality: 5, stamina: 5, charm: 8, arcana: 5 },
  ...patch,
});

describe('dialogue conditions (#292)', () => {
  it('reads attributes, reputation, flags, gold, items and wards', () => {
    const story = changeReputation(setFlag(setFlag(newStory(), 'd1', 'hammer'), 'ward.sorrel'), { order: 25 });
    const c = hero({ story, hands: { weapon: 'sword2' } });
    const cases: [Condition, boolean][] = [
      [{ kind: 'attribute', attribute: 'charm', min: 8 }, true],
      [{ kind: 'attribute', attribute: 'charm', min: 9 }, false],
      [{ kind: 'reputation', axis: 'order', min: 20 }, true],
      [{ kind: 'reputation', axis: 'order', max: 20 }, false],
      [{ kind: 'flag', flag: 'd1', equals: 'hammer' }, true],
      [{ kind: 'flag', flag: 'd1', equals: 'sword' }, false],
      [{ kind: 'flag', flag: 'd2' }, false],
      [{ kind: 'noFlag', flag: 'd2' }, true],
      [{ kind: 'gold', min: 20 }, true],
      [{ kind: 'gold', min: 21 }, false],
      [{ kind: 'item', item: 'sword2', name: 'a sword' }, true],
      [{ kind: 'item', item: 'armor9', name: 'gilded armour' }, false],
      [{ kind: 'ward', ward: 'sorrel', name: 'Sorrel' }, true],
      [{ kind: 'ward', ward: 'stub', name: 'Stub' }, false],
    ];
    for (const [condition, expected] of cases) expect(meets(c, condition), JSON.stringify(condition)).toBe(expected);
  });

  it('labels requirements as the script writes them', () => {
    expect(conditionLabel({ kind: 'attribute', attribute: 'charm', min: 8 })).toBe('Charm 8');
    expect(conditionLabel({ kind: 'reputation', axis: 'order', min: 20 })).toBe('Order ≥ 20');
    expect(conditionLabel({ kind: 'ward', ward: 'sorrel', name: 'Sorrel' })).toBe('Sorrel in ludus');
  });

  it('turns a check into a visible chance from 5 to 95%', () => {
    const c = hero();
    expect(checkChance(c, { attribute: 'precision', difficulty: 7 })).toBe(50);
    expect(checkChance(c, { attribute: 'charm', difficulty: 6 })).toBe(66);
    expect(checkChance(c, { attribute: 'might', difficulty: 30 })).toBe(5);
    expect(checkChance(c, { attribute: 'might', difficulty: -30 })).toBe(95);
  });
});

describe('dialogue effects (#292)', () => {
  it('sets flags and reputation, pays gold, gives items, recruits, loyalty and book entries', () => {
    const after = applyEffects(hero(), [
      { kind: 'flag', flag: 'd3', value: 'report' },
      { kind: 'reputation', changes: { guild: 10, underworld: -5 } },
      { kind: 'gold', amount: -50 },
      { kind: 'item', item: 'staples' },
      { kind: 'recruit', ward: 'stub' },
      { kind: 'loyalty', ward: 'stub', amount: 3 },
      { kind: 'loyalty', ward: 'stub', amount: 2 },
      { kind: 'duelBook', entry: 'hask', value: 2 },
    ]);
    const story = storyOf(after);
    expect(flagOf(story, 'd3')).toBe('report');
    expect(story.reputation).toMatchObject({ guild: 10, underworld: -5 });
    expect(after.gold).toBe(0);
    expect(after.inventory).toEqual(['armor1', 'staples']);
    expect(flagOf(story, 'ward.stub')).toBe(true);
    expect(flagOf(story, 'loyalty.stub')).toBe(5);
    expect(flagOf(story, 'book.hask')).toBe(2);
    // the save keeps all of it
    const loaded = deserializeSave(serializeSave(after));
    expect(loaded.ok && storyOf(loaded.character).flags).toEqual(story.flags);
  });

  it('changes nothing without effects', () => {
    const c = hero();
    expect(applyEffects(c, [])).toBe(c);
  });
});

describe('Old Hask, the sample dialogue (#292)', () => {
  it('has whole data, like every dialogue', () => {
    for (const d of Object.values(DIALOGUES)) expect(dialogueProblems(d), d.id).toEqual([]);
    expect(dialogueProblems({ id: 'x', start: 'a', nodes: [{ id: 'a', speaker: 'A', lines: ['hi'], next: 'b' }] })).toEqual(['a leads to missing b']);
  });

  it('offers its choices with tags, greys out what is not met', () => {
    const options = choiceOptions(hero(), findNode(OLD_HASK, OLD_HASK.start)!);
    expect(options.length).toBeGreaterThanOrEqual(3);
    expect(options.map((o) => [o.available, o.tag])).toEqual([
      [true, undefined],
      [true, '[Precision 50%]'],
      [true, '[5 gold]'],
      [false, '[Order ≥ 20]'],
    ]);
    expect(options[3].unmet).toEqual(['Order ≥ 20']);
    expect(choiceOptions(hero({ gold: 4 }), findNode(OLD_HASK, 'offer')!)[2].available).toBe(false);
  });

  it('accepts the deal, or wins and loses the check with different outcomes', () => {
    const deal = choose(hero(), OLD_HASK, 'offer', 0, 0.99);
    expect(deal.ok && [deal.next, flagOf(storyOf(deal.character), 'hask.trial')]).toEqual(['deal', 'accepted']);

    const shown = choose(hero(), OLD_HASK, 'offer', 1, 0.2);
    expect(shown).toMatchObject({ ok: true, success: true, chance: 50, next: 'shown' });
    expect(shown.ok && flagOf(storyOf(shown.character), 'hask.trial')).toBe('shown');

    const spilled = choose(hero(), OLD_HASK, 'offer', 1, 0.7);
    expect(spilled).toMatchObject({ ok: true, success: false, next: 'spilled' });
    expect(spilled.ok && flagOf(storyOf(spilled.character), 'hask.trial')).toBe('accepted');
  });

  it('buys one round, then the offer comes back without it', () => {
    const round = choose(hero(), OLD_HASK, 'offer', 2, 0);
    if (!round.ok) throw new Error('round refused');
    expect(round.character.gold).toBe(15);
    expect(round.next).toBe('round');
    expect(findNode(OLD_HASK, 'round')!.next).toBe('offer');
    expect(choiceOptions(round.character, findNode(OLD_HASK, 'offer')!)[2].available).toBe(false);
    expect(choose(round.character, OLD_HASK, 'offer', 2, 0)).toMatchObject({ ok: false, reason: 'unavailable' });
  });

  it('refuses a choice that is not met or not there', () => {
    expect(choose(hero(), OLD_HASK, 'offer', 3, 0)).toMatchObject({ ok: false, reason: 'unavailable' });
    expect(choose(hero(), OLD_HASK, 'offer', 9, 0)).toMatchObject({ ok: false, reason: 'unknown-choice' });
    expect(choose(hero(), OLD_HASK, 'nowhere', 0, 0)).toMatchObject({ ok: false, reason: 'unknown-node' });
    const ordered = hero({ story: changeReputation(newStory(), { order: 20 }) });
    expect(choose(ordered, OLD_HASK, 'offer', 3, 0)).toMatchObject({ ok: true, next: 'order' });
  });
});
