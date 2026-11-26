import type { AiProfile } from '../core/ai';
import type { FighterSetup } from '../core/types';
import type { Look } from '../rig/PaperRig';
import { weapon } from './weapons';
import type { Weapon } from './weapons';

interface BronzeBout {
  readonly id: string;
  readonly name: string;
  readonly level: number;
  readonly profile: AiProfile;
  readonly setup: FighterSetup;
  readonly appearance: Pick<Look, 'skin' | 'face' | 'hair' | 'hairColor' | 'beard'>;
  readonly champion?: { readonly line: string; readonly weapon: Weapon };
}

function contender(
  id: string, name: string, level: number, profile: AiProfile, face: number,
  attributes: FighterSetup['attributes'], equipment: FighterSetup['equipment'],
): BronzeBout {
  return {
    id, name, level, profile, setup: { name, level, attributes, equipment },
    appearance: { skin: (face + 3) % 10, face, hair: (face + 4) % 10, hairColor: face % 4, beard: face % 3 },
  };
}

const championBlade = weapon('sword', 3);
if (!championBlade) throw new Error('Bronze champion requires the tier-three catalogue sword.');

export const PULPPORT_CHAMPION_WEAPON: Weapon = {
  ...championBlade, id: 'pulpport-laureate', name: 'Pulpport Laureate', damage: 10, minMight: 3,
};

export const PULPPORT_BRONZE: readonly BronzeBout[] = [
  contender('quay-rookie', 'Decima of the Quay', 1, 'aggressor', 1, { might: 4, guard: 3, vitality: 4 }, { armor: 1, weapon: 'sword1' }),
  contender('reed-gate', 'Tullia of the Reed Gate', 2, 'defender', 2, { guard: 7, stamina: 4 }, { helmet: 1, armor: 1, weapon: 'sword1' }),
  contender('ropewalker', 'Lucan the Ropewalker', 2, 'aggressor', 3, { agility: 8, precision: 6 }, { boots: 2, greaves: 1, weapon: 'sword2' }),
  contender('inkhand', 'Cassia Inkhand', 3, 'defender', 4, { guard: 8, precision: 6 }, { helmet: 2, armor: 1, shoulders: 1, weapon: 'sword2' }),
  contender('lamplighter', 'Drusa the Lamplighter', 3, 'aggressor', 6, { might: 8, stamina: 7 }, { armor: 2, shoulders: 2, boots: 1, weapon: 'sword2' }),
  {
    ...contender('bronze-champion', 'Varro the Gilded', 4, 'defender', 8, { might: 7, guard: 8, vitality: 7 },
      { helmet: 2, armor: 2, shoulders: 2, greaves: 2, boots: 2, weapon: 'sword3' }),
    champion: { line: 'Pulpport has heard your name. Now show us what it is worth.', weapon: PULPPORT_CHAMPION_WEAPON },
  },
];

export function nextPulpportBronzeBout(defeated: readonly string[]): BronzeBout | undefined {
  const wins = new Set(defeated);
  return PULPPORT_BRONZE.find(({ id }) => !wins.has(id));
}
