import type { AiProfile } from '../core/ai';
import type { FighterSetup } from '../core/types';

interface BeastOpponent {
  readonly profile: AiProfile;
  readonly setup: FighterSetup;
}

export const BEAST_OPPONENTS = {
  'paper-lion': {
    profile: 'lion',
    setup: {
      name: 'Paper Lion', level: 18,
      attributes: { might: 12, agility: 15, precision: 12, guard: 7, vitality: 11, stamina: 14 },
    },
  },
  'cardboard-bear': {
    profile: 'bear',
    setup: {
      name: 'Cardboard Bear', level: 22,
      attributes: { might: 18, agility: 5, precision: 10, guard: 14, vitality: 17, stamina: 12 },
    },
  },
} as const satisfies Readonly<Record<string, BeastOpponent>>;
