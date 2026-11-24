import { enchantmentEffect } from './enchant';
import { createCrowdStanding, crowdDamageMultiplier, scoreCrowdAction } from './crowd';
import { armourByZone, HIT_ZONES, ZONE_ACCURACY_PENALTY } from './hitZones';
import type { AttackZoneOption, HitZone, TargetedAttack } from './hitZones';
import { experienceForLevel, fightExperience } from './progression';
import { nextRandom } from './rng';
import { COMBAT_ITEMS, combatSlotOptions, consumeSlotItem, createCombatSlots } from './spells';
import type { CombatSlotAction, CombatSlotOption } from './spells';
import { attackDamage, attackHitChance, deriveStats, isAttack, resolveAttributes } from './stats';
import { advanceStatusDurations, applyStatus, statusModifiers, tickStatuses } from './status';
import type { StatusKind } from './status';
import { combatWeapon, weaponMove, weaponReach } from './weapons';
import type {
  ActionOption, ActionResult, AttackKind, AttackStrike, CombatAction, CombatEvent, CombatState,
  Fighter, FighterSetup, FighterSide, MoveKind,
} from './types';

export const ARENA_LENGTH = 20;
export { DEFAULT_WEAPON_REACH as MELEE_RANGE } from './weapons';
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
  const weapon = combatWeapon(setup.weapon) ?? combatWeapon(setup.equipment?.weapon);
  const stats = deriveStats(attributes, setup.equipment, weapon?.damage);

  return {
    name: setup.name ?? defaultName,
    level,
    attributes,
    stats,
    armourByZone: armourByZone(setup.equipment),
    weapon,
    position: roundPosition(position),
    health: stats.maxHealth,
    energy: stats.maxEnergy,
    guarding: false,
    counterReady: false,
    tauntPenalty: 0,
    crowd: createCrowdStanding(crowdSeed),
    statuses: [],
    statusResistances: { ...setup.statusResistances },
    slots: createCombatSlots(setup.slots),
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
  const meleeRange = weaponReach(fighter.weapon);
  const { movementMultiplier } = statusModifiers(fighter.statuses);

  for (const action of ACTIONS) {
    const counter = action === 'quick' && fighter.counterReady;
    const energyCost = counter ? 0 : ENERGY_COSTS[action];
    if (energyCost > fighter.energy || !isInRange(action, active, fighter.position, distance, meleeRange, movementMultiplier)) continue;

    options.push(isAttack(action)
      ? { action, energyCost, hitChance: hitChance(action, fighter, opponent), ...(counter ? { counter: true } : {}) }
      : { action, energyCost });
  }
  return options;
}

function isInRange(action: CombatAction, side: FighterSide, position: number, distance: number, meleeRange: number, movementMultiplier: number): boolean {
  switch (action) {
    case 'step_forward':
    case 'jump':
      return distance > 0;
    case 'step_back':
      return side === 'player' ? position > 0 : position < ARENA_LENGTH;
    case 'charge':
      return distance > meleeRange && distance <= CHARGE_RANGE * movementMultiplier;
    case 'quick':
    case 'normal':
    case 'power':
      return distance <= meleeRange;
    default:
      return true;
  }
}

export function getAttackZoneOptions(state: CombatState, action: AttackKind): AttackZoneOption[] {
  const available = getActionOptions(state).find((option) => option.action === action);
  if (!available) return [];
  const attacker = state.fighters[state.active];
  const defender = state.fighters[opposingSide(state.active)];
  return HIT_ZONES.map((zone) => ({ ...available, action, zone, hitChance: hitChance(action, attacker, defender, zone) }));
}

function hitChance(kind: AttackKind, attacker: Readonly<Fighter>, defender: Readonly<Fighter>, zone?: HitZone): number {
  const { accuracyPenalty } = statusModifiers(attacker.statuses);
  const targetingPenalty = zone ? ZONE_ACCURACY_PENALTY[zone] : 0;
  return attackHitChance(kind, attacker.stats, defender.stats, attacker.tauntPenalty + accuracyPenalty + targetingPenalty);
}

export function getCombatSlotOptions(state: CombatState): CombatSlotOption[] {
  if (state.winner !== null) return [];
  const { active } = state;
  const fighter = state.fighters[active];
  return combatSlotOptions(fighter.slots, active, opposingSide(active), fighter.energy, fighter.attributes.arcana);
}

function performSlotAction(state: CombatState, action: CombatSlotAction): ActionResult {
  const option = getCombatSlotOptions(state).find((entry) => entry.slot === action.slot && entry.target === action.target);
  if (!option || option.unavailable) return { ok: false, state, events: [], reason: 'unavailable' };

  const side = state.active;
  const other = opposingSide(side);
  const fighters = { player: { ...state.fighters.player }, enemy: { ...state.fighters.enemy } };
  const fighter = fighters[side];
  const target = fighters[option.target];
  const item = COMBAT_ITEMS[option.id];
  const events: CombatEvent[] = [];
  const strength = item.health === 'spellPower' ? -fighter.stats.spellPower : item.health ?? 0;
  const health = clamp(target.health + strength, 0, target.stats.maxHealth);
  const healthDelta = health - target.health;

  changeEnergy(side, fighter, -option.energyCost, events);
  fighter.slots = consumeSlotItem(fighter.slots, option.slot);
  target.health = health;
  if (item.status && health > 0) target.statuses = applyStatus(target.statuses, item.status, target.statusResistances);
  events.push({ type: 'slot', actor: side, target: option.target, slot: option.slot, item: option.id, healthDelta });

  return endTurn(fighters, side, other, state.rngState, events);
}

export function performAction(state: CombatState, command: CombatAction | TargetedAttack | CombatSlotAction): ActionResult {
  if (state.winner !== null) return { ok: false, state, events: [], reason: 'finished' };
  if (typeof command !== 'string' && 'slot' in command) return performSlotAction(state, command);
  const action = typeof command === 'string' ? command : command.action;
  const zone = typeof command === 'string' ? undefined : command.zone;
  const option = typeof command === 'string'
    ? getActionOptions(state).find((entry) => entry.action === command)
    : getAttackZoneOptions(state, command.action).find((entry) => entry.zone === command.zone);
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

  let attack: Extract<CombatEvent, { type: 'attack' }> | undefined;
  if (isAttack(action)) {
    const traits = weaponMove(action, fighter.weapon);
    attack = resolveAttack(action, side, fighter, opponent, traits, roll, zone);
    if (option.counter) attack.counter = true;
    events.push(attack);
    if (attack.damage > 0 && opponent.health > 0) {
      if (traits.status) opponent.statuses = applyStatus(opponent.statuses, traits.status, opponent.statusResistances);
      // aimed blows: a critical to the head stuns, a hit to the legs slows
      const zoneStatus = zone === 'head' && attack.crit ? 'stunned' : zone === 'legs' ? 'slowed' : undefined;
      if (zoneStatus) opponent.statuses = applyStatus(opponent.statuses, zoneStatus, opponent.statusResistances);
      let knockback = action === 'charge' ? KNOCKBACK_DISTANCE : traits.knockback;
      const enchantment = fighter.weapon?.enchantment;
      if (enchantment) {
        const effect = enchantmentEffect(enchantment);
        const damage = Math.min(opponent.health, effect.damage);
        opponent.health -= damage;
        events.push({ type: 'elemental', actor: side, target: other, damage, ...enchantment });
        if (effect.status && opponent.health > 0) opponent.statuses = applyStatus(opponent.statuses, effect.status, opponent.statusResistances);
        knockback += effect.knockback;
      }
      if (knockback > 0 && opponent.health > 0) move(other, opponent, 'knockback', opponent.position + direction * knockback, events);
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

  return endTurn(fighters, side, other, rngState, events);
}

function endTurn(
  fighters: Record<FighterSide, Fighter>, side: FighterSide, other: FighterSide, rngState: number, events: CombatEvent[],
): ActionResult {
  const fighter = fighters[side];
  const opponent = fighters[other];
  fighter.tauntPenalty = 0;
  fighter.statuses = fighter.statuses.filter((effect) => effect.turns > 0);
  fighter.counterReady = false;
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
    fighter.counterReady = false;
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

/** Chance in percentage points after a successful block. */
export function counterChance(guard: number): number {
  return guard < 8 ? 0 : Math.min(60, 20 + 5 * (guard - 8));
}

function resolveAttack(
  kind: AttackKind, side: FighterSide, attacker: Readonly<Fighter>, defender: Fighter,
  traits: ReturnType<typeof weaponMove>, roll: () => number, zone?: HitZone,
): Extract<CombatEvent, { type: 'attack' }> {
  const chance = hitChance(kind, attacker, defender, zone);
  const offense = {
    ...attacker.stats,
    attackPower: attacker.stats.attackPower * traits.damageMultiplier * crowdDamageMultiplier(attacker.crowd),
  };
  const defense = {
    ...defender.stats,
    // an aimed blow meets only the armour on that zone
    armour: (zone ? defender.armourByZone[zone] : defender.stats.armour)
      * statusModifiers(defender.statuses).armourMultiplier * traits.armourMultiplier,
  };
  const strikes: AttackStrike[] = [];

  for (let i = 0; i < traits.strikes && defender.health > 0; i++) {
    const hit = roll() < chance;
    // A defensive stance can block an incoming strike; a skilled block may earn a free counter. Crits need an unblocked hit.
    const blocked = hit && defender.guarding && roll() < defender.stats.blockChance;
    if (blocked && !defender.counterReady) {
      const chanceToCounter = counterChance(defender.attributes.guard);
      if (chanceToCounter > 0 && roll() < chanceToCounter) defender.counterReady = true;
    }
    const crit = hit && !blocked && roll() < attacker.stats.criticalChance;
    const damage = hit && !blocked ? Math.min(defender.health, attackDamage(kind, offense, defense, crit)) : 0;
    defender.health -= damage;
    if (hit) defender.guarding = false;
    strikes.push({ hit, blocked, crit, damage });
  }

  const damage = strikes.reduce((total, strike) => total + strike.damage, 0);
  return {
    type: 'attack', actor: side, target: opposingSide(side), kind, hitChance: chance,
    hit: strikes.some((strike) => strike.hit),
    crit: strikes.some((strike) => strike.crit),
    blocked: damage === 0 && strikes.some((strike) => strike.blocked),
    damage,
    ...(traits.strikes > 1 ? { strikes } : {}),
    ...(zone ? { zone } : {}),
  };
}
