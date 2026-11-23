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
