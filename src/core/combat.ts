import { nextRandom } from './rng';
import { deriveStats, resolveAttributes } from './stats';
import type {
  ActionOption, ActionResult, AttackKind, CombatAction, CombatEvent, CombatState,
  Fighter, FighterSetup, FighterSide, MoveKind,
} from './types';

export const ARENA_LENGTH = 20;
const MELEE_RANGE = 2;
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
const ATTACKS: Record<AttackKind, { hit: number; damage: number }> = {
  quick: { hit: 80, damage: 0.7 },
  normal: { hit: 70, damage: 1 },
  power: { hit: 55, damage: 1.6 },
  charge: { hit: 70, damage: 1.2 },
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const roundPosition = (value: number) => Math.round(value * 10) / 10;
const opposingSide = (side: FighterSide): FighterSide => side === 'player' ? 'enemy' : 'player';
const forwardDirection = (side: FighterSide) => side === 'player' ? 1 : -1;
const isAttack = (action: CombatAction): action is AttackKind => Object.hasOwn(ATTACKS, action);

export function createCombat(seed: number, player: FighterSetup = {}, enemy: FighterSetup = {}): CombatState {
  if (!Number.isSafeInteger(seed)) throw new RangeError('Combat seed must be a safe integer.');
  const fighters = {
    player: createFighter(player, 'Player', 2),
    enemy: createFighter(enemy, 'Opponent', 18),
  };
  if (fighters.player.position > fighters.enemy.position) {
    throw new RangeError('The player must start to the left of or next to the opponent.');
  }

  return { fighters, active: 'player', winner: null, rngState: seed >>> 0 };
}

function createFighter(setup: FighterSetup, defaultName: string, defaultPosition: number): Fighter {
  const position = setup.position ?? defaultPosition;
  if (!Number.isFinite(position) || position < 0 || position > ARENA_LENGTH) {
    throw new RangeError('Combat positions must be within the arena.');
  }
  const attributes = resolveAttributes(setup.attributes);
  const stats = deriveStats(attributes, setup.equipment);

  return {
    name: setup.name ?? defaultName,
    attributes,
    stats,
    position: roundPosition(position),
    health: stats.maxHealth,
    energy: stats.maxEnergy,
    guarding: false,
    tauntPenalty: 0,
  };
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

  for (const action of ACTIONS) {
    const energyCost = ENERGY_COSTS[action];
    if (energyCost > fighter.energy || !isInRange(action, active, fighter.position, distance)) continue;

    options.push(isAttack(action)
      ? { action, energyCost, hitChance: hitChance(action, fighter, opponent) }
      : { action, energyCost });
  }
  return options;
}

function isInRange(action: CombatAction, side: FighterSide, position: number, distance: number): boolean {
  switch (action) {
    case 'step_forward':
    case 'jump':
      return distance > 0;
    case 'step_back':
      return side === 'player' ? position > 0 : position < ARENA_LENGTH;
    case 'charge':
      return distance > MELEE_RANGE && distance <= CHARGE_RANGE;
    case 'quick':
    case 'normal':
    case 'power':
      return distance <= MELEE_RANGE;
    default:
      return true;
  }
}

function hitChance(kind: AttackKind, attacker: Readonly<Fighter>, defender: Readonly<Fighter>): number {
  // Each point of Precision over the opponent's Guard adds 3 percentage points.
  return clamp(ATTACKS[kind].hit + 3 * (attacker.attributes.precision - defender.attributes.guard) - attacker.tauntPenalty, 5, 95);
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
  let rngState = state.rngState;

  function roll(): number {
    const next = nextRandom(rngState);
    rngState = next.state;
    return next.value * 100;
  }

  changeEnergy(side, fighter, -option.energyCost, events);
  switch (action) {
    case 'step_forward':
      move(side, fighter, action, fighter.position + direction * Math.min(STEP_DISTANCE, distance), events);
      break;
    case 'step_back':
      move(side, fighter, action, fighter.position - direction * STEP_DISTANCE, events);
      break;
    case 'jump': {
      const reach = clamp(2 + 0.4 * fighter.attributes.agility, 2, 6);
      move(side, fighter, action, fighter.position + direction * Math.min(reach, distance), events);
      break;
    }
    case 'charge':
      move(side, fighter, action, opponent.position - direction, events);
      break;
    case 'block':
      fighter.guarding = true;
      events.push({ type: 'block', fighter: side });
      break;
    case 'rest': {
      const restored = Math.min(8 + fighter.attributes.stamina, fighter.stats.maxEnergy - fighter.energy);
      events.push({ type: 'rest', fighter: side, restored });
      changeEnergy(side, fighter, restored, events);
      break;
    }
    case 'taunt':
      opponent.tauntPenalty = Math.min(20, 5 + fighter.attributes.charm);
      events.push({ type: 'taunt', actor: side, target: other, penalty: opponent.tauntPenalty });
      break;
  }

  if (isAttack(action)) {
    const attack = resolveAttack(action, side, fighter, opponent, roll);
    events.push(attack);
    if (action === 'charge' && attack.damage > 0 && opponent.health > 0) {
      move(other, opponent, 'knockback', opponent.position + direction * KNOCKBACK_DISTANCE, events);
    }
  }

  fighter.tauntPenalty = 0;
  if (opponent.health === 0) {
    events.push({ type: 'death', fighter: other, winner: side });
    return { ok: true, state: { fighters, active: side, winner: side, rngState }, events };
  }

  opponent.guarding = false;
  events.push({ type: 'turn', fighter: other });
  return { ok: true, state: { fighters, active: other, winner: null, rngState }, events };
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
  const blocked = hit && defender.guarding && roll() < Math.min(80, 25 + 4 * defender.attributes.guard);
  const crit = hit && !blocked && roll() < Math.min(40, 5 + attacker.attributes.precision);
  let damage = 0;
  if (hit && !blocked) {
    const raw = (4 + attacker.attributes.might) * ATTACKS[kind].damage * (crit ? 1.5 : 1);
    // Armour has diminishing returns. A landed, unblocked hit always removes at least 1 HP.
    const mitigated = Math.max(1, Math.round(raw * 30 / (30 + defender.stats.armour)));
    damage = Math.min(defender.health, mitigated);
    defender.health -= damage;
  }

  return { type: 'attack', actor: side, target: opposingSide(side), kind, hitChance: chance, hit, crit, blocked, damage };
}
