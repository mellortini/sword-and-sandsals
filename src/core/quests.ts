/**
 * The tavern (#65), its rules without any screen: rumours, side tasks checked after every bout of the career, and
 * Adi the Odds' bets on bouts between other gladiators, fought out by the combat core and the AI.
 */
import { ENEMY_EPITHETS, ENEMY_NAMES } from '../data/names';
import { chooseAction } from './ai';
import type { AiProfile } from './ai';
import { createCombat, performAction } from './combat';
import { nextRandom } from './rng';
import type { SavedCharacter } from './save';
import type { Attributes, CombatEvent, CombatState, FighterSide } from './types';

// ------------------------------------------------------------------ side tasks

export const QUEST_IDS = ['open-guard', 'crowd-pleaser', 'quick-work'] as const;
export type QuestId = (typeof QUEST_IDS)[number];

/** what a finished career bout looked like, for the tasks */
export interface BoutTally {
  readonly won: boolean;
  readonly usedBlock: boolean;
  /** the crowd's favour for the gladiator when the bout ended */
  readonly favour: number;
  /** actions the gladiator took */
  readonly turns: number;
}

export interface Quest {
  readonly id: QuestId;
  readonly title: string;
  /** who asks, in the tavern */
  readonly giver: string;
  /** the task as the giver says it */
  readonly text: string;
  /** the condition in plain words, for the list */
  readonly goal: string;
  readonly done: (bout: BoutTally) => boolean;
}

export const QUICK_WORK_TURNS = 8;
export const CROWD_PLEASER_FAVOUR = 80;

export const QUESTS: readonly Quest[] = [
  {
    id: 'open-guard', title: 'Open Guard', giver: 'Adi the Odds',
    text: 'They say you hide behind your guard. Win one bout without blocking once and I’ll pay to have been wrong.',
    goal: 'Win a bout without using Block.',
    done: (b) => b.won && !b.usedBlock,
  },
  {
    id: 'crowd-pleaser', title: 'Crowd Pleaser', giver: 'Fabian the Lute',
    text: 'A song needs a crowd on its feet. Have them roaring when the last blow lands and I will write you a verse.',
    goal: `Win a bout with the crowd's favour at ${CROWD_PLEASER_FAVOUR} or more.`,
    done: (b) => b.won && b.favour >= CROWD_PLEASER_FAVOUR,
  },
  {
    id: 'quick-work', title: 'Quick Work', giver: 'A tired lamplighter',
    text: 'My shift starts at dusk and I want to see a bout end before it. Make it quick, gladiator.',
    goal: `Win a bout in ${QUICK_WORK_TURNS} of your own actions or fewer.`,
    done: (b) => b.won && b.turns <= QUICK_WORK_TURNS,
  },
];

export const findQuest = (id: string) => QUESTS.find((q) => q.id === id);
export const isQuestId = (id: unknown): id is QuestId => typeof id === 'string' && QUEST_IDS.some((q) => q === id);

/** Gold for a finished task: more for a stronger gladiator, so it is worth the trouble at every level. */
export function questReward(level: number): number {
  return 40 + 10 * Math.max(1, level);
}

/** The tavern's part of the save: which tasks are taken, done and paid, and how many bets were placed. */
export interface TavernState {
  readonly accepted: readonly QuestId[];
  readonly completed: readonly QuestId[];
  readonly claimed: readonly QuestId[];
  readonly bets: number;
}

export const emptyTavern = (): TavernState => ({ accepted: [], completed: [], claimed: [], bets: 0 });

export type QuestState = 'open' | 'accepted' | 'completed' | 'claimed';

export function questState(character: SavedCharacter, id: QuestId): QuestState {
  const t = character.tavern ?? emptyTavern();
  if (t.claimed.includes(id)) return 'claimed';
  if (t.completed.includes(id)) return 'completed';
  return t.accepted.includes(id) ? 'accepted' : 'open';
}

export function acceptQuest(character: SavedCharacter, id: QuestId): SavedCharacter {
  if (questState(character, id) !== 'open') return character;
  const t = character.tavern ?? emptyTavern();
  return { ...character, tavern: { ...t, accepted: [...t.accepted, id] } };
}

/** Pay a finished task once. */
export function claimQuest(character: SavedCharacter, id: QuestId): { character: SavedCharacter; gold: number } {
  if (questState(character, id) !== 'completed') return { character, gold: 0 };
  const t = character.tavern ?? emptyTavern();
  const gold = questReward(character.level);
  return { character: { ...character, gold: character.gold + gold, tavern: { ...t, claimed: [...t.claimed, id] } }, gold };
}

/** How the gladiator's bout went, from the final state and every event of the bout. */
export function tallyBout(state: CombatState, events: readonly CombatEvent[]): BoutTally {
  let usedBlock = false;
  let turns = 0;
  for (const e of events) {
    if (e.type === 'block' && e.fighter === 'player') usedBlock = true;
    // every turn of the gladiator but the first starts with a `turn` event (a turn lost to a stun or a net has none)
    if (e.type === 'turn' && e.fighter === 'player') turns++;
  }
  // the bout opens on the gladiator's turn with no event for it
  return { won: state.winner === 'player', usedBlock, favour: state.fighters.player.crowd.favour, turns: turns + 1 };
}

/** The accepted tasks a finished bout fulfils are marked done; returns them for a notice. */
export function recordQuestBout(character: SavedCharacter, bout: BoutTally): { character: SavedCharacter; completed: Quest[] } {
  const t = character.tavern;
  if (!t) return { character, completed: [] };
  const completed = QUESTS.filter((q) => questState(character, q.id) === 'accepted' && q.done(bout));
  if (!completed.length) return { character, completed };
  return { character: { ...character, tavern: { ...t, completed: [...t.completed, ...completed.map((q) => q.id)] } }, completed };
}

// ------------------------------------------------------------------ rumours

/**
 * What the tavern talks about ("Seventh Step", docs/SCENARIUSZ.md): the Order and its last Masters, the songs about
 * Fredi, and later the Grey Hand. `wins` = league bouts won (about six a league), `act` = the story's act.
 */
const RUMOURS: readonly { readonly wins: number; readonly act: number; readonly text: string }[] = [
  { wins: 0, act: 0, text: 'They sing that Fredi of Kamionka took a seventh step nobody ever saw. The drunk in the corner says he saw it twice.' },
  { wins: 0, act: 0, text: 'Adi the Odds is giving three to one against the new fighter from the villages. "Trust Adi," he says.' },
  { wins: 0, act: 0, text: 'The harbour watch fished another sword out of the canals. No owner, no blood, a good blade.' },
  { wins: 6, act: 0, text: 'Old Hask has not lost a duel in thirty years. He has not paid for a drink in thirty years either.' },
  { wins: 6, act: 0, text: 'The songs have more verses about the Order of the Seventh Step than the Order has Masters left.' },
  { wins: 12, act: 0, text: 'Ser Corvin Lach bought another fighter’s contract tonight. Eleven champions, he says. Nobody asks where they went.' },
  { wins: 18, act: 0, text: 'A man in a grey hood was asking about old Masters on the quay. He paid in gold and left no name.' },
  { wins: 0, act: 2, text: 'A Master of the Order was found dead in Kragmoor. His scroll of techniques was gone; his purse was not.' },
];

/** Two rumours for today: the ones the gladiator's progress has opened, turning over day by day. */
export function tavernRumours(character: SavedCharacter): string[] {
  const wins = character.leagueWins?.length ?? 0;
  const act = character.story?.act ?? 0;
  const opened = RUMOURS.filter((r) => wins >= r.wins && act >= r.act);
  const day = character.story?.day ?? character.achievements?.completedFightIds.length ?? 0;
  const first = day % opened.length;
  const second = (first + 1 + (Math.floor(day / 2) % Math.max(1, opened.length - 1))) % opened.length;
  return [...new Set([opened[first].text, opened[second].text])];
}

// ------------------------------------------------------------------ bets

export interface BetFighter {
  readonly name: string;
  readonly level: number;
  readonly attributes: Attributes;
  readonly weapon: string;
  readonly profile: AiProfile;
  /** gold back per gold staked when this one wins */
  readonly odds: number;
}

export interface BetCard {
  readonly seed: number;
  readonly fighters: Readonly<Record<FighterSide, BetFighter>>;
}

export const BET_STAKES = [10, 25, 50] as const;

const FAMILIES = ['sword', 'axe', 'spear', 'hammer', 'trident'] as const;

/**
 * Tonight's bout between two other gladiators: the same card until the gladiator bets on it (the save counts bets),
 * so leaving and coming back does not show a new pair. Levels near the gladiator's own, odds from their strength.
 */
export function betCard(character: SavedCharacter): BetCard {
  const bets = character.tavern?.bets ?? 0;
  let rng = (bets * 0x9e3779b1 + character.level * 0x85ebca6b + 0x2545f491) >>> 0;
  const pick = <T>(list: readonly T[]): T => {
    const next = nextRandom(rng);
    rng = next.state;
    return list[Math.floor(next.value * list.length)];
  };
  const fighter = (): Omit<BetFighter, 'odds'> => {
    const level = Math.max(1, character.level + pick([-2, -1, 0, 1, 2]));
    const base = 5 + Math.floor((level - 1) / 4);
    const attributes: Attributes = {
      might: base + pick([0, 1, 2]), agility: base + pick([0, 1, 2]), precision: base + pick([0, 1, 2]), guard: base + pick([0, 1, 2]),
      vitality: base + pick([0, 1, 2]), stamina: base + pick([0, 1, 2]), charm: base, arcana: base,
    };
    const tier = Math.max(1, Math.min(10, Math.ceil(level / 3)));
    return {
      name: `${pick(ENEMY_NAMES)} ${pick(ENEMY_EPITHETS)}`, level, attributes,
      weapon: `${pick(FAMILIES)}${tier}`, profile: pick(['aggressor', 'defender'] as const),
    };
  };
  const a = fighter();
  let b = fighter();
  // the generator draws both in step, so the two often share an epithet: the second takes another one
  const epithet = ENEMY_EPITHETS.find((e) => a.name.endsWith(e))!;
  if (b.name.endsWith(epithet)) {
    const other = ENEMY_EPITHETS[(ENEMY_EPITHETS.indexOf(epithet) + 1 + (b.level % 3)) % ENEMY_EPITHETS.length];
    b = { ...b, name: b.name.slice(0, -epithet.length) + other };
  }
  const strength = (f: Omit<BetFighter, 'odds'>) => Object.values(f.attributes).reduce((s, v) => s + v, 0) + 3 * f.level;
  const share = strength(a) / (strength(a) + strength(b));
  // the house keeps a tenth; odds never under 1.2 so a favourite still pays something
  const odds = (p: number) => Math.max(1.2, Math.round((0.9 / p) * 10) / 10);
  return { seed: rng, fighters: { player: { ...a, odds: odds(share) }, enemy: { ...b, odds: odds(1 - share) } } };
}

/** Fights the card's bout out with the combat core and the AI; the same card always ends the same way. */
export function fightBet(card: BetCard): FighterSide {
  const setup = (f: BetFighter) => ({ name: f.name, level: f.level, attributes: f.attributes, weapon: f.weapon });
  let state = createCombat(card.seed, setup(card.fighters.player), setup(card.fighters.enemy));
  let rng = card.seed ^ 0x5bd1e995;
  for (let i = 0; i < 400 && state.winner === null; i++) {
    const decision = chooseAction(state, card.fighters[state.active].profile, rng);
    rng = decision.rngState;
    const result = performAction(state, decision.action);
    if (!result.ok) break;
    state = result.state;
  }
  // a bout that never ends (both resting forever) goes to the one with more health left
  if (state.winner !== null) return state.winner;
  return state.fighters.player.health >= state.fighters.enemy.health ? 'player' : 'enemy';
}

export type BetResult =
  | { ok: true; character: SavedCharacter; winner: FighterSide; won: boolean; payout: number }
  | { ok: false; character: SavedCharacter; reason: 'insufficient-gold' | 'invalid-stake' };

/** Stake gold on one side of tonight's card; the bout is fought out at once and the next card is a new pair. */
export function placeBet(character: SavedCharacter, side: FighterSide, stake: number): BetResult {
  if (!BET_STAKES.some((s) => s === stake)) return { ok: false, character, reason: 'invalid-stake' };
  if (character.gold < stake) return { ok: false, character, reason: 'insufficient-gold' };
  const card = betCard(character);
  const winner = fightBet(card);
  const won = winner === side;
  const payout = won ? Math.round(stake * card.fighters[side].odds) : 0;
  const t = character.tavern ?? emptyTavern();
  return {
    ok: true, winner, won, payout,
    character: { ...character, gold: character.gold - stake + payout, tavern: { ...t, bets: t.bets + 1 } },
  };
}
