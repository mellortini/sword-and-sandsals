/**
 * Clip variants for the two-handed weapons (#36). The Animator plays `attack_normal@hammer` instead of
 * `attack_normal` when the fighter holds a hammer, and so on; clips without a variant (walk, block, hit, …) stay shared.
 * The back arm is not animated here: the rig bends it so the back hand holds the haft (src/rig/twoHand.ts).
 *  - hammer: a war maul, both hands; every attack comes down from over the head, the power blow winds up longest
 *  - spear: both hands, held level at the enemy; attacks are thrusts, and the spear strikes from further away (`reach`)
 * Angles in degrees CCW, 'blade' = world angle of the weapon; same timing rules as clips.ts (hit early, held follow-through).
 */
import type { Pose } from '../rig/PaperRig';
import type { Clip } from './clip';

const LEGS: Pose = { leg_f_up: 16, leg_f_lo: -6, leg_b_up: -14, leg_b_lo: 4 };
const LUNGE: Pose = { leg_f_up: 46, leg_f_lo: -40, leg_b_up: -32, leg_b_lo: 8 };
const DEEP_LUNGE: Pose = { leg_f_up: 52, leg_f_lo: -47, leg_b_up: -38, leg_b_lo: 10 };

/** ready stance with the maul: head up and forward, both hands on the haft in front of the chest */
const HAMMER_READY: Pose = { torso: 4, head: -3, arm_f_up: 38, arm_f_lo: 62, hand_f: 0, blade: 62, ...LEGS };
/** ready stance with the spear: level at the enemy's chest, front hand at the waist */
const SPEAR_READY: Pose = { torso: 2, head: -2, arm_f_up: 48, arm_f_lo: 40, hand_f: 0, blade: 6, ...LEGS };
/** how much further than a sword the spear's point reaches at the thrust (units) */
const SPEAR_REACH = 2.4;

export const WEAPON_CLIPS: Clip[] = [
  // ------------------------------------------------------------------ hammer
  {
    name: 'idle@hammer', length: 60, loop: true,
    keys: [
      { f: 0, pose: HAMMER_READY },
      { f: 30, pose: { torso: 5.5, head: -4.5, arm_f_up: 40, arm_f_lo: 64, blade: 60 } },
      { f: 60, pose: HAMMER_READY },
    ],
  },
  {
    // short chop: the maul is already up on frame 0, falls on frame 2
    name: 'attack_quick@hammer', length: 16,
    events: [{ f: 2, type: 'hit' }],
    keys: [
      { f: 0, x: 0.3, ease: 'step', pose: { torso: 6, head: 2, arm_f_up: 150, arm_f_lo: 30, hand_f: 6, blade: 118 } },
      { f: 2, x: 0.55, ease: 'in', pose: { torso: -22, head: -6, arm_f_up: 92, arm_f_lo: -6, hand_f: 0, blade: -4, ...LUNGE } },
      { f: 8, x: 0.6, pose: { torso: -20, arm_f_up: 80, blade: -30 } },
      { f: 16, x: 0, pose: HAMMER_READY },
    ],
  },
  {
    // overhead smash: raised behind the head on frame 0, down on the enemy on frame 3
    name: 'attack_normal@hammer', length: 20,
    events: [{ f: 3, type: 'hit' }],
    keys: [
      { f: 0, x: 0.35, ease: 'step', pose: { torso: 10, head: 4, arm_f_up: 170, arm_f_lo: 22, hand_f: 10, blade: 150 } },
      { f: 3, x: 0.9, ease: 'in', pose: { torso: -26, head: -8, arm_f_up: 94, arm_f_lo: -8, hand_f: 0, blade: -10, ...LUNGE } },
      { f: 11, x: 0.95, pose: { torso: -24, arm_f_up: 76, blade: -42 } },
      { f: 20, x: 0, pose: HAMMER_READY },
    ],
  },
  {
    // the big one: a long wind-up with the head hanging behind the back, then the whole body comes down with it
    name: 'attack_power@hammer', length: 32,
    events: [{ f: 7, type: 'swing' }, { f: 10, type: 'hit' }],
    keys: [
      { f: 0 },
      { f: 7, x: -0.15, ease: 'out', pose: { torso: 16, head: 8, arm_f_up: 178, arm_f_lo: 34, hand_f: 14, blade: 178, leg_f_up: 22, leg_f_lo: -8 } },
      { f: 10, x: 1.0, ease: 'in', pose: { torso: -32, head: -10, arm_f_up: 92, arm_f_lo: -10, hand_f: 0, blade: -16, ...DEEP_LUNGE } },
      { f: 14, x: 1.05, ease: 'out', pose: { torso: -32, arm_f_up: 70, arm_f_lo: -16, blade: -52 } },
      { f: 22, x: 1.05, pose: { torso: -30, blade: -55 } },
      { f: 32, x: 0, pose: HAMMER_READY },
    ],
  },
  // ------------------------------------------------------------------ spear
  {
    name: 'idle@spear', length: 60, loop: true,
    keys: [
      { f: 0, pose: SPEAR_READY },
      { f: 30, pose: { torso: 3.5, head: -3.5, arm_f_up: 50, arm_f_lo: 41, blade: 4 } },
      { f: 60, pose: SPEAR_READY },
    ],
  },
  {
    // quick jab: the arms shoot forward on frame 1
    name: 'attack_quick@spear', length: 12, reach: SPEAR_REACH,
    events: [{ f: 1, type: 'hit' }],
    keys: [
      { f: 0, x: 0.1, ease: 'step', pose: { torso: 3, arm_f_up: 40, arm_f_lo: 52, blade: 4 } },
      { f: 1, x: 0.4, ease: 'out', pose: { torso: -10, head: -3, arm_f_up: 82, arm_f_lo: 6, blade: 0, leg_f_up: 30, leg_f_lo: -18 } },
      { f: 5, x: 0.42, pose: { torso: -10 } },
      { f: 12, x: 0, pose: SPEAR_READY },
    ],
  },
  {
    // thrust: drawn back on frame 0, driven through on frame 2
    name: 'attack_normal@spear', length: 16, reach: SPEAR_REACH,
    events: [{ f: 2, type: 'hit' }],
    keys: [
      { f: 0, x: 0, ease: 'step', pose: { torso: 8, head: 2, arm_f_up: 24, arm_f_lo: 76, blade: 6 } },
      { f: 2, x: 0.8, ease: 'out', pose: { torso: -16, head: -4, arm_f_up: 86, arm_f_lo: 2, blade: -2, ...LUNGE } },
      { f: 9, x: 0.85, pose: { torso: -15 } },
      { f: 16, x: 0, pose: SPEAR_READY },
    ],
  },
  {
    // power thrust: a deep draw-back, then a full lunge behind the point
    name: 'attack_power@spear', length: 26, reach: SPEAR_REACH,
    events: [{ f: 5, type: 'swing' }, { f: 7, type: 'hit' }],
    keys: [
      { f: 0 },
      { f: 5, x: -0.3, ease: 'out', pose: { torso: 14, head: 6, arm_f_up: 14, arm_f_lo: 84, hand_f: 4, blade: 10, leg_f_up: 22, leg_f_lo: -8, leg_b_up: -20 } },
      { f: 7, x: 1.1, ease: 'in', pose: { torso: -24, head: -6, arm_f_up: 88, arm_f_lo: 0, hand_f: 0, blade: -4, ...DEEP_LUNGE } },
      { f: 16, x: 1.15, pose: { torso: -23 } },
      { f: 26, x: 0, pose: SPEAR_READY },
    ],
  },
];
