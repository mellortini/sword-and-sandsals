import type { Item } from '../data/equipment';

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

export type EquipmentLoadout = Partial<Record<Item['slot'], number>>;

export interface FighterSetup {
  name?: string;
  attributes?: Partial<Attributes>;
  equipment?: EquipmentLoadout;
  position?: number;
}

export interface FighterStats {
  maxHealth: number;
  maxEnergy: number;
  armour: number;
  weight: number;
}

export interface Fighter {
  name: string;
  attributes: Readonly<Attributes>;
  stats: Readonly<FighterStats>;
  position: number;
  health: number;
  energy: number;
  guarding: boolean;
  tauntPenalty: number;
}

export interface CombatState {
  readonly fighters: Readonly<Record<FighterSide, Readonly<Fighter>>>;
  readonly active: FighterSide;
  readonly winner: FighterSide | null;
  readonly rngState: number;
}

export interface ActionOption {
  action: CombatAction;
  energyCost: number;
  /** Percentage from 5 to 95 for attacks. */
  hitChance?: number;
}

export type CombatEvent =
  | { type: 'move'; fighter: FighterSide; kind: MoveKind; from: number; to: number }
  | {
      type: 'attack';
      actor: FighterSide;
      target: FighterSide;
      kind: AttackKind;
      hitChance: number;
      hit: boolean;
      crit: boolean;
      blocked: boolean;
      damage: number;
    }
  | { type: 'energy'; fighter: FighterSide; from: number; to: number }
  | { type: 'block'; fighter: FighterSide }
  | { type: 'rest'; fighter: FighterSide; restored: number }
  | { type: 'taunt'; actor: FighterSide; target: FighterSide; penalty: number }
  | { type: 'death'; fighter: FighterSide; winner: FighterSide }
  | { type: 'turn'; fighter: FighterSide };

export type ActionResult =
  | { ok: true; state: CombatState; events: CombatEvent[] }
  | { ok: false; state: CombatState; events: []; reason: 'unavailable' | 'finished' };
