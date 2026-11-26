import type { AiProfile } from '../core/ai';
import type { StatusKind } from '../core/status';
import type { Attributes, FighterSetup } from '../core/types';
import { PULPPORT_LEGEND } from './leagues';
import type { PulpportBout } from './leagues';
import type { WeaponFamily } from './weapons';

export type RegionId = 'pulpport' | 'kraftmoor';

interface Region {
  readonly name: string;
  readonly unlockAfterBout?: string;
  readonly openingStatus?: StatusKind;
  readonly startingPositions?: { readonly player: number; readonly enemy: number };
}

export const REGIONS: Readonly<Record<RegionId, Region>> = {
  pulpport: { name: 'Pulpport' },
  kraftmoor: {
    name: 'Kraftmoor',
    unlockAfterBout: PULPPORT_LEGEND.at(-1)!.id,
    openingStatus: 'soaked',
    startingPositions: { player: 6, enemy: 14 },
  },
};

export interface RegionalOpponent {
  readonly id: string;
  readonly name: string;
  readonly level: number;
  readonly profile: AiProfile;
  readonly setup: FighterSetup;
  readonly appearance: PulpportBout['appearance'];
}

interface KraftmoorRival {
  readonly id: string;
  readonly name: string;
  readonly level: number;
  readonly profile: AiProfile;
  readonly face: number;
  readonly tier: 8 | 9 | 10;
  readonly family: WeaponFamily;
  readonly strengths: Partial<Attributes>;
}

function kraftmoorRival({ id, name, level, profile, face, tier, family, strengths }: KraftmoorRival): RegionalOpponent {
  return {
    id, name, level, profile,
    appearance: { skin: (face + 2) % 10, face, hair: (face + 3) % 10, hairColor: face % 4, beard: face % 3 },
    setup: {
      name, level,
      attributes: { might: 21, guard: 15, vitality: 14, stamina: 14, agility: 11, precision: 14, ...strengths },
      equipment: { helmet: tier, armor: tier, shoulders: tier, greaves: tier, boots: tier, weapon: `${family}${tier}` },
    },
  };
}

/** Kraftmoor's opening ladder, in the order the dockside press-yard meets them. */
export const KRAFTMOOR_OPPONENTS: readonly RegionalOpponent[] = [
  kraftmoorRival({ id: 'kraftmoor-coldpress', name: 'Octavia Coldpress', level: 33, profile: 'defender', face: 0, tier: 8, family: 'hammer',
    strengths: { guard: 18 } }),
  kraftmoorRival({ id: 'kraftmoor-drain', name: 'Nero at the Drain', level: 34, profile: 'aggressor', face: 1, tier: 8, family: 'axe',
    strengths: { might: 24, stamina: 17 } }),
  kraftmoorRival({ id: 'kraftmoor-bulkhead', name: 'Fausta Bulkhead', level: 35, profile: 'defender', face: 2, tier: 9, family: 'spear',
    strengths: { precision: 18 } }),
  kraftmoorRival({ id: 'kraftmoor-frostline', name: 'Titus Frostline', level: 36, profile: 'aggressor', face: 4, tier: 9, family: 'sword',
    strengths: { agility: 15, precision: 16 } }),
  kraftmoorRival({ id: 'kraftmoor-layer', name: 'Nona Nine-Layer', level: 38, profile: 'defender', face: 6, tier: 9, family: 'hammer',
    strengths: { guard: 20, vitality: 21 } }),
  kraftmoorRival({ id: 'kraftmoor-foreman', name: 'Severus of the Press', level: 40, profile: 'aggressor', face: 7, tier: 10, family: 'hammer',
    strengths: { might: 28, guard: 20, vitality: 24, stamina: 21, precision: 18 } }),
];
