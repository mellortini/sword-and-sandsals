import type { Item } from '../data/equipment';
import type { HitZone, ZonedArmour } from './hitZones';
import type { CrowdGift, CrowdStanding } from './crowd';
import type { CombatItemId, CombatSlots } from './spells';
import type { StatusEffect, StatusResistances, StatusTick } from './status';
import type { CombatWeapon } from './weapons';

export type FighterSide = 'player' | 'enemy';
export type AttackKind = 'quick' | 'normal' | 'power' | 'charge';
export type MoveKind = 'step_forward' | 'step_back' | 'jump' | 'charge' | 'knockback';
export type CombatAction = AttackKind | Exclude<MoveKind, 'knockback'> | 'block' | 'rest' | 'taunt';

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
export type EquipmentLoadout = Partial<Record<Item['slot'], number>> & Partial<Record<HandSlot, string>>;

export interface FighterSetup {
  name?: string;
  level?: number;
  attributes?: Partial<Attributes>;
  equipment?: EquipmentLoadout;
  weapon?: string;
  statusResistances?: StatusResistances;
  slots?: CombatSlots;
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

export interface Fighter {
  name: string;
  level: number;
  attributes: Readonly<Attributes>;
  stats: Readonly<FighterStats>;
  armourByZone: ZonedArmour;
  weapon?: CombatWeapon;
  position: number;
  health: number;
  energy: number;
  guarding: boolean;
  counterReady: boolean;
  tauntPenalty: number;
  consecutiveMisses: number;
  crowd: CrowdStanding;
  statuses: readonly StatusEffect[];
  statusResistances: StatusResistances;
  slots: CombatSlots;
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
  /** Percentage from 5 to 100 for attacks. */
  hitChance?: number;
  counter?: true;
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
    }
  | { type: 'energy'; fighter: FighterSide; from: number; to: number }
  | { type: 'block'; fighter: FighterSide }
  | { type: 'rest'; fighter: FighterSide; restored: number }
  | { type: 'taunt'; actor: FighterSide; target: FighterSide; penalty: number }
  | { type: 'crowd_gift'; fighter: FighterSide; gift: CrowdGift; amount: number }
  | ({ type: 'status'; fighter: FighterSide } & StatusTick)
  | { type: 'slot'; actor: FighterSide; target: FighterSide; slot: number; item: CombatItemId; healthDelta: number }
  | { type: 'death'; fighter: FighterSide; winner: FighterSide }
  | { type: 'turn'; fighter: FighterSide };

export type ActionResult =
  | { ok: true; state: CombatState; events: CombatEvent[] }
  | { ok: false; state: CombatState; events: []; reason: 'unavailable' | 'finished' };
