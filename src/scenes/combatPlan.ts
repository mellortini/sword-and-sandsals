/**
 * Pure part of the combat presenter: turns the event list from `performAction` into presentation steps
 * and maps logical arena positions to screen x. No Pixi here, so it is unit-tested.
 */
import type { CombatItemId } from '../core/spells';
import type { CombatEvent, FighterSide, MoveKind } from '../core/types';

type AttackEvent = Extract<CombatEvent, { type: 'attack' }>;
type MoveEvent = Extract<CombatEvent, { type: 'move' }>;

export type Step =
  /**
   * a fighter travels; `strike` is set for a charge that ends in an attack.
   * `push` (here and on an attack) is the knockback the blow causes: the defender flies back on the hit frame,
   * while the attacker's clip is still playing
   */
  | { kind: 'move'; side: FighterSide; move: MoveKind; from: number; to: number; strike?: AttackEvent; fatal?: boolean; push?: MoveEvent }
  | { kind: 'attack'; attack: AttackEvent; fatal: boolean; push?: MoveEvent }
  | { kind: 'pose'; side: FighterSide; clip: 'guard_up' | 'rest' | 'taunt' }
  /** the trident's net thrown (#258): `hit` = the target is caught */
  | { kind: 'net'; side: FighterSide; target: FighterSide; hit: boolean }
  /** a potion or spell from a combat slot (#191): `healthDelta` is applied to `target` */
  | { kind: 'item'; side: FighterSide; target: FighterSide; item: CombatItemId; healthDelta: number }
  | { kind: 'death'; side: FighterSide; winner: FighterSide };

/**
 * Fight staging shared by the arena, ?view=aifight and the animation lab (#151).
 * contact 215 px = 5.7 rig units between the pelvises at logical distance 0: close, but the bodies never overlap.
 * 60 px per logical unit (#36) so weapon reach reads on screen: a hammer strikes from logical 1.5 (8.0 units),
 * a sword from 2 (8.8), a spear from 3 (10.4). Logical 0..20 spans 1200 px; the default 6 / 14 start is centred.
 */
export const FIGHT_LAYOUT: Layout = { left: 252, px: 60, contact: 215 };

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
  /** the knockback of the attack at `at` (only the weapon's elemental damage can come in between) and its index */
  const knockbackAfter = (at: number, target: FighterSide): { push: MoveEvent; index: number } | undefined => {
    let j = at + 1;
    while (events[j]?.type === 'elemental') j++;
    const e = events[j];
    return e?.type === 'move' && e.kind === 'knockback' && e.fighter === target ? { push: e, index: j } : undefined;
  };
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    switch (e.type) {
      case 'move': {
        const next = events[i + 1];
        const m: MoveEvent = e;
        if (m.kind === 'charge' && next?.type === 'attack' && next.kind === 'charge') {
          i++;
          const knock = knockbackAfter(i, next.target);
          steps.push({ kind: 'move', side: m.fighter, move: m.kind, from: m.from, to: m.to, strike: next, fatal: dies.has(next.target), ...(knock ? { push: knock.push } : {}) });
          if (knock) i = knock.index;
        } else {
          steps.push({ kind: 'move', side: m.fighter, move: m.kind, from: m.from, to: m.to });
        }
        break;
      }
      case 'attack': {
        const knock = knockbackAfter(i, e.target);
        steps.push({ kind: 'attack', attack: e, fatal: dies.has(e.target), ...(knock ? { push: knock.push } : {}) });
        if (knock) i = knock.index;
        break;
      }
      case 'block':
        // the guard goes up and stays up (#273): the presenter holds it until the blow or the end of the guard
        steps.push({ kind: 'pose', side: e.fighter, clip: 'guard_up' });
        break;
      case 'rest':
        steps.push({ kind: 'pose', side: e.fighter, clip: 'rest' });
        break;
      case 'taunt':
        steps.push({ kind: 'pose', side: e.actor, clip: 'taunt' });
        break;
      case 'net':
        steps.push({ kind: 'net', side: e.actor, target: e.target, hit: e.hit });
        break;
      case 'slot':
        steps.push({ kind: 'item', side: e.actor, target: e.target, item: e.item, healthDelta: e.healthDelta });
        break;
      case 'death':
        steps.push({ kind: 'death', side: e.fighter, winner: e.winner });
        break;
      // 'energy' and 'turn' have no animation: the presenter applies them to the HUD state directly
    }
  }
  return steps;
}
