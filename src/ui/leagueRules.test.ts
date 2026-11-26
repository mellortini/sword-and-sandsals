import { describe, expect, it } from 'vitest';
import type { SavedCharacter } from '../core/save';
import { PULPPORT_BRONZE } from '../data/leagues';
import { boutLook, findBout, ladderNote, leagueStandings, nextBout, recordLeagueWin } from './leagueRules';

const ids = PULPPORT_BRONZE.map(({ id }) => id);
const hero = (leagueWins?: string[]) => ({ leagueWins } as SavedCharacter);

describe('league ladder', () => {
  it('starts with the first Bronze fighter next and the other leagues empty', () => {
    const [bronze, ...rest] = leagueStandings(hero());
    expect(bronze).toMatchObject({ state: 'open', won: 0 });
    expect(bronze.bouts.map(({ state }) => state)).toEqual(['next', ...ids.slice(1).map(() => 'waiting')]);
    expect(rest.every(({ state }) => state === 'empty')).toBe(true);
    expect(nextBout(hero())?.bout.id).toBe(ids[0]);
  });

  it('moves on in order and clears the league when the champion falls', () => {
    expect(nextBout(hero(ids.slice(0, 2)))?.bout.id).toBe(ids[2]);
    const done = leagueStandings(hero(ids))[0];
    expect(done).toMatchObject({ state: 'cleared', won: ids.length });
    expect(nextBout(hero(ids))).toBeUndefined();
    expect(ladderNote(hero(ids))).toBe('every league with fighters cleared');
    expect(ladderNote(hero(ids.slice(0, 2)))).toBe('Bronze · 2 / 6');
  });

  it('allows the next bout and rematches, not skipping ahead', () => {
    const wins = hero(ids.slice(0, 1));
    expect(findBout(wins, ids[0])?.id).toBe(ids[0]);
    expect(findBout(wins, ids[1])?.id).toBe(ids[1]);
    expect(findBout(wins, ids[3])).toBeUndefined();
    expect(findBout(wins, 'nobody')).toBeUndefined();
  });

  it('records a win once and ignores unknown ids', () => {
    const once = recordLeagueWin({ name: 'x' } as SavedCharacter, ids[0]);
    expect(once.leagueWins).toEqual([ids[0]]);
    expect(recordLeagueWin(once, ids[0])).toBe(once);
    expect(recordLeagueWin(once, 'nobody')).toBe(once);
  });

  it('dresses a fighter in the tiers and weapon of its setup', () => {
    const champion = PULPPORT_BRONZE.at(-1)!;
    expect(boutLook(champion)).toMatchObject({ helmet: 2, armor: 2, boots: 2, weapon: 'sword3', face: champion.appearance.face });
  });
});
