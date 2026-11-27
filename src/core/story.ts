/**
 * Stan fabuły „Siódmy Krok” (#291, docs/SCENARIUSZ.md): akt, flagi decyzji, cztery osie reputacji i licznik dni.
 * Zapisy sprzed fabuły nie mają pola `story`; `storyOf` daje im stan początkowy, więc wersja zapisu się nie zmienia.
 */
import { FIRST_DAY, dayAfter } from './calendar';
import type { TimedActivity } from './calendar';
import type { SavedCharacter } from './save';

/** 0 to prolog w Kamionce, 1–4 to akty. */
export const FIRST_ACT = 0;
export const LAST_ACT = 4;

/** fame = Sława, order = Zakon, guild = Gildia Lanistów, underworld = Półświatek. */
export const REPUTATION_AXES = ['fame', 'order', 'guild', 'underworld'] as const;
export type ReputationAxis = (typeof REPUTATION_AXES)[number];
export type Reputation = Readonly<Record<ReputationAxis, number>>;
export const REPUTATION_MIN = -100;
export const REPUTATION_MAX = 100;

/** `true` dla „to się stało”, tekst dla wybranej opcji (np. d1: 'hammer'), liczba dla liczników. */
export type FlagValue = boolean | number | string;
export const MAX_FLAGS = 500;

export interface StoryState {
  readonly act: number;
  readonly day: number;
  readonly flags: Readonly<Record<string, FlagValue>>;
  readonly reputation: Reputation;
}

export function newStory(): StoryState {
  return { act: FIRST_ACT, day: FIRST_DAY, flags: {}, reputation: { fame: 0, order: 0, guild: 0, underworld: 0 } };
}

export function storyOf(character: Pick<SavedCharacter, 'story'>): StoryState {
  return character.story ?? newStory();
}

const isFlagValue = (value: unknown): value is FlagValue =>
  typeof value === 'boolean' || typeof value === 'string' || (typeof value === 'number' && Number.isSafeInteger(value));

export function setFlag(story: StoryState, flag: string, value: FlagValue = true): StoryState {
  if (!flag.trim() || !isFlagValue(value)) throw new RangeError('A story flag needs a name and a simple value.');
  if (!Object.hasOwn(story.flags, flag) && Object.keys(story.flags).length >= MAX_FLAGS) {
    throw new RangeError('Too many story flags.');
  }
  return { ...story, flags: { ...story.flags, [flag]: value } };
}

export function flagOf(story: StoryState, flag: string): FlagValue | undefined {
  return Object.hasOwn(story.flags, flag) ? story.flags[flag] : undefined;
}

/** Dodaje (albo odejmuje) punkty na podanych osiach; wynik zostaje w −100…+100. */
export function changeReputation(story: StoryState, changes: Partial<Reputation>): StoryState {
  const reputation = { ...story.reputation };
  for (const axis of REPUTATION_AXES) {
    const change = changes[axis] ?? 0;
    if (!Number.isSafeInteger(change)) throw new RangeError('Reputation changes must be whole numbers.');
    reputation[axis] = Math.max(REPUTATION_MIN, Math.min(REPUTATION_MAX, reputation[axis] + change));
  }
  return { ...story, reputation };
}

/** Akty idą tylko do przodu. */
export function enterAct(story: StoryState, act: number): StoryState {
  if (!Number.isInteger(act) || act < story.act || act > LAST_ACT) {
    throw new RangeError(`The story can move from act ${story.act} only forward, up to act ${LAST_ACT}.`);
  }
  return { ...story, act };
}

/** Postać po czynności, która zabiera czas. */
export function passTime(character: SavedCharacter, activity: TimedActivity, days?: number): SavedCharacter {
  const story = storyOf(character);
  return { ...character, story: { ...story, day: dayAfter(story.day, activity, days) } };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const within = (value: unknown, min: number, max: number) =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max;

export function isStoryState(value: unknown): value is StoryState {
  if (!isRecord(value) || !isRecord(value.flags) || !isRecord(value.reputation)) return false;
  const { act, day, flags, reputation } = value;
  const entries = Object.entries(flags);
  return within(act, FIRST_ACT, LAST_ACT) && within(day, FIRST_DAY, Number.MAX_SAFE_INTEGER)
    && entries.length <= MAX_FLAGS && entries.every(([flag, v]) => flag.trim().length > 0 && isFlagValue(v))
    && REPUTATION_AXES.every((axis) => within(reputation[axis], REPUTATION_MIN, REPUTATION_MAX));
}
