/**
 * Clip variants for the two-handed weapons (#36). The Animator plays `attack_normal@hammer` instead of
 * `attack_normal` when the fighter holds a hammer, and so on; clips without a variant (walk, block, hit, …) stay shared.
 * The back arm is not animated here: the rig bends it so the back hand holds the haft (src/rig/twoHand.ts).
 *  - hammer: a war maul, both hands; every attack comes down from over the head onto the enemy's head and shoulders
 *  - spear: both hands, raised at rest; attacks are level thrusts from further away than a sword can reach
 *
 * Front-arm angles were solved for where the hands must be (rig units ahead of the pelvis): spear thrust hands
 * 4.0-4.5, point 10.6-11.1 ahead (the spear is held at the butt); hammer hands 4.0-4.4 at the hit, head centre ~7.2-7.6 ahead at head height.
 * `reach` = pelvis gap at which this blow lands minus the sword's STRIKE_GAP for that attack (src/scenes/combatPlan.ts):
 * the lunge is shortened by that much, so the point / head lands on the body instead of passing through it.
 * Angles in degrees CCW, 'blade' = world angle of the weapon; same timing rules as clips.ts (hit early, held follow-through).
 */
import type { Pose } from '../rig/PaperRig';
import type { Clip } from './clip';

const LEGS: Pose = { leg_f_up: 16, leg_f_lo: -6, leg_b_up: -14, leg_b_lo: 4 };
const LUNGE: Pose = { leg_f_up: 46, leg_f_lo: -40, leg_b_up: -32, leg_b_lo: 8 };
const DEEP_LUNGE: Pose = { leg_f_up: 52, leg_f_lo: -47, leg_b_up: -38, leg_b_lo: 10 };

/** ready with the maul: held upright in front of the chest, head above the shoulder */
export const HAMMER_READY: Pose = { torso: 4, head: -3, arm_f_up: -4, arm_f_lo: 128, hand_f: 0, blade: 70, ...LEGS };
/** ready with the spear: raised at 50 degrees, so the point stays clear of an enemy standing at melee distance */
export const SPEAR_READY: Pose = { torso: 2, head: -2, arm_f_up: 13, arm_f_lo: 120, hand_f: 0, blade: 50, ...LEGS };

export const WEAPON_CLIPS: Clip[] = [
  // ------------------------------------------------------------------ hammer
  {
    name: 'idle@hammer', length: 60, loop: true,
    keys: [
      { f: 0, pose: HAMMER_READY },
      { f: 30, pose: { torso: 5.5, head: -4.5, arm_f_up: -2, arm_f_lo: 129, blade: 68 } },
      { f: 60, pose: HAMMER_READY },
    ],
  },
  {
    // short chop: the maul is already up on frame 0, falls on the enemy's head on frame 2
    name: 'attack_quick@hammer', length: 16, reach: 2.3,
    events: [{ f: 2, type: 'hit' }],
    keys: [
      { f: 0, x: 0.3, ease: 'step', pose: { torso: 6, head: 2, arm_f_up: 150, arm_f_lo: 30, hand_f: 6, blade: 118 } },
      { f: 2, x: 0.55, ease: 'in', pose: { torso: -16, head: -6, arm_f_up: 80, arm_f_lo: 109, hand_f: 0, blade: 25, ...LUNGE } },
      { f: 8, x: 0.6, pose: { torso: -16, arm_f_up: 66, arm_f_lo: 118, blade: 12 } },
      { f: 16, x: 0, pose: HAMMER_READY },
    ],
  },
  {
    // overhead smash: raised behind the head on frame 0, down on the enemy on frame 3
    name: 'attack_normal@hammer', length: 20, reach: 2.1,
    events: [{ f: 3, type: 'hit' }],
    keys: [
      { f: 0, x: 0.35, ease: 'step', pose: { torso: 10, head: 4, arm_f_up: 170, arm_f_lo: 22, hand_f: 10, blade: 150 } },
      { f: 3, x: 0.9, ease: 'in', pose: { torso: -20, head: -8, arm_f_up: 89, arm_f_lo: 104, hand_f: 0, blade: 25, ...LUNGE } },
      { f: 11, x: 0.95, pose: { torso: -20, arm_f_up: 68, arm_f_lo: 120, blade: 10 } },
      { f: 20, x: 0, pose: HAMMER_READY },
    ],
  },
  {
    // the big one: a long wind-up with the head hanging behind the back, then the whole body comes down with it
    name: 'attack_power@hammer', length: 32, reach: 1.7,
    events: [{ f: 7, type: 'swing' }, { f: 10, type: 'hit' }],
    keys: [
      { f: 0, pose: HAMMER_READY },
      { f: 7, x: -0.15, ease: 'out', pose: { torso: 16, head: 8, arm_f_up: 178, arm_f_lo: 34, hand_f: 14, blade: 178, leg_f_up: 22, leg_f_lo: -8 } },
      { f: 10, x: 1.0, ease: 'in', pose: { torso: -26, head: -10, arm_f_up: 99, arm_f_lo: 101, hand_f: 0, blade: 25, ...DEEP_LUNGE } },
      { f: 21, x: 1.05, pose: { torso: -26, arm_f_up: 75, arm_f_lo: 120, blade: 8 } },
      { f: 32, x: 0, pose: HAMMER_READY },
    ],
  },
  // ------------------------------------------------------------------ spear
  {
    name: 'idle@spear', length: 60, loop: true,
    keys: [
      { f: 0, pose: SPEAR_READY },
      { f: 30, pose: { torso: 3.5, head: -3.5, arm_f_up: 15, arm_f_lo: 121, blade: 48 } },
      { f: 60, pose: SPEAR_READY },
    ],
  },
  {
    // quick jab: lowered on frame 0, the arms drive it on frame 1
    name: 'attack_quick@spear', length: 12, reach: 5.7,
    events: [{ f: 1, type: 'hit' }],
    keys: [
      { f: 0, x: 0.1, ease: 'step', pose: { torso: 6, arm_f_up: -10, arm_f_lo: 124, blade: 6 } },
      { f: 1, x: 0.4, ease: 'out', pose: { torso: -10, head: -3, arm_f_up: 26, arm_f_lo: 108, blade: 1, leg_f_up: 30, leg_f_lo: -18 } },
      { f: 5, x: 0.42, pose: { torso: -10 } },
      { f: 12, x: 0, pose: SPEAR_READY },
    ],
  },
  {
    // thrust: drawn back level on frame 0, driven through on frame 2
    name: 'attack_normal@spear', length: 16, reach: 5.5,
    events: [{ f: 2, type: 'hit' }],
    keys: [
      { f: 0, x: 0, ease: 'step', pose: { torso: 8, head: 2, arm_f_up: -14, arm_f_lo: 124, blade: 6 } },
      { f: 2, x: 0.8, ease: 'out', pose: { torso: -16, head: -4, arm_f_up: 35, arm_f_lo: 111, blade: 1, ...LUNGE } },
      { f: 9, x: 0.85, pose: { torso: -15 } },
      { f: 16, x: 0, pose: SPEAR_READY },
    ],
  },
  {
    // power thrust: a deep draw-back, then a full lunge behind the point
    name: 'attack_power@spear', length: 26, reach: 5.2,
    events: [{ f: 5, type: 'swing' }, { f: 7, type: 'hit' }],
    keys: [
      { f: 0, pose: SPEAR_READY },
      { f: 5, x: -0.3, ease: 'out', pose: { torso: 14, head: 6, arm_f_up: -35, arm_f_lo: 126, hand_f: 0, blade: 10, leg_f_up: 22, leg_f_lo: -8, leg_b_up: -20 } },
      { f: 7, x: 1.1, ease: 'in', pose: { torso: -24, head: -6, arm_f_up: 46, arm_f_lo: 111, hand_f: 0, blade: 0, ...DEEP_LUNGE } },
      { f: 16, x: 1.15, pose: { torso: -23 } },
      { f: 26, x: 0, pose: SPEAR_READY },
    ],
  },
];

const ARMS = ['torso', 'head', 'arm_f_up', 'arm_f_lo', 'hand_f', 'blade'] as const;

/**
 * Walking with a two-handed weapon: the shared walk clips with the arms (and the torso / head lean) of the weapon's
 * ready stance on every key. Without this the walk starts from the sword stance and the maul swings into the enemy.
 */
export function heldWalks(clips: readonly Clip[]): Clip[] {
  const out: Clip[] = [];
  for (const [family, ready] of [['hammer', HAMMER_READY], ['spear', SPEAR_READY]] as const) {
    const arms: Pose = Object.fromEntries(ARMS.map((k) => [k, ready[k] ?? 0]));
    for (const c of clips.filter((x) => x.name === 'walk_fwd' || x.name === 'walk_back')) {
      out.push({ ...c, name: `${c.name}@${family}`, keys: c.keys.map((k) => ({ ...k, pose: { ...(k.pose ?? {}), ...arms } })) });
    }
  }
  return out;
}
