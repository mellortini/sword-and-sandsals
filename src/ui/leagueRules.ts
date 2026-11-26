import type { League } from '../core/leagues';
import type { SavedCharacter } from '../core/save';
import { PULPPORT_BRONZE } from '../data/leagues';
import { DEFAULT_LOOK } from '../rig/PaperRig';
import type { Look } from '../rig/PaperRig';

type Bout = (typeof PULPPORT_BRONZE)[number];

export interface LeagueInfo {
  readonly id: League;
  readonly name: string;
  /** fighters in the order they are met; the last one is the champion. Empty while the league's fighters are unwritten (#58). */
  readonly bouts: readonly Bout[];
}

/** The five leagues of Pulpport in climbing order (#58). Only Bronze has fighters so far; the rest open when the data does. */
export const LEAGUES: readonly LeagueInfo[] = [
  { id: 'bronze', name: 'Bronze', bouts: PULPPORT_BRONZE },
  { id: 'silver', name: 'Silver', bouts: [] },
  { id: 'gold', name: 'Gold', bouts: [] },
  { id: 'champion', name: 'Champion', bouts: [] },
  { id: 'legend', name: 'Legend', bouts: [] },
];

export type BoutState = 'won' | 'next' | 'waiting';
export type LeagueState = 'cleared' | 'open' | 'locked' | 'empty';

export interface LeagueStanding {
  readonly league: LeagueInfo;
  readonly state: LeagueState;
  readonly won: number;
  readonly bouts: readonly { readonly bout: Bout; readonly state: BoutState }[];
}

/**
 * Where the gladiator stands on the ladder: a league is open once the one below is cleared (its champion beaten);
 * inside it the fighters are met in order, so exactly one is next. A league without fighters is "empty".
 */
export function leagueStandings(character: Pick<SavedCharacter, 'leagueWins'>): readonly LeagueStanding[] {
  const wins = new Set(character.leagueWins ?? []);
  let below = true;
  return LEAGUES.map((league) => {
    const won = league.bouts.filter(({ id }) => wins.has(id)).length;
    const cleared = league.bouts.length > 0 && won === league.bouts.length;
    const state: LeagueState = !league.bouts.length ? 'empty' : cleared ? 'cleared' : below ? 'open' : 'locked';
    let nextGiven = false;
    const bouts = league.bouts.map((bout) => {
      const boutState: BoutState = wins.has(bout.id) ? 'won' : state === 'open' && !nextGiven ? 'next' : 'waiting';
      if (boutState === 'next') nextGiven = true;
      return { bout, state: boutState };
    });
    below = below && cleared;
    return { league, state, won, bouts };
  });
}

/** The bout the gladiator should fight now, if any league is open with fighters left. */
export function nextBout(character: Pick<SavedCharacter, 'leagueWins'>): { league: LeagueInfo; bout: Bout } | undefined {
  for (const { league, bouts } of leagueStandings(character)) {
    const next = bouts.find(({ state }) => state === 'next');
    if (next) return { league, bout: next.bout };
  }
  return undefined;
}

/** A bout the gladiator is allowed to fight (the next one or one already won, for a rematch), by id. */
export function findBout(character: Pick<SavedCharacter, 'leagueWins'>, id: string): Bout | undefined {
  for (const { bouts } of leagueStandings(character)) {
    const found = bouts.find(({ bout }) => bout.id === id);
    if (found) return found.state === 'waiting' ? undefined : found.bout;
  }
  return undefined;
}

/** Adds a won bout once. Unknown ids and repeats leave the character as it is. */
export function recordLeagueWin(character: SavedCharacter, boutId: string): SavedCharacter {
  const known = LEAGUES.some(({ bouts }) => bouts.some(({ id }) => id === boutId));
  if (!known || character.leagueWins?.includes(boutId)) return character;
  return { ...character, leagueWins: [...(character.leagueWins ?? []), boutId] };
}

/** The puppet look of a league fighter: its face and hair plus the armour tiers and weapon it fights with. */
export function boutLook(bout: Bout): Look {
  const { equipment } = bout.setup;
  return {
    ...DEFAULT_LOOK, ...bout.appearance,
    helmet: equipment?.helmet ?? 0, armor: equipment?.armor ?? 0, shoulders: equipment?.shoulders ?? 0,
    greaves: equipment?.greaves ?? 0, boots: equipment?.boots ?? 0,
    weapon: equipment?.weapon ?? DEFAULT_LOOK.weapon,
  };
}

/** "Bronze · 2 / 6" for the town card; once every league with fighters is cleared, a line saying so. */
export function ladderNote(character: Pick<SavedCharacter, 'leagueWins'>): string {
  const open = leagueStandings(character).find(({ state }) => state === 'open');
  return open ? `${open.league.name} · ${open.won} / ${open.league.bouts.length}` : 'every league with fighters cleared';
}
