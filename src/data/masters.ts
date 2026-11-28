/**
 * The Masters of the Order of the Seventh Step and the technique each teaches (#295, docs/SCENARIUSZ.md 3),
 * and Ser Corvin Lach, who has taken their scrolls and fights with every technique.
 * The trials themselves are #296; here is who teaches what, and the data a fight with Corvin needs.
 */
import type { AiProfile } from '../core/ai';
import { TECHNIQUES } from '../core/techniques';
import type { TechniqueId } from '../core/techniques';
import type { Attributes } from '../core/types';
import type { WeaponFamily } from './weapons';

export interface Master {
  readonly id: string;
  readonly name: string;
  readonly place: string;
  /** weapon and style, as the story tells it */
  readonly style: string;
  /** the special rule of the Master's trial (#296) */
  readonly trial: string;
  readonly technique: TechniqueId;
}

export const MASTERS: readonly Master[] = [
  { id: 'old-hask', name: 'Old Hask', place: 'the tavern in Brackwater', style: 'sword, a drunk unbeaten for 30 years', trial: 'Win a bout without stepping back once.', technique: 'feint_step' },
  { id: 'brann', name: 'Brann the Anvil', place: 'the forge in the Kragmoor mountains', style: 'hammer', trial: 'Cross the Flooded Mines and bring him their ore.', technique: 'stone_guard' },
  { id: 'sefa', name: 'Sefa of the Dunes', place: 'the oasis on the Red Sands', style: 'two daggers and the wind', trial: 'Three bouts in a sandstorm, without healing.', technique: 'sand_veil' },
  { id: 'kindler', name: 'The Kindler', place: 'the burnt chapel below Aurelon', style: 'a burning sword (Greek fire)', trial: 'A bout with a burning blade whose fire burns you too.', technique: 'burning_edge' },
];

export const masterOf = (technique: TechniqueId) => MASTERS.find((m) => m.technique === technique)!;

/** Ser Corvin Lach, the Grey Hand (act 3-4): a famous duellist with the stolen scrolls; his AI uses every technique */
export const CORVIN_LACH: {
  readonly id: string;
  readonly name: string;
  readonly level: number;
  readonly profile: AiProfile;
  readonly attributes: Attributes;
  readonly family: WeaponFamily;
  readonly tier: number;
  readonly techniques: readonly TechniqueId[];
} = {
  id: 'corvin-lach',
  name: 'Ser Corvin Lach',
  level: 28,
  profile: 'aggressor',
  attributes: { might: 13, agility: 14, precision: 14, guard: 12, vitality: 14, stamina: 13, charm: 12, arcana: 6 },
  family: 'sword',
  tier: 9,
  techniques: TECHNIQUES,
};
