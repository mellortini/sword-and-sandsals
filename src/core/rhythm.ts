/**
 * Rhythm and the Seventh Step (#294). Every fighter has a Rhythm from 0 to 100: good decisions raise it, repeating
 * the same action and taking critical blows lower it. At 100 the fighter stands on the Seventh Step: the next attack
 * cannot miss (it can still be blocked). Using it starts the count again from 0.
 * The rules here are pure; `core/combat.ts` applies them after every action.
 */
import type { CombatAction } from './types';

export const RHYTHM_MAX = 100;
/** the HUD draws the Rhythm as this many footprints */
export const RHYTHM_STEPS = 7;

/** points per decision; tuned with tools/balance.ts (docs/BALANS.md) */
export const RHYTHM_GAIN = {
  /** an action other than the one before it */
  variety: 5,
  /** the same action as the one before it */
  repeat: -10,
  /** a free counter-attack taken after a good block */
  counter: 20,
  /** a step or a jump that changed the distance */
  distance: 6,
  /** an attack that drew blood */
  hit: 6,
  /** the opponent's attack missed */
  dodge: 12,
  /** the opponent landed a critical blow */
  critTaken: -15,
} as const;

/** what the acting fighter did this turn */
export interface RhythmTurn {
  readonly action: CombatAction;
  readonly previous?: CombatAction;
  readonly counter: boolean;
  readonly moved: boolean;
  readonly hit: boolean;
}

/** Rhythm the acting fighter gains (or loses) for its turn. */
export function actorRhythm(turn: RhythmTurn): number {
  let gain = 0;
  if (turn.previous !== undefined) gain += turn.action === turn.previous ? RHYTHM_GAIN.repeat : RHYTHM_GAIN.variety;
  if (turn.counter) gain += RHYTHM_GAIN.counter;
  if (turn.moved) gain += RHYTHM_GAIN.distance;
  if (turn.hit) gain += RHYTHM_GAIN.hit;
  return gain;
}

/** Rhythm the defender gains (or loses) from the attack it met: a miss is a dodge, a critical hurts the rhythm. */
export function defenderRhythm(attack: { readonly hit: boolean; readonly crit: boolean }): number {
  if (!attack.hit) return RHYTHM_GAIN.dodge;
  return attack.crit ? RHYTHM_GAIN.critTaken : 0;
}

export const clampRhythm = (value: number) => Math.max(0, Math.min(RHYTHM_MAX, Math.round(value)));

/** on the Seventh Step: the next attack cannot miss */
export const onSeventhStep = (rhythm: number | undefined) => rhythm !== undefined && rhythm >= RHYTHM_MAX;

/** lit footprints for a Rhythm value (0..RHYTHM_STEPS) */
export const rhythmSteps = (rhythm: number) => Math.min(RHYTHM_STEPS, Math.floor((clampRhythm(rhythm) * RHYTHM_STEPS) / RHYTHM_MAX));
