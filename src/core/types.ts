import type { SkillId } from '../data/skills';
import type { SkillRules } from './skills';
import type { WeaponEnchantment } from './enchant';
import type { Item } from '../data/equipment';
import type { HitZone, ZonedArmour } from './hitZones';
import type { CrowdGift, CrowdStanding } from './crowd';
import type { CombatItemId, CombatSlots } from './spells';
import type { StatusEffect, StatusResistances, StatusTick } from './status';
import type { CombatWeapon } from './weapons';
import type { TechniqueId } from './techniques';

export type FighterSide = 'player' | 'enemy';
export type AttackKind = 'quick' | 'normal' | 'power' | 'charge';
export type MoveKind = 'step_forward' | 'step_back' | 'jump' | 'charge' | 'knockback';
export type CombatAction = AttackKind | Exclude<MoveKind, 'knockback'> | 'block' | 'rest' | 'taunt' | 'net' | TechniqueId;

export interface Attributes {
  might: number;
  agility: number;
  precision: number;
  guard: number;
  vitality: number;
  stamina: number;
  charm: number;
  arcana: number;
}

export type HandSlot = 'weapon' | 'offHand';
export type EquipmentSlot = Item['slot'] | HandSlot;
export type ArmourImprovements = Partial<Record<Item['slot'], number>>;
export type EquipmentLoadout = Partial<Record<Item['slot'], number>> & Partial<Record<HandSlot, string>> & {
  improvements?: ArmourImprovements;
};

export interface FighterSetup {
  name?: string;
  level?: number;
  health?: number;
  attributes?: Partial<Attributes>;
  equipment?: EquipmentLoadout;
  weapon?: string;
  statusResistances?: StatusResistances;
  slots?: CombatSlots;
  /** `false` fights without Rhythm (#294): the balance tools measure what it changes */
  rhythm?: boolean;
  /** the Masters' techniques this fighter knows (#295); they need Rhythm, so `rhythm: false` leaves them out */
  techniques?: readonly TechniqueId[];
  skills?: readonly SkillId[];
  position?: number;
}

export interface FighterStats {
  maxHealth: number;
  maxEnergy: number;
  armour: number;
  weight: number;
  attackPower: number;
  accuracyBonus: number;
  evasionBonus: number;
  blockChance: number;
  criticalChance: number;
  jumpDistance: number;
  restRecovery: number;
  tauntPenalty: number;
  /** Percentage discount, capped at 25. */
  shopDiscount: number;
  spellPower: number;
}

/** The off-hand shield in a bout (#273): blocks take its health; at 0 it is broken until the bout ends. */
export interface FighterShield {
  readonly id: string;
  readonly tier: number;
  readonly health: number;
  readonly maxHealth: number;
}

export interface Fighter {
  name: string;
  level: number;
  attributes: Readonly<Attributes>;
  stats: Readonly<FighterStats>;
  armourByZone: ZonedArmour;
  weapon?: CombatWeapon;
  /** a shield in the off hand; a two-handed weapon (spear, hammer) leaves no hand for one */
  shield?: FighterShield;
  /** the trident's net still in the other hand (#258): one throw a bout, then the trident fights alone */
  net?: boolean;
  position: number;
  health: number;
  energy: number;
  guarding: boolean;
  counterReady: boolean;
  tauntPenalty: number;
  consecutiveMisses: number;
  /** Rhythm 0-100 (#294); at 100 the next attack cannot miss. Undefined = this fighter has no Rhythm */
  rhythm?: number;
  /** the fighter's last action, for the Rhythm's variety and repetition */
  lastAction?: CombatAction;
  /** the Masters' techniques this fighter can use (#295) */
  techniques?: readonly TechniqueId[];
  /** Stone Guard raised (#295): a block made in it always earns the counter; drops with the guard */
  stoneGuard?: boolean;
  /** behind the Sand Veil (#295) until its next turn: blows are harder to land, a miss blinds the attacker */
  veiled?: boolean;
  crowd: CrowdStanding;
  statuses: readonly StatusEffect[];
  statusResistances: StatusResistances;
  slots: CombatSlots;
  skillRules: SkillRules;
}

export interface CombatState {
  readonly fighters: Readonly<Record<FighterSide, Readonly<Fighter>>>;
  readonly active: FighterSide;
  readonly winner: FighterSide | null;
  readonly rewards?: { readonly experience: number };
  readonly rngState: number;
}

export interface ActionOption {
  action: CombatAction;
  energyCost: number;
  /** Percentage from 5 to 100 for attacks; for the net throw (#258), the chance to catch the opponent. */
  hitChance?: number;
  /** Percentage to block a landed strike, for the Block action (#274): lower without a whole shield. */
  blockChance?: number;
  counter?: true;
  /** Rhythm the action spends, for the Masters' techniques (#295) */
  rhythmCost?: number;
}

export interface AttackStrike {
  readonly hit: boolean;
  readonly crit: boolean;
  readonly blocked: boolean;
  readonly damage: number;
}

export type CombatEvent =
  | { type: 'move'; fighter: FighterSide; kind: MoveKind; from: number; to: number }
  | {
      type: 'attack';
      actor: FighterSide;
      target: FighterSide;
      kind: AttackKind;
      zone?: HitZone;
      hitChance: number;
      hit: boolean;
      crit: boolean;
      blocked: boolean;
      counter?: true;
      damage: number;
      strikes?: readonly AttackStrike[];
      /** the blocking shield's health before and after the blow (#273); `to: 0` = it broke */
      shield?: { readonly from: number; readonly to: number };
      /** the blow took off the defender's shield arm (#275): the shield is gone and the stump bleeds */
      severed?: true;
      /** struck with a Master's technique (#295): Feint Step (cannot be blocked) or Burning Edge (sets on fire) */
      technique?: TechniqueId;
    }
  | { type: 'energy'; fighter: FighterSide; from: number; to: number }
  /** the Rhythm moved (#294); `to: 100` = the Seventh Step, a drop to 0 after an attack = the step was used */
  | { type: 'rhythm'; fighter: FighterSide; from: number; to: number }
  /** a Master's technique (#295), before what it does (a step, a guard, a blow); `rhythm` = the Rhythm it spent */
  | { type: 'technique'; fighter: FighterSide; technique: TechniqueId; rhythm: number }
  | { type: 'block'; fighter: FighterSide }
  | { type: 'rest'; fighter: FighterSide; restored: number }
  | { type: 'taunt'; actor: FighterSide; target: FighterSide; penalty: number }
  /** the trident's net thrown (#258); `hit` = the target is caught (`netted`) and loses its next turn */
  | { type: 'net'; actor: FighterSide; target: FighterSide; hitChance: number; hit: boolean }
  | { type: 'crowd_gift'; fighter: FighterSide; gift: CrowdGift; amount: number }
  | ({ type: 'status'; fighter: FighterSide } & StatusTick)
  | { type: 'slot'; actor: FighterSide; target: FighterSide; slot: number; item: CombatItemId; healthDelta: number }
  | ({ type: 'elemental'; actor: FighterSide; target: FighterSide; damage: number } & WeaponEnchantment)
  | { type: 'death'; fighter: FighterSide; winner: FighterSide }
  | { type: 'turn'; fighter: FighterSide };

export type ActionResult =
  | { ok: true; state: CombatState; events: CombatEvent[] }
  | { ok: false; state: CombatState; events: []; reason: 'unavailable' | 'finished' };
