import { getActionOptions, getDistance, MIN_MELEE_ENERGY, strikeOf } from './combat';
import { RHYTHM_MAX } from './rhythm';
import { nextRandom } from './rng';
import { attackDamage, isAttack } from './stats';
import type { ActionOption, CombatAction, CombatState } from './types';
import { weaponReach } from './weapons';

export type AiProfile = 'aggressor' | 'defender' | 'lion' | 'bear';

export interface AiDecision {
  action: CombatAction;
  /** AI random state for the next call; kept apart from the combat's own rolls */
  rngState: number;
}

/** Per-profile multipliers on top of the situational score of every action. */
const PROFILE_WEIGHTS: Record<AiProfile, Record<CombatAction, number>> = {
  aggressor: {
    quick: 1, normal: 1.2, power: 1.6, charge: 2.2,
    step_forward: 1, jump: 1.4, step_back: 0.1, block: 0.3, rest: 0.6, taunt: 0.3, net: 1,
    feint_step: 1.3, stone_guard: 0.8, sand_veil: 0.6, burning_edge: 1.4,
  },
  // #282: a defender that still answers blow for blow; the old, more passive one lost ~60% to the aggressor
  defender: {
    quick: 1.4, normal: 1.3, power: 1.0, charge: 0.9,
    step_forward: 1, jump: 0.8, step_back: 0.3, block: 1.0, rest: 0.9, taunt: 0.1, net: 1.2,
    feint_step: 1, stone_guard: 1.3, sand_veil: 1.1, burning_edge: 1,
  },
  lion: {
    quick: 1.8, normal: 1, power: 0.7, charge: 3.4,
    step_forward: 0.55, jump: 3.2, step_back: 0.05, block: 0.1, rest: 0.85, taunt: 0, net: 0,
    feint_step: 0, stone_guard: 0, sand_veil: 0, burning_edge: 0,
  },
  bear: {
    quick: 0.45, normal: 1.1, power: 2.9, charge: 0.55,
    step_forward: 1.6, jump: 0.08, step_back: 0.15, block: 1.15, rest: 1.2, taunt: 0, net: 0,
    feint_step: 0, stone_guard: 0, sand_veil: 0, burning_edge: 0,
  },
};

export function isAiProfile(value: unknown): value is AiProfile {
  return typeof value === 'string' && Object.hasOwn(PROFILE_WEIGHTS, value);
}

/**
 * Picks an action for the side whose turn it is (`state.active`).
 * Only actions from `getActionOptions` are considered, so the choice is always legal.
 * The same state, profile and `rngState` always give the same decision.
 */
export function chooseAction(state: CombatState, profile: AiProfile, rngState: number, guardWeight = 0): AiDecision {
  const options = getActionOptions(state);
  if (options.length === 0) throw new Error('No action available: the fight is over.');

  const scored = options.map((option) => ({
    action: option.action,
    weight: situationalScore(state, option) * PROFILE_WEIGHTS[profile][option.action] + (option.action === 'block' ? guardWeight : 0),
  }));
  const total = scored.reduce((sum, s) => sum + s.weight, 0);
  const next = nextRandom(rngState);
  if (total <= 0) return { action: options[0].action, rngState: next.state };

  let roll = next.value * total;
  for (const s of scored) {
    roll -= s.weight;
    if (roll < 0) return { action: s.action, rngState: next.state };
  }
  return { action: scored[scored.length - 1].action, rngState: next.state };
}

/** How good an action looks right now, before the profile's taste is applied. */
function situationalScore(state: CombatState, option: ActionOption): number {
  const me = state.fighters[state.active];
  const foe = state.fighters[state.active === 'player' ? 'enemy' : 'player'];
  const distance = getDistance(state);
  const inMelee = distance <= weaponReach(me.weapon);
  const health = me.health / me.stats.maxHealth;
  const energy = me.energy / me.stats.maxEnergy;
  const foeCanStrike = distance <= weaponReach(foe.weapon) && foe.energy >= MIN_MELEE_ENERGY;

  // a Master's technique (#295) spends Rhythm: close to the Seventh Step it is worth less, the step is worth more
  const rhythmCost = option.rhythmCost ? Math.max(0.3, 1 - (me.rhythm ?? 0) / RHYTHM_MAX * 0.7) : 1;

  const strike = strikeOf(option.action);
  if (option.hitChance !== undefined && strike) {
    const damage = attackDamage(strike, me.stats, foe.stats);
    // hit chance times damage, measured against the foe's remaining health; a likely kill is worth a lot more
    let value = (option.hitChance / 100) * (damage / Math.max(1, foe.health)) * 10 + (option.hitChance / 100) * 2;
    if (damage >= foe.health) value *= 3;
    // Feint Step: best against a raised guard; Burning Edge: the fire is worth a few more blows, not on one already burning
    if (option.action === 'feint_step') value *= foe.guarding ? 2 : 1.1;
    if (option.action === 'burning_edge' && !foe.statuses.some((s) => s.kind === 'burning')) value *= 1.5;
    return isAttack(option.action) ? value : value * rhythmCost;
  }

  switch (option.action) {
    case 'step_forward':
    case 'jump':
      // closing in matters only while out of reach
      return inMelee ? 0.05 : 2;
    case 'step_back':
      return health < 0.35 && foeCanStrike ? 1 : 0.2;
    case 'block': {
      // a guard is worth what it blocks (#274): the blade alone parries less often than a shield
      const worth = (option.blockChance ?? me.stats.blockChance) / Math.max(1, me.stats.blockChance);
      return (foeCanStrike ? (health < 0.5 ? 1.6 : 0.8) : 0.15) * worth;
    }
    case 'rest': {
      // out of breath: nothing else helps
      if (me.energy < MIN_MELEE_ENERGY) return 20;
      const tired = (1 - energy) ** 2 * 3;
      // resting at a distance is safe, resting in the foe's reach is a gamble
      return foeCanStrike ? tired * 0.5 : tired * 1.5;
    }
    case 'taunt':
      return getDistance(state) > 0 ? 0.25 : 0.1;
    // the techniques' stances (#295): worth it only when a blow is coming
    case 'stone_guard': {
      const worth = (option.blockChance ?? me.stats.blockChance) / Math.max(1, me.stats.blockChance);
      // a block in it always earns the counter: worth more than a plain guard
      return (foeCanStrike ? (health < 0.5 ? 2.4 : 1.4) : 0.1) * worth * rhythmCost;
    }
    case 'sand_veil':
      return (foeCanStrike ? (health < 0.5 ? 1.4 : 0.8) : 0.05) * rhythmCost;
    case 'net': {
      // #258: a caught foe loses a turn; worth most when it is about to strike, nothing on one already caught
      if (foe.statuses.some((s) => s.kind === 'netted' || s.kind === 'stunned')) return 0;
      return ((option.hitChance ?? 0) / 100) * (foeCanStrike ? 1.4 : 0.6);
    }
    default:
      return 0.1;
  }
}
