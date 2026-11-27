import type { SavedCharacter } from '../core/save';
import { resolveAttributes } from '../core/stats';
import type { Attributes } from '../core/types';
import { DEFAULT_LOOK } from '../rig/PaperRig';
import type { Look } from '../rig/PaperRig';

/** Every attribute starts here and cannot be lowered below it in the creator. */
export const ATTRIBUTE_BASE = 5;
/** Creator cap for one attribute, so the start stays balanced. */
export const ATTRIBUTE_MAX = 12;
/** Free points to spread at character creation (GDD: 5 more per level later). */
export const STARTING_POINTS = 10;
/** Placeholder purse until the economy (#32) sets it. */
export const STARTING_GOLD = 50;
export const NAME_MAX = 20;

export type AttributeKey = keyof Attributes;

/** Order, label and one-line meaning (from docs/GDD.md) of the eight attributes. */
export const ATTRIBUTE_INFO: readonly { key: AttributeKey; label: string; hint: string }[] = [
  { key: 'might', label: 'Might', hint: 'Damage, heavy weapons and height' },
  { key: 'agility', label: 'Agility', hint: 'Jump length and dodging' },
  { key: 'precision', label: 'Precision', hint: 'Hit chance and critical hits' },
  { key: 'guard', label: 'Guard', hint: 'Blocking and damage reduction' },
  { key: 'vitality', label: 'Vitality', hint: 'Maximum health' },
  { key: 'stamina', label: 'Stamina', hint: 'Maximum energy and rest' },
  { key: 'charm', label: 'Charm', hint: 'Prices, crowd favour, taunts' },
  { key: 'arcana', label: 'Arcana', hint: 'Spells and enchanted weapons' },
];

export interface PointSpread {
  readonly attributes: Readonly<Attributes>;
  /** points still to spend */
  readonly free: number;
}

export function startSpread(): PointSpread {
  return { attributes: resolveAttributes(), free: STARTING_POINTS };
}

export const canRaise = (s: PointSpread, key: AttributeKey) => s.free > 0 && s.attributes[key] < ATTRIBUTE_MAX;
export const canLower = (s: PointSpread, key: AttributeKey) => s.attributes[key] > ATTRIBUTE_BASE;

/** One point into `key`; unchanged when it cannot be raised. */
export function raise(s: PointSpread, key: AttributeKey): PointSpread {
  if (!canRaise(s, key)) return s;
  return { attributes: { ...s.attributes, [key]: s.attributes[key] + 1 }, free: s.free - 1 };
}

/** One point back from `key`; unchanged at the base value. */
export function lower(s: PointSpread, key: AttributeKey): PointSpread {
  if (!canLower(s, key)) return s;
  return { attributes: { ...s.attributes, [key]: s.attributes[key] - 1 }, free: s.free + 1 };
}

/** Spends every free point at random (the creator's Random button). `random` returns [0, 1). */
export function randomSpread(random: () => number = Math.random): PointSpread {
  let s = startSpread();
  while (s.free > 0) {
    const open = ATTRIBUTE_INFO.filter(({ key }) => canRaise(s, key));
    s = raise(s, open[Math.floor(random() * open.length)].key);
  }
  return s;
}

/** Trimmed name with inner spaces collapsed, letters composed (NFC: `ą` typed as `a` + ogonek counts as one letter). */
export const cleanName = (name: string) => name.normalize('NFC').trim().replace(/\s+/g, ' ');

/** Why the name cannot be used, or null when it is fine. Letters (any script), spaces, apostrophes and hyphens. */
export function nameProblem(name: string): string | null {
  const n = cleanName(name);
  if (n.length === 0) return 'Give your gladiator a name.';
  if (n.length > NAME_MAX) return `At most ${NAME_MAX} characters.`;
  if (!/^[\p{L}][\p{L}' -]*$/u.test(n)) return 'Letters, spaces, apostrophes and hyphens only.';
  return null;
}

/** Appearance parts the creator changes; armour and weapon start empty / default. */
export type Appearance = Pick<Look, 'skin' | 'face' | 'hair' | 'hairColor' | 'beard'> & Pick<Look, 'build'>;

/** A level 1 gladiator in a loincloth, ready for saveGame. Throws when the draft is not finished. */
export function newCharacter(name: string, appearance: Appearance, spread: PointSpread): SavedCharacter {
  const problem = nameProblem(name);
  if (problem) throw new RangeError(problem);
  if (spread.free !== 0) throw new RangeError('Spend every attribute point first.');
  const look: Look = {
    ...DEFAULT_LOOK, ...appearance,
    helmet: 0, armor: 0, shoulders: 0, greaves: 0, boots: 0,
  };
  return {
    name: cleanName(name), level: 1, experience: 0, gold: STARTING_GOLD,
    attributes: { ...spread.attributes }, look, inventory: [],
  };
}
