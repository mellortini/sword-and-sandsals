import { getActionOptions, getDistance } from './combat';
import { nextRandom } from './rng';
import type { ActionOption, CombatAction, CombatState, Fighter } from './types';

/** Fighting style: the aggressor charges and swings hard, the defender guards, rests and picks safe hits. */
export type AiProfile = 'aggressor' | 'defender';

export interface AiDecision {
  action: CombatAction;
  /** AI random state for the next call; kept apart from the combat's own rolls */
  rngState: number;
}

/** Per-profile multipliers on top of the situational score of every action. */
const PROFILE_WEIGHTS: Record<AiProfile, Record<CombatAction, number>> = {
  aggressor: {
    quick: 1, normal: 1.2, power: 1.6, charge: 2.2,
    step_forward: 1, jump: 1.4, step_back: 0.1, block: 0.3, rest: 0.6, taunt: 0.3,
  },
  defender: {
    quick: 1.3, normal: 1.1, power: 0.7, charge: 0.5,
    step_forward: 0.7, jump: 0.4, step_back: 0.5, block: 1.2, rest: 1, taunt: 0.15,
  },
};

/** damage multipliers of the attacks, as in the combat core (normal = 1) */
const ATTACK_POWER: Partial<Record<CombatAction, number>> = { quick: 0.7, normal: 1, power: 1.6, charge: 1.2 };
/** melee reach of the combat core (MELEE_RANGE in combat.ts) */
const MELEE_RANGE = 2;
/** cheapest melee attack; below this the fighter cannot hurt anyone */
const MIN_ATTACK_ENERGY = 3;

/**
 * Picks an action for the side whose turn it is (`state.active`).
 * Only actions from `getActionOptions` are considered, so the choice is always legal.
 * The same state, profile and `rngState` always give the same decision.
 */
export function chooseAction(state: CombatState, profile: AiProfile, rngState: number): AiDecision {
  const options = getActionOptions(state);
  if (options.length === 0) throw new Error('No action available: the fight is over.');

  const scored = options.map((option) => ({
    action: option.action,
    weight: situationalScore(state, option) * PROFILE_WEIGHTS[profile][option.action],
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
  const inMelee = getDistance(state) <= MELEE_RANGE;
  const health = me.health / me.stats.maxHealth;
  const energy = me.energy / me.stats.maxEnergy;
  const foeCanStrike = inMelee && foe.energy >= MIN_ATTACK_ENERGY;

  if (option.hitChance !== undefined) {
    const damage = expectedDamage(me, foe, option.action);
    // hit chance times damage, measured against the foe's remaining health; a likely kill is worth a lot more
    const value = (option.hitChance / 100) * (damage / Math.max(1, foe.health)) * 10 + (option.hitChance / 100) * 2;
    return damage >= foe.health ? value * 3 : value;
  }

  switch (option.action) {
    case 'step_forward':
    case 'jump':
      // closing in matters only while out of reach
      return inMelee ? 0.05 : 2;
    case 'step_back':
      return health < 0.35 && foeCanStrike ? 1 : 0.2;
    case 'block':
      return foeCanStrike ? (health < 0.5 ? 1.6 : 0.8) : 0.15;
    case 'rest': {
      // out of breath: nothing else helps
      if (me.energy < MIN_ATTACK_ENERGY) return 20;
      const tired = (1 - energy) ** 2 * 3;
      // resting at a distance is safe, resting in the foe's reach is a gamble
      return foeCanStrike ? tired * 0.5 : tired * 1.5;
    }
    case 'taunt':
      return getDistance(state) > 0 ? 0.25 : 0.1;
    default:
      return 0.1;
  }
}

/** rough damage of an unblocked, non-critical hit (same formula shape as the combat core) */
function expectedDamage(attacker: Readonly<Fighter>, defender: Readonly<Fighter>, action: CombatAction): number {
  const raw = (4 + attacker.attributes.might) * (ATTACK_POWER[action] ?? 1);
  return Math.max(1, Math.round(raw * 30 / (30 + defender.stats.armour)));
}
