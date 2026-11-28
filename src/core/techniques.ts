/**
 * The Masters' techniques (#295, docs/SCENARIUSZ.md 5.7): four combat actions taught by the Masters of the Seventh Step
 * after their trials, apart from the skill trees. Each costs energy and Rhythm, so a fighter without Rhythm (the balance
 * tools' `rhythm: false`) cannot use them. `core/combat.ts` applies the rules; here are the numbers and the ids.
 *
 * - Feint Step (Old Hask): a step in with a feint, then a blow the opponent cannot block, so it earns no counter.
 * - Stone Guard (Brann the Anvil): a guard in which a successful block always earns the counter-attack.
 * - Sand Veil (Sefa of the Dunes): a half step back behind a veil of sand: blows against the fighter are harder to land
 *   until its next turn, and a blow that misses leaves the attacker blinded for its next turn.
 * - Burning Edge (the Kindler): a blow that sets the opponent on fire.
 */
import type { AttackKind } from './types';
import type { StoryState } from './story';

export const TECHNIQUES = ['feint_step', 'stone_guard', 'sand_veil', 'burning_edge'] as const;
export type TechniqueId = (typeof TECHNIQUES)[number];

export interface TechniqueRule {
  readonly name: string;
  /** energy paid like any action */
  readonly energy: number;
  /** Rhythm points spent before the technique acts, so a technique never rides the Seventh Step */
  readonly rhythm: number;
  /** the blow it strikes with, for the techniques that attack */
  readonly strike?: AttackKind;
}

/** tuned with tools/balance.ts against fighters without techniques (docs/BALANS.md) */
export const TECHNIQUE_RULES: Readonly<Record<TechniqueId, TechniqueRule>> = {
  feint_step: { name: 'Feint Step', energy: 6, rhythm: 25, strike: 'normal' },
  stone_guard: { name: 'Stone Guard', energy: 3, rhythm: 20 },
  sand_veil: { name: 'Sand Veil', energy: 4, rhythm: 20 },
  burning_edge: { name: 'Burning Edge', energy: 7, rhythm: 35, strike: 'normal' },
};

/** percentage points off every blow aimed at a fighter behind the Sand Veil (the Seventh Step still cannot miss) */
export const SAND_VEIL_EVASION = 25;
/** how far the Sand Veil steps back, in logical units (a plain step is 1.6) */
export const SAND_VEIL_STEP = 0.8;

export function isTechnique(value: unknown): value is TechniqueId {
  return typeof value === 'string' && (TECHNIQUES as readonly string[]).includes(value);
}

/** the story flag a Master's trial sets when it teaches the technique (#296) */
export const techniqueFlag = (id: TechniqueId) => `technique.${id}`;

/** the techniques the hero has learned, in the Masters' order */
export function learnedTechniques(story: Pick<StoryState, 'flags'>): TechniqueId[] {
  return TECHNIQUES.filter((id) => story.flags[techniqueFlag(id)] === true);
}

/** `all` or a comma list (`feint_step,sand_veil`), for dev links (`?view=arena&techniques=all`) */
export function parseTechniques(value: string | null): TechniqueId[] {
  if (!value) return [];
  if (value === 'all') return [...TECHNIQUES];
  return TECHNIQUES.filter((id) => value.split(',').includes(id));
}
