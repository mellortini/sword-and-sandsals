import { skillBonuses } from './skills';
import { MAX_PROTECTED_MISSES, protectedHitChance } from './hitProtection';
import { enchantmentEffect } from './enchant';
import { createCrowdStanding, crowdDamageMultiplier, scoreCrowdAction } from './crowd';
import { armourByZone, HIT_ZONES, ZONE_ACCURACY_PENALTY } from './hitZones';
import type { AttackZoneOption, HitZone, TargetedAttack } from './hitZones';
import { experienceForLevel, fightExperience } from './progression';
import { nextRandom } from './rng';
import { COMBAT_ITEMS, combatSlotOptions, consumeSlotItem, createCombatSlots } from './spells';
import type { CombatSlotAction, CombatSlotOption } from './spells';
import { attackDamage, attackHitChance, deriveStats, isAttack, resolveAttributes, shieldDamage } from './stats';
import { advanceStatusDurations, applyStatus, statusModifiers, tickStatuses } from './status';
import { actorRhythm, clampRhythm, defenderRhythm, onSeventhStep } from './rhythm';
import type { StatusKind } from './status';
import { isTechnique, SAND_VEIL_EVASION, SAND_VEIL_STEP, TECHNIQUE_RULES } from './techniques';
import type { TechniqueId } from './techniques';
import { carriesNet, combatWeapon, leavesHandForShield, weaponMove, weaponReach } from './weapons';
import { findShield } from '../data/shields';
import type {
  ActionOption, ActionResult, AttackKind, AttackStrike, CombatAction, CombatEvent, CombatState,
  Attributes, Fighter, FighterSetup, FighterSide, FighterStats, MoveKind,
} from './types';

export const ARENA_LENGTH = 20;
export { DEFAULT_WEAPON_REACH as MELEE_RANGE } from './weapons';
const CHARGE_RANGE = 8;
const STEP_DISTANCE = 1.6;
const KNOCKBACK_DISTANCE = 2;
/** how far the trident's net flies (#258), in logical units beyond contact */
export const NET_RANGE = 4;
/** the net's chance before Agility, and the points one point of Agility over the target adds */
const NET_BASE_CHANCE = 60;
const NET_PER_AGILITY = 4;

const ENERGY_COSTS: Record<CombatAction, number> = {
  step_forward: 1,
  step_back: 1,
  jump: 4,
  charge: 10,
  quick: 3,
  normal: 5,
  // #282: the heaviest blow per turn now costs its tempo (was 8)
  power: 11,
  block: 2,
  rest: 0,
  taunt: 2,
  net: 6,
  feint_step: TECHNIQUE_RULES.feint_step.energy,
  stone_guard: TECHNIQUE_RULES.stone_guard.energy,
  sand_veil: TECHNIQUE_RULES.sand_veil.energy,
  burning_edge: TECHNIQUE_RULES.burning_edge.energy,
};

const ACTIONS = Object.keys(ENERGY_COSTS) as CombatAction[];
/** a fighter's techniques without repeats, in the Masters' order */
const techniquesInOrder = (ids: readonly TechniqueId[]): TechniqueId[] =>
  (Object.keys(TECHNIQUE_RULES) as TechniqueId[]).filter((id) => ids.includes(id));

/** the blow an action strikes with: an attack itself, or the strike of an attacking technique (#295) */
export function strikeOf(action: CombatAction): AttackKind | undefined {
  if (isAttack(action)) return action;
  return isTechnique(action) ? TECHNIQUE_RULES[action].strike : undefined;
}
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
  const bonuses = skillBonuses(setup.skills);
  const attributes = resolveAttributes(setup.attributes);
  for (const key of Object.keys(bonuses.attributes) as (keyof Attributes)[]) {
    attributes[key] = Math.min(Number.MAX_SAFE_INTEGER, attributes[key] + (bonuses.attributes[key] ?? 0));
  }
  const weapon = combatWeapon(setup.weapon) ?? combatWeapon(setup.equipment?.weapon);
  const stats = deriveStats(attributes, setup.equipment, weapon?.damage);
  for (const key of Object.keys(bonuses.stats) as (keyof FighterStats)[]) stats[key] += bonuses.stats[key] ?? 0;
  stats.blockChance = Math.min(90, stats.blockChance);
  stats.criticalChance = Math.min(50, stats.criticalChance);
  const crowd = createCrowdStanding(crowdSeed);
  const zoneArmour = armourByZone(setup.equipment);
  const zoneBonus = bonuses.stats.armour ?? 0;
  const statusResistances = { ...setup.statusResistances };
  for (const key of Object.keys(bonuses.resistance) as StatusKind[]) {
    statusResistances[key] = Math.min(100, (statusResistances[key] ?? 0) + (bonuses.resistance[key] ?? 0));
  }
  const health = setup.health ?? stats.maxHealth;
  if (!Number.isInteger(health) || health < 1) throw new RangeError('Combat requires a positive starting health.');
  // a shield in the off hand comes to the bout whole (#273), if the weapon leaves a hand free for it
  const shieldItem = leavesHandForShield(weapon) ? findShield(setup.equipment?.offHand) : undefined;

  return {
    name: setup.name ?? defaultName,
    level,
    attributes,
    stats,
    armourByZone: { head: zoneArmour.head + zoneBonus, torso: zoneArmour.torso + zoneBonus, legs: zoneArmour.legs + zoneBonus },
    weapon,
    ...(shieldItem && { shield: { id: shieldItem.id, tier: shieldItem.tier, health: shieldItem.health, maxHealth: shieldItem.health } }),
    ...(carriesNet(weapon) && { net: true }),
    position: roundPosition(position),
    health: Math.min(health, stats.maxHealth),
    energy: stats.maxEnergy,
    guarding: false,
    counterReady: false,
    tauntPenalty: 0,
    consecutiveMisses: 0,
    ...(setup.rhythm !== false && { rhythm: 0 }),
    // the Masters' techniques (#295) are paid with Rhythm: no Rhythm, no techniques
    ...(setup.rhythm !== false && setup.techniques?.length && { techniques: techniquesInOrder(setup.techniques) }),
    crowd: { ...crowd, favour: crowd.favour + bonuses.rules.crowdStart },
    statuses: [],
    statusResistances,
    skillRules: bonuses.rules,
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

/**
 * Without a shield the blade parries alone (#274): a fighter with no shield, a broken one or a two-handed weapon
 * blocks with this share of the block chance. A whole shield blocks at the full chance.
 */
export const PARRY_SHARE = 0.5;

/** the most a blow can have of cutting off the shield arm, in percentage points (#275) */
export const SEVER_MAX = 5;
/** percentage points per point of Might the attacker has over the defender */
const SEVER_PER_MIGHT = 0.5;

/**
 * Chance (percentage points) that a landed heavy blow takes off the defender's shield arm (#275). Never while the
 * defender guards: a raised guard always protects the arm. Only power blows and charges, only against a whole shield,
 * and only with more Might than the defender: it grows smoothly with that edge up to `SEVER_MAX`; an axe bites deeper.
 */
export function severChance(kind: AttackKind, attacker: Readonly<Fighter>, defender: Readonly<Fighter>, guarding = defender.guarding): number {
  if (guarding || (kind !== 'power' && kind !== 'charge')) return 0;
  if (!defender.shield || defender.shield.health <= 0) return 0;
  const edge = attacker.attributes.might - defender.attributes.might;
  if (edge <= 0) return 0;
  const axe = attacker.weapon?.family === 'axe' ? 1.5 : 1;
  return Math.min(SEVER_MAX, edge * SEVER_PER_MIGHT * axe);
}

/** Percentage points to block a landed strike while guarding: full behind a whole shield, less with the blade alone. */
export function blockChance(fighter: Readonly<Fighter>): number {
  const shielded = fighter.shield !== undefined && fighter.shield.health > 0;
  return shielded ? fighter.stats.blockChance : Math.round(fighter.stats.blockChance * PARRY_SHARE);
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
    const movement = action === 'step_forward' || action === 'step_back' || action === 'jump' || action === 'charge';
    const energyCost = counter ? 0 : Math.max(0, ENERGY_COSTS[action] - (movement ? fighter.skillRules.moveDiscount : 0));
    if (energyCost > fighter.energy || !isInRange(action, active, fighter.position, distance, meleeRange, movementMultiplier)) continue;
    if (action === 'net' && !fighter.net) continue;

    if (isTechnique(action)) {
      // a Master's technique (#295): known, and enough Rhythm to pay for it
      const rhythmCost = TECHNIQUE_RULES[action].rhythm;
      if (!fighter.techniques?.includes(action) || (fighter.rhythm ?? 0) < rhythmCost) continue;
      const strike = TECHNIQUE_RULES[action].strike;
      // the blow's chance after the Rhythm is spent (no Seventh Step in a technique)
      const paid = { ...fighter, rhythm: (fighter.rhythm ?? 0) - rhythmCost };
      options.push({
        action, energyCost, rhythmCost,
        ...(strike && { hitChance: hitChance(strike, paid, opponent) }),
        ...(action === 'stone_guard' && { blockChance: blockChance(fighter) }),
      });
    } else if (action === 'net') options.push({ action, energyCost, hitChance: netHitChance(fighter, opponent) });
    else options.push(isAttack(action)
      ? { action, energyCost, hitChance: hitChance(action, fighter, opponent), ...(counter ? { counter: true } : {}) }
      : action === 'block' ? { action, energyCost, blockChance: blockChance(fighter) } : { action, energyCost });
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
    case 'net':
      return distance <= NET_RANGE;
    case 'burning_edge':
      return distance <= meleeRange;
    // the step closes in first: a blow from one step beyond reach
    case 'feint_step':
      return distance <= meleeRange + STEP_DISTANCE * movementMultiplier;
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
  // the Seventh Step (#294): the blow cannot miss
  if (onSeventhStep(attacker.rhythm)) return 100;
  // behind the Sand Veil (#295) the defender is harder to find
  const veil = defender.veiled ? SAND_VEIL_EVASION : 0;
  const base = attackHitChance(kind, attacker.stats, defender.stats, attacker.tauntPenalty + accuracyPenalty + targetingPenalty + veil);
  return protectedHitChance(base, attacker.consecutiveMisses);
}

/**
 * Chance (percentage points) that the thrown net catches the target (#258): a nimbler thrower catches more often, a
 * nimbler target slips it. A taunt or fear spoils the throw like a blow. A raised guard does not stop a net.
 */
export function netHitChance(thrower: Readonly<Fighter>, target: Readonly<Fighter>): number {
  const { accuracyPenalty } = statusModifiers(thrower.statuses);
  const chance = NET_BASE_CHANCE + NET_PER_AGILITY * (thrower.attributes.agility - target.attributes.agility)
    - thrower.tauntPenalty - accuracyPenalty;
  return Math.max(5, Math.min(95, chance));
}

export function getCombatSlotOptions(state: CombatState): CombatSlotOption[] {
  if (state.winner !== null) return [];
  const { active } = state;
  const fighter = state.fighters[active];
  return combatSlotOptions(fighter.slots, active, opposingSide(active), fighter.energy, fighter.attributes.arcana, fighter.skillRules.spellDiscount);
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
  if (item.clears) target.statuses = target.statuses.filter(({ kind }) => kind !== item.clears);
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
  const rhythmBefore = fighter.rhythm;
  if (isTechnique(action)) {
    // the technique spends its Rhythm first (#295), so a blow struck with it never rides the Seventh Step
    const cost = option.rhythmCost ?? TECHNIQUE_RULES[action].rhythm;
    fighter.rhythm = clampRhythm((fighter.rhythm ?? 0) - cost);
    events.push({ type: 'technique', fighter: side, technique: action, rhythm: cost });
  }
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
    case 'net': {
      // one net a bout (#258): thrown, caught or not, it is gone and the trident fights alone
      const chance = option.hitChance ?? 0;
      const hit = roll() < chance;
      fighter.net = false;
      if (hit) opponent.statuses = applyStatus(opponent.statuses, 'netted', opponent.statusResistances);
      events.push({ type: 'net', actor: side, target: other, hitChance: chance, hit });
      break;
    }
    case 'feint_step':
      // the feint draws the guard out (#295): the blow that follows cannot be blocked, so it earns no counter
      move(side, fighter, 'step_forward', fighter.position + direction * Math.min(STEP_DISTANCE * movementMultiplier, distance), events);
      opponent.guarding = false;
      opponent.stoneGuard = false;
      break;
    case 'stone_guard':
      fighter.guarding = true;
      fighter.stoneGuard = true;
      events.push({ type: 'block', fighter: side });
      break;
    case 'sand_veil':
      fighter.veiled = true;
      move(side, fighter, 'step_back', fighter.position - direction * SAND_VEIL_STEP * movementMultiplier, events);
      break;
  }

  let attack: Extract<CombatEvent, { type: 'attack' }> | undefined;
  const strike = strikeOf(action);
  if (strike) {
    const traits = weaponMove(strike, fighter.weapon);
    const veiled = opponent.veiled === true;
    attack = resolveAttack(strike, side, fighter, opponent, traits, roll, zone);
    fighter.consecutiveMisses = attack.hit ? 0 : Math.min(MAX_PROTECTED_MISSES, fighter.consecutiveMisses + 1);
    if (option.counter) attack.counter = true;
    if (isTechnique(action)) attack.technique = action;
    events.push(attack);
    // a blow that missed the Sand Veil (#295) leaves sand in the attacker's eyes for its next turn
    if (veiled && !attack.hit) fighter.statuses = applyStatus(fighter.statuses, 'blinded', fighter.statusResistances);
    if (attack.damage > 0 && opponent.health > 0) {
      if (traits.status) opponent.statuses = applyStatus(opponent.statuses, traits.status, opponent.statusResistances);
      // Burning Edge (#295): the blow sets the opponent on fire
      if (action === 'burning_edge') opponent.statuses = applyStatus(opponent.statuses, 'burning', opponent.statusResistances);
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

  updateRhythm(side, fighter, rhythmBefore, other, opponent, action, option.counter === true, attack, events);

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

/**
 * The Rhythm after an action (#294): the actor's decision, and the defender's dodge or critical wound. An attack made
 * on the Seventh Step spends it: the actor starts again from 0.
 */
function updateRhythm(
  side: FighterSide, fighter: Fighter, before: number | undefined, other: FighterSide, opponent: Fighter, action: CombatAction,
  counter: boolean, attack: Extract<CombatEvent, { type: 'attack' }> | undefined, events: CombatEvent[],
) {
  const previous = fighter.lastAction;
  fighter.lastAction = action;
  if (fighter.rhythm !== undefined) {
    // `before`: the Rhythm as the turn began; a technique (#295) has already spent its part of it
    const from = before ?? fighter.rhythm;
    const paid = fighter.rhythm;
    const moved = events.some((e) => e.type === 'move' && e.fighter === side && e.kind !== 'knockback' && e.kind !== 'charge');
    const to = attack && onSeventhStep(paid)
      ? 0
      : clampRhythm(paid + actorRhythm({ action, previous, counter, moved, hit: (attack?.damage ?? 0) > 0 }));
    fighter.rhythm = to;
    if (to !== from) events.push({ type: 'rhythm', fighter: side, from, to });
  }
  if (attack && opponent.rhythm !== undefined && opponent.health > 0) {
    const from = opponent.rhythm;
    const to = clampRhythm(from + defenderRhythm(attack));
    opponent.rhythm = to;
    if (to !== from) events.push({ type: 'rhythm', fighter: other, from, to });
  }
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
    // the techniques' stances (#295) last until the fighter's own next turn, like the guard
    if (fighter.stoneGuard) fighter.stoneGuard = false;
    if (fighter.veiled) fighter.veiled = false;
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
    attackPower: attacker.stats.attackPower * traits.damageMultiplier * crowdDamageMultiplier(attacker.crowd)
      * (kind === 'charge' ? 1 + attacker.skillRules.chargePower / 100 : 1),
  };
  const defense = {
    ...defender.stats,
    // an aimed blow meets only the armour on that zone
    armour: (zone ? defender.armourByZone[zone] : defender.stats.armour)
      * statusModifiers(defender.statuses).armourMultiplier * traits.armourMultiplier,
  };
  const strikes: AttackStrike[] = [];
  let shield: { from: number; to: number } | undefined;
  // the guard as the attack begins (#275): a strike that broke the guard does not count as an unguarded arm
  const guardedAtStart = defender.guarding;
  let severed = false;

  for (let i = 0; i < traits.strikes && defender.health > 0; i++) {
    const hit = roll() < chance;
    // A defensive stance can block an incoming strike; a skilled block may earn a free counter. Crits need an unblocked hit.
    // behind a whole shield at the full chance, with the blade alone at less (#274); the shield's state before this strike
    const blocked = hit && defender.guarding && roll() < blockChance(defender);
    // Stone Guard (#295): a block made in it always earns the counter
    if (blocked && defender.stoneGuard) defender.counterReady = true;
    if (blocked && !defender.counterReady) {
      const chanceToCounter = Math.min(70, counterChance(defender.attributes.guard) + defender.skillRules.counterBonus);
      if (chanceToCounter > 0 && roll() < chanceToCounter) defender.counterReady = true;
    }
    // a shield takes the blocked blow's force off its own health (#273); once broken the arm blocks alone (weaker in #274)
    if (blocked && defender.shield && defender.shield.health > 0) {
      const from = defender.shield.health;
      const to = Math.max(0, from - shieldDamage(kind, offense));
      defender.shield = { ...defender.shield, health: to };
      shield = { from: shield?.from ?? from, to };
    }
    const crit = hit && !blocked && roll() < attacker.stats.criticalChance;
    const damage = hit && !blocked ? Math.min(defender.health, attackDamage(kind, offense, defense, crit)) : 0;
    defender.health -= damage;
    // a heavy blow on an unguarded shield arm may take it off (#275); no roll at all when there is no chance,
    // so every other bout draws exactly the same numbers as before
    if (damage > 0 && defender.health > 0 && !severed) {
      const chance = severChance(kind, attacker, defender, guardedAtStart);
      if (chance > 0 && roll() < chance) {
        severed = true;
        defender.shield = { ...defender.shield!, health: 0 };
        defender.statuses = applyStatus(defender.statuses, 'torn', defender.statusResistances);
        // and the stump keeps bleeding to the end of the bout (#332): no resistance, no cure
        defender.statuses = applyStatus(defender.statuses, 'bleeding');
      }
    }
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
    ...(shield ? { shield } : {}),
    ...(severed ? { severed: true as const } : {}),
  };
}
