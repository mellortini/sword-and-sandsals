/**
 * Pure part of the combat presenter: turns the event list from `performAction` into presentation steps
 * and maps logical arena positions to screen x. No Pixi here, so it is unit-tested.
 */
import type { CombatEvent, FighterSide, MoveKind } from '../core/types';

type AttackEvent = Extract<CombatEvent, { type: 'attack' }>;
type MoveEvent = Extract<CombatEvent, { type: 'move' }>;

export type Step =
  /** a fighter travels; `strike` is set for a charge that ends in an attack */
  | { kind: 'move'; side: FighterSide; move: MoveKind; from: number; to: number; strike?: AttackEvent; fatal?: boolean }
  | { kind: 'attack'; attack: AttackEvent; fatal: boolean }
  | { kind: 'pose'; side: FighterSide; clip: 'block' | 'rest' | 'taunt' }
  | { kind: 'death'; side: FighterSide; winner: FighterSide };

/**
 * Fight staging shared by the arena, ?view=aifight and the animation lab (#151).
 * contact 215 px = 5.7 rig units between the pelvises at logical distance 0: close, but the bodies never overlap,
 * melee range (logical 2) = 6.7 units. Logical 0..20 spans 400 px, centred on the 1920 px stage.
 */
export const FIGHT_LAYOUT: Layout = { left: 652, px: 20, contact: 215 };

/**
 * Where a strike lands, in rig units between the pelvises at the deepest point of the attack's lunge.
 * The presenter stretches or shortens each attack's lunge to reach exactly this, so a hit reads as a hit from any
 * melee distance and nobody steps through the opponent.
 */
export const STRIKE_GAP: Readonly<Record<'quick' | 'normal' | 'power' | 'charge', number>> = {
  // the deeper the torso leans into the blow, the further the strike point (measured on the puppets, #151)
  quick: 4.9, normal: 5.3, power: 5.9, charge: 5.3,
};
/** shortest lunge, so even a strike from very close still moves forward */
export const MIN_LUNGE = 0.15;

export interface Layout {
  /** screen x of logical position 0 for the player (pelvis) */
  left: number;
  /** px per logical arena unit */
  px: number;
  /** extra px between the pelvises at logical distance 0 (bodies touch, swords reach) */
  contact: number;
}

/** pelvis x on screen; the enemy is shifted right by the contact gap so distance 0 means "touching" */
export function screenX(layout: Layout, side: FighterSide, position: number): number {
  return layout.left + position * layout.px + (side === 'enemy' ? layout.contact : 0);
}

/** +1 when a fighter walks towards the opponent: the player faces right, the enemy left */
export const facing = (side: FighterSide): 1 | -1 => (side === 'player' ? 1 : -1);

/** displacement in the fighter's own forward direction (what Animator `distance` expects), in logical units */
export function forwardDelta(side: FighterSide, from: number, to: number): number {
  return (to - from) * facing(side);
}

export function planSteps(events: readonly CombatEvent[]): Step[] {
  const steps: Step[] = [];
  const dies = new Set(events.filter((e) => e.type === 'death').map((e) => e.fighter));
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    switch (e.type) {
      case 'move': {
        const next = events[i + 1];
        const m: MoveEvent = e;
        if (m.kind === 'charge' && next?.type === 'attack' && next.kind === 'charge') {
          steps.push({ kind: 'move', side: m.fighter, move: m.kind, from: m.from, to: m.to, strike: next, fatal: dies.has(next.target) });
          i++;
        } else {
          steps.push({ kind: 'move', side: m.fighter, move: m.kind, from: m.from, to: m.to });
        }
        break;
      }
      case 'attack':
        steps.push({ kind: 'attack', attack: e, fatal: dies.has(e.target) });
        break;
      case 'block':
        steps.push({ kind: 'pose', side: e.fighter, clip: 'block' });
        break;
      case 'rest':
        steps.push({ kind: 'pose', side: e.fighter, clip: 'rest' });
        break;
      case 'taunt':
        steps.push({ kind: 'pose', side: e.actor, clip: 'taunt' });
        break;
      case 'death':
        steps.push({ kind: 'death', side: e.fighter, winner: e.winner });
        break;
      // 'energy' and 'turn' have no animation: the presenter applies them to the HUD state directly
    }
  }
  return steps;
}
