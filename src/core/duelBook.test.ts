import { describe, expect, it } from 'vitest';
import { chooseAction } from './ai';
import { createCombat, performAction } from './combat';
import {
  BOOK_FULL, BOOK_THRESHOLDS, bookEntries, bookOpens, bookValue, isChampionBout, isDuelBookState, leagueBoutValue,
  recordDuelBout, tallyDuel,
} from './duelBook';
import type { DuelBout } from './duelBook';
import type { SavedCharacter } from './save';
import { deserializeSave, serializeSave } from './save';
import { resolveAttributes } from './stats';
import { newStory, setFlag } from './story';
import type { CombatEvent, CombatState } from './types';
import { DUEL_CHALLENGES } from '../data/duelChallenges';

const quiet: DuelBout = {
  won: true, unarmoured: false, steppedBack: true, blocked: true, rested: true, turns: 20, healthLost: 30, healthLeft: 0.5,
  seventhStep: false, netCaught: false, counterLanded: false, headCrit: false, levelGap: 0, technique: false, taunts: 0,
  shieldBroken: false, severed: false, powerFinish: false, favour: 50, champion: false,
};

function hero(): SavedCharacter {
  return {
    name: 'Aelia', level: 1, experience: 0, gold: 0, attributes: resolveAttributes(), inventory: [],
    look: { skin: 0, face: 0, hair: 0, hairColor: 0, beard: 0, helmet: 0, armor: 0, shoulders: 0, greaves: 0, boots: 0, weapon: 'gladius' },
  };
}

/** a whole AI bout, for tallies of real events */
function bout(seed: number): { state: CombatState; events: CombatEvent[] } {
  let state = createCombat(seed, { level: 3, equipment: { weapon: 'spear2' } }, { level: 1 });
  const events: CombatEvent[] = [];
  let rng = seed;
  for (let i = 0; i < 300 && state.winner === null; i++) {
    const d = chooseAction(state, 'aggressor', rng);
    rng = d.rngState;
    const r = performAction(state, d.action);
    events.push(...r.events);
    state = r.state;
  }
  return { state, events };
}

describe('Book of Duels (#293)', () => {
  it('has at least 20 challenges with unique ids, worth 1-5', () => {
    expect(DUEL_CHALLENGES.length).toBeGreaterThanOrEqual(20);
    expect(new Set(DUEL_CHALLENGES.map((c) => c.id)).size).toBe(DUEL_CHALLENGES.length);
    for (const c of DUEL_CHALLENGES) expect(c.value).toBeGreaterThanOrEqual(1), expect(c.value).toBeLessThanOrEqual(5);
  });

  it('signs a won bout’s challenges once, with the day, and nothing for a defeat', () => {
    const c = { ...hero(), story: { ...newStory(), day: 4 } };
    expect(recordDuelBout(c, { ...quiet, won: false, weapon: 'spear' }).added).toEqual([]);
    const first = recordDuelBout(c, { ...quiet, weapon: 'spear', steppedBack: false });
    expect(first.added.map((e) => e.id)).toEqual(['challenge.spear', 'challenge.no-step-back']);
    expect(first.character.duelBook).toEqual({ challenges: [{ id: 'spear', day: 4 }, { id: 'no-step-back', day: 4 }] });
    expect(deserializeSave(serializeSave(first.character))).toEqual({ ok: true, character: first.character });
    // the same again adds nothing
    expect(recordDuelBout(first.character, { ...quiet, weapon: 'spear', steppedBack: false }).added).toEqual([]);
  });

  it('reads league wins, challenges and story entries into one book', () => {
    let c: SavedCharacter = { ...hero(), leagueWins: ['quay-rookie', 'bronze-champion', 'silver-bell', 'quay-rookie'] };
    c = recordDuelBout(c, { ...quiet, weapon: 'axe' }).character;
    c = { ...c, story: setFlag(newStory(), 'book.goat-returned', 2) };
    const entries = bookEntries(c);
    expect(entries.map((e) => e.id)).toEqual(['league.quay-rookie', 'league.bronze-champion', 'league.silver-bell', 'challenge.axe', 'story.goat-returned']);
    expect(entries.map((e) => e.value)).toEqual([1, 2, 2, 2, 2]);
    expect(entries[4].title).toBe('Goat Returned');
    expect(bookValue(entries)).toBe(9);
    expect(bookOpens(c, 'trial.old-hask')).toBe(false);
    expect(bookOpens({ ...c, leagueWins: [...(c.leagueWins ?? []), 'legend-champion'] }, 'trial.old-hask')).toBe(true);
  });

  it('values league bouts by league, champions one more', () => {
    expect(leagueBoutValue('quay-rookie')).toBe(1);
    expect(leagueBoutValue('bronze-champion')).toBe(2);
    expect(leagueBoutValue('legend-champion')).toBe(5);
    expect(leagueBoutValue('nobody')).toBeUndefined();
    expect(isChampionBout('gold-champion')).toBe(true);
    expect(isChampionBout('gold-ink')).toBe(false);
    expect(isChampionBout(undefined)).toBe(false);
  });

  it('opens the trials in order and the Grand Tournament with a full book', () => {
    const values = BOOK_THRESHOLDS.map((t) => t.value);
    expect([...values].sort((a, b) => a - b)).toEqual(values);
    expect(values.at(-1)).toBe(BOOK_FULL);
  });

  it('tallies a real bout from its events', () => {
    for (let seed = 1; seed < 6; seed++) {
      const { state, events } = bout(Math.imul(seed, 0x9e3779b1) >>> 0);
      const tally = tallyDuel(state, events);
      expect(tally.won).toBe(state.winner === 'player');
      expect(tally.weapon).toBe('spear');
      expect(tally.unarmoured).toBe(true);
      expect(tally.levelGap).toBe(-2);
      const lost = state.fighters.player.stats.maxHealth - state.fighters.player.health;
      // healing (a bouquet from the crowd) can only make the health lost count larger than the bar shows
      expect(tally.healthLost).toBeGreaterThanOrEqual(lost);
      expect(tally.turns).toBe(events.filter((e) => e.type === 'turn' && e.fighter === 'player').length + 1);
    }
  });

  it('validates what the save keeps', () => {
    expect(isDuelBookState({ challenges: [{ id: 'axe', day: 3 }] })).toBe(true);
    expect(isDuelBookState({ challenges: [{ id: 'axe' }] })).toBe(false);
    expect(isDuelBookState({})).toBe(false);
  });
});
