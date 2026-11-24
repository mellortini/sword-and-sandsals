import { MAX_LEVEL, awardExperience, experienceForLevel } from '../core/progression';
import type { SavedCharacter } from '../core/save';
import type { Attributes } from '../core/types';
import type { AttributeKey } from './creatorRules';

/** Where a character stands inside its current level, for the XP bar. */
export interface XpStanding {
  readonly level: number;
  /** XP gathered since the current level began */
  readonly into: number;
  /** XP the current level needs in total; 0 at the top level */
  readonly span: number;
  /** 0..1 along the bar (1 at the top level) */
  readonly fraction: number;
}

export function xpStanding(level: number, experience: number): XpStanding {
  if (level >= MAX_LEVEL) return { level: MAX_LEVEL, into: 0, span: 0, fraction: 1 };
  const floor = experienceForLevel(level);
  const span = experienceForLevel(level + 1) - floor;
  const into = Math.min(span, Math.max(0, experience - floor));
  return { level, into, span, fraction: into / span };
}

/** One sweep of the bar: within `level`, from one fraction to another. A level-up ends its sweep at 1. */
export interface XpSweep {
  readonly level: number;
  readonly from: number;
  readonly to: number;
  /** the sweep fills the bar and the next level starts */
  readonly levelUp: boolean;
}

/** The bar's animation from the old standing to the new one: one sweep per level crossed, then the remainder. */
export function xpSweeps(before: { level: number; experience: number }, after: { level: number; experience: number }): XpSweep[] {
  const start = xpStanding(before.level, before.experience);
  const end = xpStanding(after.level, after.experience);
  const sweeps: XpSweep[] = [];
  let from = start.fraction;
  for (let level = before.level; level < after.level; level++) {
    sweeps.push({ level, from, to: 1, levelUp: true });
    from = 0;
  }
  if (end.fraction !== from || sweeps.length === 0) sweeps.push({ level: after.level, from, to: end.fraction, levelUp: false });
  return sweeps;
}

/** What one won fight did to the saved gladiator. */
export interface FightProgress {
  readonly earned: number;
  readonly before: SavedCharacter;
  readonly after: SavedCharacter;
}

/** Adds the fight's XP (CombatState.rewards.experience) to the saved gladiator; levels and points come from the core. */
export function applyFightExperience(character: SavedCharacter, earned: number): FightProgress {
  const progress = awardExperience(character, Math.max(0, Math.floor(earned)));
  return { earned, before: character, after: { ...character, ...progress } };
}

export const levelsGained = (p: FightProgress) => p.after.level - p.before.level;

/** Attribute points being placed on the level-up screen; nothing is kept until `commitPoints`. */
export interface PointDraft {
  /** the attributes before this visit, the floor for every row */
  readonly base: Readonly<Attributes>;
  readonly attributes: Readonly<Attributes>;
  readonly free: number;
}

export function startDraft(character: SavedCharacter): PointDraft {
  return { base: character.attributes, attributes: character.attributes, free: character.attributePoints ?? 0 };
}

export const canAdd = (d: PointDraft, _key: AttributeKey) => d.free > 0;
export const canTakeBack = (d: PointDraft, key: AttributeKey) => d.attributes[key] > d.base[key];

export function addPoint(d: PointDraft, key: AttributeKey): PointDraft {
  if (!canAdd(d, key)) return d;
  return { ...d, attributes: { ...d.attributes, [key]: d.attributes[key] + 1 }, free: d.free - 1 };
}

export function takeBackPoint(d: PointDraft, key: AttributeKey): PointDraft {
  if (!canTakeBack(d, key)) return d;
  return { ...d, attributes: { ...d.attributes, [key]: d.attributes[key] - 1 }, free: d.free + 1 };
}

/** points placed in this visit */
export const placedPoints = (d: PointDraft) => (Object.keys(d.base) as AttributeKey[])
  .reduce((sum, key) => sum + d.attributes[key] - d.base[key], 0);

/** The character with the placed points kept; unplaced points stay for later. */
export function commitPoints(character: SavedCharacter, d: PointDraft): SavedCharacter {
  return { ...character, attributes: { ...d.attributes }, attributePoints: d.free };
}
