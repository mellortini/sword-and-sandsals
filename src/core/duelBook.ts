/**
 * The Book of Duels (#293, docs/SCENARIUSZ.md 5.1): the main count of the hero's progress. Entries are witnessed and
 * signed after a bout: every league bout won, and the challenges (`data/duelChallenges.ts`), each once. Entries are
 * worth 1-5; the book's value opens the Masters' trials (#296) and, at 100, the Grand Tournament.
 *
 * League entries are read from `leagueWins` and dialogue entries from the story flags (`book.<entry>`, #292), so only
 * the challenges are kept in the save (`duelBook`). Pure functions: the arena calls `recordDuelBout` after a bout.
 */
import { DUEL_CHALLENGES, findChallenge } from '../data/duelChallenges';
import { PULPPORT_LEAGUES } from '../data/leagues';
import type { SavedCharacter } from './save';
import { storyOf } from './story';
import { TECHNIQUES } from './techniques';
import type { CombatEvent, CombatState } from './types';
import type { CombatWeapon } from './weapons';

/** a full book */
export const BOOK_FULL = 100;

export interface DuelEntry {
  readonly id: string;
  readonly title: string;
  readonly value: number;
  /** the day it was signed (story calendar, #291); undefined for wins from before the book */
  readonly day?: number;
  readonly witness: string;
  readonly by: 'player' | 'school';
}

/** what the save keeps: the challenges met, with the day each was signed */
export interface DuelBookState {
  readonly challenges: readonly { readonly id: string; readonly day: number }[];
}

/** what the book needs to know about a finished bout of the gladiator */
export interface DuelBout {
  readonly won: boolean;
  readonly weapon?: CombatWeapon['family'];
  /** no armour at all on the gladiator */
  readonly unarmoured: boolean;
  readonly steppedBack: boolean;
  readonly blocked: boolean;
  readonly rested: boolean;
  /** the gladiator's actions */
  readonly turns: number;
  readonly healthLost: number;
  /** health left over maximum health, 0-1 */
  readonly healthLeft: number;
  readonly seventhStep: boolean;
  readonly netCaught: boolean;
  readonly counterLanded: boolean;
  readonly headCrit: boolean;
  /** the opponent's level minus the gladiator's */
  readonly levelGap: number;
  readonly technique: boolean;
  readonly taunts: number;
  /** the gladiator's own shield broke */
  readonly shieldBroken: boolean;
  /** the gladiator took off the opponent's shield arm */
  readonly severed: boolean;
  /** the bout ended with the gladiator's power blow */
  readonly powerFinish: boolean;
  /** the crowd's favour at the end */
  readonly favour: number;
  /** the opponent was a league champion */
  readonly champion: boolean;
}

/** How the gladiator's bout went, from its final state and every event. `champion`: the opponent was a champion. */
export function tallyDuel(state: CombatState, events: readonly CombatEvent[], champion = false): DuelBout {
  const me = state.fighters.player;
  const foe = state.fighters.enemy;
  let steppedBack = false, blocked = false, rested = false, seventhStep = false, netCaught = false;
  let counterLanded = false, headCrit = false, technique = false, severed = false, shieldBroken = false;
  let turns = 1, taunts = 0, healthLost = 0;
  let lastBlow: Extract<CombatEvent, { type: 'attack' }> | undefined;
  for (const e of events) {
    switch (e.type) {
      case 'move': if (e.fighter === 'player' && e.kind === 'step_back') steppedBack = true; break;
      case 'block': if (e.fighter === 'player') blocked = true; break;
      case 'rest': if (e.fighter === 'player') rested = true; break;
      case 'turn': if (e.fighter === 'player') turns++; break;
      case 'taunt': if (e.actor === 'player') taunts++; break;
      case 'net': if (e.actor === 'player' && e.hit) netCaught = true; break;
      // a blow on the Seventh Step spends it (#294): the Rhythm drops from 100 to 0
      case 'rhythm': if (e.fighter === 'player' && e.from >= 100 && e.to === 0) seventhStep = true; break;
      case 'technique': if (e.fighter === 'player' && (TECHNIQUES as readonly string[]).includes(e.technique)) technique = true; break;
      case 'status': if (e.fighter === 'player' && e.healthDelta < 0) healthLost -= e.healthDelta; break;
      case 'attack':
        if (e.actor === 'player') {
          lastBlow = e;
          if (e.counter && e.damage > 0) counterLanded = true;
          if (e.zone === 'head' && e.crit) headCrit = true;
          if (e.severed) severed = true;
        } else {
          healthLost += e.damage;
          if (e.shield?.to === 0) shieldBroken = true;
        }
        break;
      case 'elemental': if (e.target === 'player') healthLost += e.damage; break;
    }
  }
  const zones = me.armourByZone;
  return {
    won: state.winner === 'player',
    weapon: me.weapon?.family,
    unarmoured: zones.head + zones.torso + zones.legs === 0,
    steppedBack, blocked, rested, turns, healthLost,
    healthLeft: me.health / me.stats.maxHealth,
    seventhStep, netCaught, counterLanded, headCrit,
    levelGap: foe.level - me.level,
    technique, taunts, shieldBroken, severed,
    powerFinish: state.winner === 'player' && lastBlow?.kind === 'power' && lastBlow.damage > 0,
    favour: me.crowd.favour,
    champion,
  };
}

/** a league bout's worth: bronze 1 … legend 5, a champion one more (at most 5) */
export function leagueBoutValue(boutId: string): number | undefined {
  const leagues = Object.values(PULPPORT_LEAGUES);
  for (let i = 0; i < leagues.length; i++) {
    const bout = leagues[i].find((b) => b.id === boutId);
    if (bout) return Math.min(5, i + 1 + (bout.champion ? 1 : 0));
  }
  return undefined;
}

/** is this league bout a champion's (`undefined` = not a league bout) */
export const isChampionBout = (boutId: string | undefined) =>
  boutId !== undefined && Object.values(PULPPORT_LEAGUES).some((league) => league.some((b) => b.id === boutId && b.champion !== undefined));

const leagueBoutName = (boutId: string) => Object.values(PULPPORT_LEAGUES).flat().find((b) => b.id === boutId)?.name;

/** Every entry of the book in the order they were written: league wins, challenges, then entries from the story. */
export function bookEntries(character: Pick<SavedCharacter, 'leagueWins' | 'duelBook' | 'story'>): DuelEntry[] {
  const entries: DuelEntry[] = [];
  for (const id of new Set(character.leagueWins ?? [])) {
    const value = leagueBoutValue(id);
    if (value !== undefined) entries.push({ id: `league.${id}`, title: `Beat ${leagueBoutName(id)}`, value, witness: 'Łukasz the Herald', by: 'player' });
  }
  for (const { id, day } of character.duelBook?.challenges ?? []) {
    const challenge = findChallenge(id);
    if (challenge) entries.push({ id: `challenge.${id}`, title: challenge.title, value: challenge.value, day, witness: challenge.witness, by: 'player' });
  }
  // entries a dialogue wrote (#292): flag `book.<entry>` = its value
  for (const [flag, value] of Object.entries(storyOf(character).flags)) {
    if (!flag.startsWith('book.') || typeof value !== 'number' || value <= 0) continue;
    const id = flag.slice('book.'.length);
    entries.push({ id: `story.${id}`, title: storyEntryTitle(id), value: Math.min(5, Math.round(value)), witness: 'Magpie', by: 'player' });
  }
  return entries;
}

const storyEntryTitle = (id: string) => id.split(/[-_.]/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');

/** the book's value (a full book is `BOOK_FULL`; more is still counted) */
export const bookValue = (entries: readonly DuelEntry[]) => entries.reduce((sum, e) => sum + e.value, 0);

/** what a value opens, in order: the Masters' trials (#296), then the Grand Tournament */
export const BOOK_THRESHOLDS: readonly { readonly id: string; readonly name: string; readonly value: number }[] = [
  { id: 'trial.old-hask', name: 'Old Hask’s trial', value: 10 },
  { id: 'trial.brann', name: 'Brann the Anvil’s trial', value: 30 },
  { id: 'trial.sefa', name: 'Sefa of the Dunes’ trial', value: 50 },
  { id: 'trial.kindler', name: 'The Kindler’s trial', value: 70 },
  { id: 'grand-tournament', name: 'The Grand Tournament', value: BOOK_FULL },
];

/** has the book reached the value that opens `id` (a `BOOK_THRESHOLDS` id)? */
export function bookOpens(character: Pick<SavedCharacter, 'leagueWins' | 'duelBook' | 'story'>, id: string): boolean {
  const threshold = BOOK_THRESHOLDS.find((t) => t.id === id);
  return threshold !== undefined && bookValue(bookEntries(character)) >= threshold.value;
}

/**
 * Signs the challenges a finished bout meets and that are not yet in the book. Only won bouts count.
 * Returns the character with the new entries and those entries, for a notice.
 */
export function recordDuelBout(character: SavedCharacter, bout: DuelBout): { character: SavedCharacter; added: DuelEntry[] } {
  if (!bout.won) return { character, added: [] };
  const book = character.duelBook ?? { challenges: [] };
  const have = new Set(book.challenges.map((c) => c.id));
  const met = DUEL_CHALLENGES.filter((c) => !have.has(c.id) && c.met(bout));
  if (!met.length) return { character, added: [] };
  const day = storyOf(character).day;
  const challenges = [...book.challenges, ...met.map((c) => ({ id: c.id, day }))];
  return {
    character: { ...character, duelBook: { challenges } },
    added: met.map((c) => ({ id: `challenge.${c.id}`, title: c.title, value: c.value, day, witness: c.witness, by: 'player' as const })),
  };
}

export function isDuelBookState(value: unknown): value is DuelBookState {
  if (typeof value !== 'object' || value === null) return false;
  const { challenges } = value as { challenges?: unknown };
  return Array.isArray(challenges) && challenges.length <= 500 && challenges.every((c: unknown) =>
    typeof c === 'object' && c !== null
    && typeof (c as { id?: unknown }).id === 'string'
    && Number.isSafeInteger((c as { day?: unknown }).day));
}
