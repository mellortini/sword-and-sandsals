import { createCrowdStanding, crowdDamageMultiplier, scoreCrowdAction } from './crowd';
import { experienceForLevel, fightExperience } from './progression';
import { nextRandom } from './rng';
import { attackDamage, attackHitChance, deriveStats, isAttack, resolveAttributes } from './stats';
import { advanceStatusDurations, applyStatus, statusModifiers, tickStatuses } from './status';
import type { StatusKind } from './status';
import type {
  ActionOption, ActionResult, AttackKind, CombatAction, CombatEvent, CombatState,
  Fighter, FighterSetup, FighterSide, MoveKind,
} from './types';

export const ARENA_LENGTH = 20;
export const MELEE_RANGE = 2;
const CHARGE_RANGE = 8;
const STEP_DISTANCE = 1.6;
const KNOCKBACK_DISTANCE = 2;

const ENERGY_COSTS: Record<CombatAction, number> = {
  step_forward: 1,
  step_back: 1,
  jump: 4,
  charge: 10,
  quick: 3,
  normal: 5,
  power: 8,
  block: 2,
  rest: 0,
  taunt: 2,
};

const ACTIONS = Object.keys(ENERGY_COSTS) as CombatAction[];
export const MIN_MELEE_ENERGY = Math.min(ENERGY_COSTS.quick, ENERGY_COSTS.normal, ENERGY_COSTS.power);

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const roundPosition = (value: number) => Math.round(value * 10) / 10;
const opposingSide = (side: FighterSide): FighterSide => side === 'player' ? 'enemy' : 'player';
const forwardDirection = (side: FighterSide) => side === 'player' ? 1 : -1;

export function createCombat(seed: number, player: FighterSetup = {}, enemy: FighterSetup = {}): CombatState {
  if (!Number.isSafeInteger(seed)) throw new RangeError('Combat seed must be a safe integer.');
  const fighters = {
    player: createFighter(player, 'Player', 2, seed ^ 0x6e684e35),
    enemy: createFighter(enemy, 'Opponent', 18, seed ^ 0x87e4cff8),
  };
  if (fighters.player.position > fighters.enemy.position) {
    throw new RangeError('The player must start to the left of or next to the opponent.');
  }

  return { fighters, active: 'player', winner: null, rngState: seed >>> 0 };
}

function createFighter(setup: FighterSetup, defaultName: string, defaultPosition: number, crowdSeed: number): Fighter {
  const level = setup.level ?? 1;
  experienceForLevel(level);
  const position = setup.position ?? defaultPosition;
  if (!Number.isFinite(position) || position < 0 || position > ARENA_LENGTH) {
    throw new RangeError('Combat positions must be within the arena.');
  }
  const attributes = resolveAttributes(setup.attributes);
  const stats = deriveStats(attributes, setup.equipment);

  return {
    name: setup.name ?? defaultName,
    level,
    attributes,
    stats,
    position: roundPosition(position),
    health: stats.maxHealth,
    energy: stats.maxEnergy,
    guarding: false,
    tauntPenalty: 0,
    crowd: createCrowdStanding(crowdSeed),
    statuses: [],
    statusResistances: { ...setup.statusResistances },
  };
}

/** Modifiers take effect immediately. Damage, healing and stun tick at the recipient's next turn. */
export function applyCombatStatus(state: CombatState, side: FighterSide, kind: StatusKind): CombatState {
  if (state.winner !== null) return state;
  const fighter = state.fighters[side];
  const statuses = applyStatus(fighter.statuses, kind, fighter.statusResistances);
  if (statuses === fighter.statuses) return state;
  return { ...state, fighters: { ...state.fighters, [side]: { ...fighter, statuses } } };
}

export function getDistance(state: CombatState): number {
  // The core measures the gap beyond contact. The scene adds the rig spacing when positioning sprites.
  return roundPosition(state.fighters.enemy.position - state.fighters.player.position);
}

export function getActionOptions(state: CombatState): ActionOption[] {
  if (state.winner !== null) return [];

  const { active } = state;
  const fighter = state.fighters[active];
  const opponent = state.fighters[opposingSide(active)];
  const distance = getDistance(state);
  const options: ActionOption[] = [];
  const { movementMultiplier } = statusModifiers(fighter.statuses);

  for (const action of ACTIONS) {
    const energyCost = ENERGY_COSTS[action];
    if (energyCost > fighter.energy || !isInRange(action, active, fighter.position, distance, movementMultiplier)) continue;

    options.push(isAttack(action)
      ? { action, energyCost, hitChance: hitChance(action, fighter, opponent) }
      : { action, energyCost });
  }
  return options;
}

function isInRange(action: CombatAction, side: FighterSide, position: number, distance: number, movementMultiplier: number): boolean {
  switch (action) {
    case 'step_forward':
    case 'jump':
      return distance > 0;
    case 'step_back':
      return side === 'player' ? position > 0 : position < ARENA_LENGTH;
    case 'charge':
      return distance > MELEE_RANGE && distance <= CHARGE_RANGE * movementMultiplier;
    case 'quick':
    case 'normal':
    case 'power':
      return distance <= MELEE_RANGE;
    default:
      return true;
  }
}

function hitChance(kind: AttackKind, attacker: Readonly<Fighter>, defender: Readonly<Fighter>): number {
  const { accuracyPenalty } = statusModifiers(attacker.statuses);
  return attackHitChance(kind, attacker.stats, defender.stats, attacker.tauntPenalty + accuracyPenalty);
}

export function performAction(state: CombatState, action: CombatAction): ActionResult {
  if (state.winner !== null) return { ok: false, state, events: [], reason: 'finished' };
  const option = getActionOptions(state).find((entry) => entry.action === action);
  if (!option) return { ok: false, state, events: [], reason: 'unavailable' };

  const side = state.active;
  const other = opposingSide(side);
  const fighter = { ...state.fighters[side] };
  const opponent = { ...state.fighters[other] };
  const fighters = { ...state.fighters, [side]: fighter, [other]: opponent };
  const events: CombatEvent[] = [];
  const distance = getDistance(state);
  const direction = forwardDirection(side);
  const { movementMultiplier } = statusModifiers(fighter.statuses);
  let rngState = state.rngState;

  function roll(): number {
    const next = nextRandom(rngState);
    rngState = next.state;
    return next.value * 100;
  }

  changeEnergy(side, fighter, -option.energyCost, events);
  switch (action) {
    case 'step_forward':
      move(side, fighter, action, fighter.position + direction * Math.min(STEP_DISTANCE * movementMultiplier, distance), events);
      break;
    case 'step_back':
      move(side, fighter, action, fighter.position - direction * STEP_DISTANCE * movementMultiplier, events);
      break;
    case 'jump':
      move(side, fighter, action, fighter.position + direction * Math.min(fighter.stats.jumpDistance * movementMultiplier, distance), events);
      break;
    case 'charge':
      move(side, fighter, action, opponent.position - direction, events);
      break;
    case 'block':
      fighter.guarding = true;
      events.push({ type: 'block', fighter: side });
      break;
    case 'rest': {
      const restored = Math.min(fighter.stats.restRecovery, fighter.stats.maxEnergy - fighter.energy);
      events.push({ type: 'rest', fighter: side, restored });
      changeEnergy(side, fighter, restored, events);
      break;
    }
    case 'taunt':
      opponent.tauntPenalty = fighter.stats.tauntPenalty;
      events.push({ type: 'taunt', actor: side, target: other, penalty: opponent.tauntPenalty });
      break;
  }

  const attack = isAttack(action) ? resolveAttack(action, side, fighter, opponent, roll) : undefined;
  if (attack) {
    events.push(attack);
    if (action === 'charge' && attack.damage > 0 && opponent.health > 0) {
      move(other, opponent, 'knockback', opponent.position + direction * KNOCKBACK_DISTANCE, events);
    }
  }

  const previousCrowd = fighter.crowd;
  const crowd = scoreCrowdAction(previousCrowd, action, fighter.attributes.charm, attack?.hit, attack?.crit);
  fighter.crowd = crowd.standing;
  if (crowd.gift) {
    const amount = crowd.gift === 'bouquet'
      ? Math.min(8, fighter.stats.maxHealth - fighter.health)
      : crowd.standing.giftGold - previousCrowd.giftGold;
    if (crowd.gift === 'bouquet') fighter.health += amount;
    events.push({ type: 'crowd_gift', fighter: side, gift: crowd.gift, amount });
  }

  fighter.tauntPenalty = 0;
  fighter.statuses = fighter.statuses.filter((effect) => effect.turns > 0);
  if (opponent.health === 0) return finishCombat(fighters, side, rngState, events);

  return startNextTurn(fighters, other, rngState, events);
}

function startNextTurn(
  fighters: Record<FighterSide, Fighter>, active: FighterSide, rngState: number, events: CombatEvent[],
): ActionResult {
  while (true) {
    const fighter = fighters[active];
    fighter.guarding = false;
    const tick = tickStatuses(fighter.statuses, fighter.health, fighter.stats.maxHealth);
    fighter.health = tick.health;
    for (const effect of tick.ticks) events.push({ type: 'status', fighter: active, ...effect });
    if (fighter.health === 0) return finishCombat(fighters, opposingSide(active), rngState, events);
    // Keep effects with zero turns through this action so their modifiers still apply.
    fighter.statuses = advanceStatusDurations(fighter.statuses);
    if (!tick.skip) {
      events.push({ type: 'turn', fighter: active });
      return { ok: true, state: { fighters, active, winner: null, rngState }, events };
    }
    fighter.statuses = fighter.statuses.filter((effect) => effect.turns > 0);
    fighter.tauntPenalty = 0;
    active = opposingSide(active);
  }
}

function finishCombat(
  fighters: Record<FighterSide, Fighter>, winner: FighterSide, rngState: number, events: CombatEvent[],
): ActionResult {
  events.push({ type: 'death', fighter: opposingSide(winner), winner });
  const rewards = { experience: fightExperience(winner, fighters.player.level, fighters.enemy.level) };
  return { ok: true, state: { fighters, active: winner, winner, rngState, rewards }, events };
}

function move(side: FighterSide, fighter: Fighter, kind: MoveKind, position: number, events: CombatEvent[]) {
  const from = fighter.position;
  const to = roundPosition(clamp(position, 0, ARENA_LENGTH));
  if (from === to) return;
  fighter.position = to;
  events.push({ type: 'move', fighter: side, kind, from, to });
}

function changeEnergy(side: FighterSide, fighter: Fighter, amount: number, events: CombatEvent[]) {
  const from = fighter.energy;
  const to = clamp(from + amount, 0, fighter.stats.maxEnergy);
  if (from === to) return;
  fighter.energy = to;
  events.push({ type: 'energy', fighter: side, from, to });
}

function resolveAttack(
  kind: AttackKind, side: FighterSide, attacker: Readonly<Fighter>, defender: Fighter, roll: () => number,
): Extract<CombatEvent, { type: 'attack' }> {
  const chance = hitChance(kind, attacker, defender);
  const hit = roll() < chance;
  // A defensive stance can block one incoming attack. Crits require an unblocked hit.
  const blocked = hit && defender.guarding && roll() < defender.stats.blockChance;
  const crit = hit && !blocked && roll() < attacker.stats.criticalChance;
  let damage = 0;
  if (hit && !blocked) {
    // crowd favour raises the attacker's power, soaking weakens the defender's armour
    const offense = { ...attacker.stats, attackPower: attacker.stats.attackPower * crowdDamageMultiplier(attacker.crowd) };
    const { armourMultiplier } = statusModifiers(defender.statuses);
    const defense = { ...defender.stats, armour: defender.stats.armour * armourMultiplier };
    damage = Math.min(defender.health, attackDamage(kind, offense, defense, crit));
    defender.health -= damage;
  }

  return { type: 'attack', actor: side, target: opposingSide(side), kind, hitChance: chance, hit, crit, blocked, damage };
}
