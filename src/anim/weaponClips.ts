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
/** ready with the axe (#47): held up by the shoulder, haft nearly upright, the head cocked behind the hand for a chop */
export const AXE_READY: Pose = { torso: 4, head: -3, arm_f_up: 26, arm_f_lo: 92, hand_f: 0, blade: 78, ...LEGS };
/** guard with the daggers (#47): both hands low in front, points up at the enemy, a little crouched */
export const DAGGERS_READY: Pose = { torso: 8, head: -4, arm_f_up: 42, arm_f_lo: 66, hand_f: 0, blade: 28, arm_b_up: 36, arm_b_lo: 64, hand_b: 0, blade_b: 34, ...LEGS };
/** ready with the trident and net (#254): the trident level at the enemy in one hand, the net hanging from the other */
export const TRIDENT_READY: Pose = { torso: 5, head: -3, arm_f_up: 34, arm_f_lo: 64, hand_f: 0, blade: 12, arm_b_up: 14, arm_b_lo: 26, hand_b: 0, blade_b: 0, ...LEGS };
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
  // ------------------------------------------------------------------ axe (#47): one hand, every blow a chop from a wind-up,
  // the edge (the head's -y side) leading; the head lands on the shoulder / collarbone instead of the blade's length
  {
    name: 'idle@axe', length: 60, loop: true,
    keys: [
      { f: 0, pose: AXE_READY },
      { f: 30, pose: { torso: 5.5, head: -4.5, arm_f_up: 28, arm_f_lo: 94, blade: 75 } },
      { f: 60, pose: AXE_READY },
    ],
  },
  {
    // short chop: the head is cocked beside the ear on frame 0 and bites on frame 2
    name: 'attack_quick@axe', length: 16,
    events: [{ f: 2, type: 'hit' }],
    keys: [
      { f: 0, x: 0.3, ease: 'step', pose: { torso: 2, head: 0, arm_f_up: 120, arm_f_lo: 60, hand_f: 0, blade: 150, arm_b_up: -30, leg_f_up: 22, leg_f_lo: -10 } },
      { f: 2, x: 0.45, ease: 'in', pose: { torso: -12, head: -4, arm_f_up: 137, arm_f_lo: -20, hand_f: 0, blade: -23, arm_b_up: -40, leg_f_up: 30, leg_f_lo: -16 } },
      { f: 8, x: 0.48, pose: { torso: -13, arm_f_up: 112, arm_f_lo: -14, blade: -52 } },
      { f: 16, x: 0, pose: { ...AXE_READY, arm_b_up: -18, leg_f_up: 16, leg_f_lo: -6 } },
    ],
  },
  {
    // chop: wound up behind the head on frame 0, down through the collarbone on frame 3, lunging
    name: 'attack_normal@axe', length: 20,
    events: [{ f: 3, type: 'hit' }],
    keys: [
      { f: 0, x: 0.35, ease: 'step', pose: { torso: 10, head: 4, arm_f_up: 160, arm_f_lo: 40, hand_f: 8, blade: 190, arm_b_up: -10, arm_b_lo: 30 } },
      { f: 3, x: 0.9, ease: 'in', pose: { torso: -22, head: -6, arm_f_up: 139, arm_f_lo: -8, hand_f: 0, blade: -31, arm_b_up: -55, arm_b_lo: 20, ...LUNGE } },
      { f: 11, x: 0.95, pose: { torso: -21, arm_f_up: 108, arm_f_lo: -10, blade: -62 } },
      { f: 20, x: 0, pose: { ...AXE_READY, arm_b_up: -18, arm_b_lo: 35, leg_b_up: -14, leg_b_lo: 4 } },
    ],
  },
  {
    // the big chop: a long wind-up with the head hanging behind the back, the whole body follows it down
    name: 'attack_power@axe', length: 30,
    events: [{ f: 6, type: 'swing' }, { f: 8, type: 'hit' }],
    keys: [
      { f: 0, pose: AXE_READY },
      { f: 6, x: -0.15, ease: 'out', pose: { torso: 16, head: 8, arm_f_up: 182, arm_f_lo: 48, hand_f: 12, blade: 240, arm_b_up: 50, arm_b_lo: 40, leg_f_up: 22, leg_f_lo: -8 } },
      { f: 8, x: 1.0, ease: 'in', pose: { torso: -28, head: -8, arm_f_up: 139, arm_f_lo: -10, hand_f: 0, blade: -39, arm_b_up: -60, arm_b_lo: 20, ...DEEP_LUNGE } },
      { f: 18, x: 1.05, pose: { torso: -27, arm_f_up: 98, arm_f_lo: -10, blade: -72 } },
      { f: 30, x: 0, pose: { ...AXE_READY, arm_b_up: -18, arm_b_lo: 35, leg_b_up: -14, leg_b_lo: 4 } },
    ],
  },
  // ------------------------------------------------------------------ daggers (#47): the core strikes twice, so every attack
  // is two stabs, front hand then back hand; the damage shows on the first, the second is heard. `reach` < 0: a dagger
  // is shorter than a sword, so the body steps in closer.
  {
    name: 'idle@daggers', length: 60, loop: true,
    keys: [
      { f: 0, pose: DAGGERS_READY },
      { f: 30, pose: { torso: 9.5, head: -5, arm_f_up: 44, arm_f_lo: 64, blade: 30, arm_b_up: 34, arm_b_lo: 66, blade_b: 32 } },
      { f: 60, pose: DAGGERS_READY },
    ],
  },
  {
    name: 'attack_quick@daggers', length: 16, reach: -1.2,
    events: [{ f: 1, type: 'hit' }, { f: 5, type: 'swing' }],
    keys: [
      { f: 0, x: 0.25, ease: 'step', pose: { torso: 4, arm_f_up: 12, arm_f_lo: 100, blade: 12 } },
      { f: 1, x: 0.4, ease: 'out', pose: { torso: -12, head: -4, arm_f_up: 84, arm_f_lo: 2, hand_f: 0, blade: 4, leg_f_up: 28, leg_f_lo: -14 } },
      { f: 3, x: 0.42, pose: { torso: -8, arm_f_up: 40, arm_f_lo: 80, blade: 20, arm_b_up: 12, arm_b_lo: 92, blade_b: 14 } },
      { f: 5, x: 0.5, ease: 'out', pose: { torso: -16, arm_f_up: 30, arm_f_lo: 88, blade: 22, arm_b_up: 90, arm_b_lo: -2, hand_b: 0, blade_b: 2 } },
      { f: 9, x: 0.5, pose: { torso: -15 } },
      { f: 16, x: 0, pose: { ...DAGGERS_READY, leg_f_up: 16, leg_f_lo: -6 } },
    ],
  },
  {
    name: 'attack_normal@daggers', length: 20, reach: -1.2,
    events: [{ f: 2, type: 'hit' }, { f: 6, type: 'swing' }],
    keys: [
      { f: 0, x: 0.3, ease: 'step', pose: { torso: 6, head: 2, arm_f_up: 8, arm_f_lo: 104, blade: 10, arm_b_up: 30, arm_b_lo: 70 } },
      { f: 2, x: 0.8, ease: 'out', pose: { torso: -18, head: -4, arm_f_up: 84, arm_f_lo: 2, hand_f: 0, blade: 4, ...LUNGE } },
      { f: 4, x: 0.82, pose: { torso: -12, arm_f_up: 40, arm_f_lo: 82, blade: 18, arm_b_up: 10, arm_b_lo: 96, blade_b: 12 } },
      { f: 6, x: 0.9, ease: 'out', pose: { torso: -20, arm_f_up: 30, arm_f_lo: 88, blade: 22, arm_b_up: 90, arm_b_lo: -2, hand_b: 0, blade_b: 2 } },
      { f: 12, x: 0.92, pose: { torso: -19 } },
      { f: 20, x: 0, pose: { ...DAGGERS_READY, leg_b_up: -14, leg_b_lo: 4 } },
    ],
  },
  {
    // both daggers raised over the head, then driven down together into the collarbones
    name: 'attack_power@daggers', length: 28, reach: -1.2,
    events: [{ f: 5, type: 'swing' }, { f: 7, type: 'hit' }],
    keys: [
      { f: 0, pose: DAGGERS_READY },
      { f: 5, x: -0.1, ease: 'out', pose: { torso: 14, head: 8, arm_f_up: 172, arm_f_lo: 12, blade: 150, arm_b_up: 168, arm_b_lo: 16, blade_b: 150, leg_f_up: 22, leg_f_lo: -8 } },
      { f: 7, x: 1.0, ease: 'in', pose: { torso: -24, head: -6, arm_f_up: 118, arm_f_lo: -12, blade: -62, arm_b_up: 112, arm_b_lo: -8, blade_b: -58, ...DEEP_LUNGE } },
      { f: 17, x: 1.05, pose: { torso: -23, arm_f_up: 104, blade: -72, arm_b_up: 100, blade_b: -70 } },
      { f: 28, x: 0, pose: { ...DAGGERS_READY, leg_b_up: -14, leg_b_lo: 4 } },
    ],
  },
  // ------------------------------------------------------------------ trident + net (#254): one-handed thrusts from further away
  // than a sword (the prongs reach ~1.5 units past a sword's point), and the net thrown from the back hand
  {
    name: 'idle@trident', length: 60, loop: true,
    keys: [
      { f: 0, pose: TRIDENT_READY },
      { f: 30, pose: { torso: 6.5, head: -4.5, arm_f_up: 36, arm_f_lo: 66, blade: 10, arm_b_up: 16, blade_b: 6 } },
      { f: 60, pose: TRIDENT_READY },
    ],
  },
  {
    name: 'attack_quick@trident', length: 12, reach: 1.5,
    events: [{ f: 1, type: 'hit' }],
    keys: [
      { f: 0, x: 0.15, ease: 'step', pose: { torso: 4, arm_f_up: 4, arm_f_lo: 104, blade: 6 } },
      { f: 1, x: 0.4, ease: 'out', pose: { torso: -10, head: -3, arm_f_up: 74, arm_f_lo: 10, blade: 2, leg_f_up: 28, leg_f_lo: -14 } },
      { f: 5, x: 0.42, pose: { torso: -10 } },
      { f: 12, x: 0, pose: { ...TRIDENT_READY, leg_f_up: 16, leg_f_lo: -6 } },
    ],
  },
  {
    name: 'attack_normal@trident', length: 16, reach: 1.5,
    events: [{ f: 2, type: 'hit' }],
    keys: [
      { f: 0, x: 0.1, ease: 'step', pose: { torso: 8, head: 2, arm_f_up: -10, arm_f_lo: 110, blade: 4, arm_b_up: 30, blade_b: 20 } },
      { f: 2, x: 0.8, ease: 'out', pose: { torso: -18, head: -4, arm_f_up: 82, arm_f_lo: 4, blade: 0, arm_b_up: -30, blade_b: -20, ...LUNGE } },
      { f: 9, x: 0.85, pose: { torso: -17 } },
      { f: 16, x: 0, pose: { ...TRIDENT_READY, leg_b_up: -14, leg_b_lo: 4 } },
    ],
  },
  {
    // raised over the head, prongs forward, then driven down at the collarbone with the whole body
    name: 'attack_power@trident', length: 26, reach: 1.3,
    events: [{ f: 5, type: 'swing' }, { f: 7, type: 'hit' }],
    keys: [
      { f: 0, pose: TRIDENT_READY },
      { f: 5, x: -0.2, ease: 'out', pose: { torso: 14, head: 6, arm_f_up: 165, arm_f_lo: 20, hand_f: 0, blade: 8, arm_b_up: 40, arm_b_lo: 40, blade_b: 30, leg_f_up: 22, leg_f_lo: -8 } },
      { f: 7, x: 1.05, ease: 'in', pose: { torso: -24, head: -6, arm_f_up: 104, arm_f_lo: 0, hand_f: 0, blade: -24, arm_b_up: -50, arm_b_lo: 20, blade_b: -30, ...DEEP_LUNGE } },
      { f: 16, x: 1.1, pose: { torso: -23 } },
      { f: 26, x: 0, pose: { ...TRIDENT_READY, leg_b_up: -14, leg_b_lo: 4 } },
    ],
  },
  {
    // the net: swung back low, then flung forward and up over the enemy (the net stays in hand: the cast is the gesture)
    name: 'net_throw@trident', length: 24,
    events: [{ f: 9, type: 'swing' }],
    keys: [
      { f: 0, pose: TRIDENT_READY },
      { f: 6, x: -0.1, ease: 'out', pose: { torso: 12, head: 4, arm_b_up: -70, arm_b_lo: 20, hand_b: 0, blade_b: 40, arm_f_up: 20, arm_f_lo: 70 } },
      { f: 9, x: 0.3, ease: 'in', pose: { torso: -16, head: -4, arm_b_up: 132, arm_b_lo: -8, blade_b: 120, leg_f_up: 30, leg_f_lo: -16 } },
      { f: 14, x: 0.32, pose: { torso: -14, arm_b_up: 120, blade_b: 100 } },
      { f: 24, x: 0, pose: { ...TRIDENT_READY, leg_f_up: 16, leg_f_lo: -6 } },
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
  for (const [family, ready] of [['hammer', HAMMER_READY], ['spear', SPEAR_READY], ['axe', AXE_READY], ['daggers', DAGGERS_READY], ['trident', TRIDENT_READY]] as const) {
    const arms: Pose = Object.fromEntries(ARMS.map((k) => [k, ready[k] ?? 0]));
    for (const c of clips.filter((x) => x.name === 'walk_fwd' || x.name === 'walk_back')) {
      out.push({ ...c, name: `${c.name}@${family}`, keys: c.keys.map((k) => ({ ...k, pose: { ...(k.pose ?? {}), ...arms } })) });
    }
  }
  return out;
}

const GRIP = ['arm_f_up', 'arm_f_lo', 'hand_f', 'blade'] as const;

/**
 * Dodging with a two-handed weapon (#13): the shared `dodge` with the front arm and weapon of the ready stance on
 * every key, while the torso and head still lean away. The weapon stays upright instead of dropping to sword height.
 */
export function heldDodges(clips: readonly Clip[]): Clip[] {
  const dodge = clips.find((c) => c.name === 'dodge');
  if (!dodge) return [];
  return ([['hammer', HAMMER_READY], ['spear', SPEAR_READY], ['axe', AXE_READY], ['daggers', DAGGERS_READY], ['trident', TRIDENT_READY]] as const).map(([family, ready]) => {
    const grip: Pose = Object.fromEntries(GRIP.map((k) => [k, ready[k] ?? 0]));
    return { ...dodge, name: `dodge@${family}`, keys: dodge.keys.map((k) => ({ ...k, pose: { ...(k.pose ?? {}), ...grip } })) }; // 'blade' wins over 'weapon' in bake()
  });
}
