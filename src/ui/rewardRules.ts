/** What a finished career fight pays (#43): the pure part behind the reward scroll. */
import { applyFightReward, ownsWeapon } from '../core/rewards';
import type { FightReward } from '../core/rewards';
import type { SavedCharacter } from '../core/save';
import { PULPPORT_LEAGUES } from '../data/leagues';
import type { Weapon } from '../data/weapons';
import type { FightProgress } from './levelUpRules';
import { MATERIAL_NAMES, materialAmount } from './forgeRules';
import type { ForgeMaterial } from './forgeRules';

/** The prize weapon of the league champion fought in this bout; undefined for every other bout. */
export function championPrizeId(boutId?: string): string | undefined {
  return Object.values(PULPPORT_LEAGUES).flat().find(({ id }) => id === boutId)?.champion?.weapon.id;
}

export interface FightPayout {
  readonly reward: FightReward;
  /** the gladiator with the gold, XP and materials paid; the prize weapon is not taken yet */
  readonly progress: FightProgress;
  /** the prize weapon to take or leave; undefined when there is none or the gladiator already owns it */
  readonly offer?: Weapon;
}

export function payFightReward(character: SavedCharacter, reward: FightReward): FightPayout {
  const after = applyFightReward(character, reward, false);
  const { weapon } = reward;
  return {
    reward,
    progress: { earned: reward.experience, before: character, after },
    offer: weapon && !ownsWeapon(character, weapon.id) ? weapon : undefined,
  };
}

/** "2 Scraps · 1 Ink"; empty when the fight dropped nothing */
export function materialsLine(materials: FightReward['forgeMaterials']): string {
  if (!materials) return '';
  return (Object.keys(MATERIAL_NAMES) as ForgeMaterial[])
    .filter((key) => materials[key] > 0)
    .map((key) => materialAmount(key, materials[key]))
    .join(' · ');
}
