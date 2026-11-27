/**
 * The fight clips (30 fps). Timing follows the reference measurements (docs/ANALIZA_REFERENCJI.md):
 *  - plain attacks have NO anticipation: the strike pose is on frame 0 and the hit lands on frame 1
 *  - the follow-through is HELD (~8 frames) - that is what reads as a heavy blow - then a short recovery
 *  - only jump / charge / power attack wind up (2-5 frames)
 * Angles in degrees, CCW. 'blade' = world angle of the sword (solved into the weapon bone).
 * Root x is forward in the fighter's facing (units), root y is up; grounded keys keep the soles on the floor.
 */
import type { Pose } from '../rig/PaperRig';
import { bake, Baked, Clip } from './clip';
import { WEAPON_CLIPS, heldDodges, heldWalks } from './weaponClips';
import { FINISHER_CLIPS } from './finisherClips';

const CROUCH: Pose = { leg_f_up: 48, leg_f_lo: -82, leg_b_up: 24, leg_b_lo: -76, torso: -12 };

/** the raised guard: sword across the face, back arm up (the `block` clip and the held guard, #273) */
const GUARD_POSE = { torso: 8, head: 4, arm_f_up: 96, arm_f_lo: 70, hand_f: -10, blade: 78, arm_b_up: 40, arm_b_lo: 70, leg_b_up: -22 };
/** the guard behind a shield (#38): shield before the chest and face, sword cocked low behind it */
const SHIELD_GUARD_POSE = { torso: 10, head: 6, arm_b_up: 78, arm_b_lo: 58, hand_b: 0, arm_f_up: 14, arm_f_lo: 74, hand_f: -10, blade: 58, leg_b_up: -22 };

export const CLIPS: Clip[] = [
  {
    name: 'idle', length: 60, loop: true,
    keys: [
      { f: 0 },
      { f: 30, pose: { torso: 4.5, head: -4.5, arm_f_up: 24, arm_f_lo: 64, weapon: -43, arm_b_up: -20, arm_b_lo: 38 } },
      { f: 60, pose: { torso: 3, head: -3, arm_f_up: 22, arm_f_lo: 62, weapon: -40, arm_b_up: -18, arm_b_lo: 35 } },
    ],
  },
  {
    // #238: leg angles solved by 2-bone IK (as walk_back, #7): the front foot lifts and lands 1.6 ahead while the back
    // one holds, then the back foot follows while the front one holds (no sliding soles)
    name: 'walk_fwd', length: 20,
    events: [{ f: 10, type: 'step' }, { f: 19, type: 'step' }],
    keys: [
      { f: 0 },
      { f: 3, x: 0.22, pose: { leg_f_up: 43, leg_f_lo: -52, leg_b_up: -6, leg_b_lo: -20, torso: 1, arm_b_up: -10 } },
      { f: 6, x: 0.5, pose: { leg_f_up: 51, leg_f_lo: -57, leg_b_up: -10, leg_b_lo: -20, torso: 0, arm_b_up: -6 } },
      { f: 10, x: 0.8, pose: { leg_f_up: 35, leg_f_lo: -20, leg_b_up: -13, leg_b_lo: -24, torso: 1, arm_b_up: -20 } },
      { f: 13, x: 1.05, pose: { leg_f_up: 31, leg_f_lo: -20, leg_b_up: 2, leg_b_lo: -52, arm_b_up: -24 } },
      { f: 16, x: 1.32, pose: { leg_f_up: 27, leg_f_lo: -20, leg_b_up: 11, leg_b_lo: -58, torso: 2 } },
      { f: 20, x: 1.6, pose: { leg_f_up: 16, leg_f_lo: -6, leg_b_up: -14, leg_b_lo: 4, torso: 3, arm_b_up: -18 } },
    ],
  },
  {
    // #7: leg angles solved by 2-bone IK so the standing foot stays put: first the back foot lifts and reaches 1.6 back
    // while the front one holds, then the front foot follows while the back one holds (no sliding soles)
    name: 'walk_back', length: 20,
    events: [{ f: 10, type: 'step' }, { f: 19, type: 'step' }],
    keys: [
      { f: 0 },
      { f: 3, x: -0.22, pose: { leg_f_up: 26, leg_f_lo: -20, leg_b_up: 10, leg_b_lo: -54, torso: 5 } },
      { f: 6, x: -0.5, pose: { leg_f_up: 30, leg_f_lo: -20, leg_b_up: 7, leg_b_lo: -60, torso: 6 } },
      { f: 10, x: -0.8, pose: { leg_f_up: 35, leg_f_lo: -20, leg_b_up: -13, leg_b_lo: -24, torso: 5 } },
      { f: 13, x: -1.05, pose: { leg_f_up: 48, leg_f_lo: -50, leg_b_up: -11, leg_b_lo: -20, torso: 4 } },
      { f: 16, x: -1.32, pose: { leg_f_up: 46, leg_f_lo: -56, leg_b_up: -7, leg_b_lo: -20 } },
      { f: 20, x: -1.6, pose: { leg_f_up: 16, leg_f_lo: -6, leg_b_up: -14, leg_b_lo: 4, torso: 3 } },
    ],
  },
  {
    name: 'jump', length: 24,
    events: [{ f: 16, type: 'land' }],
    keys: [
      { f: 0 },
      { f: 3, ease: 'out', pose: { ...CROUCH, arm_f_up: 0, arm_f_lo: 50, blade: -20, arm_b_up: -45 } },
      { f: 6, air: true, x: 0.6, y: 1.0, ease: 'out', pose: { leg_f_up: 18, leg_f_lo: -18, leg_b_up: -26, leg_b_lo: -10, torso: -6, arm_f_up: 60, arm_f_lo: 40, blade: 40, arm_b_up: 40, foot_f: -10, foot_b: 20 } },
      { f: 10, air: true, x: 2.0, y: 2.6, ease: 'out', pose: { leg_f_up: 70, leg_f_lo: -96, leg_b_up: 40, leg_b_lo: -100, torso: -4, arm_f_up: 70 } },
      { f: 14, air: true, x: 3.4, y: 1.0, ease: 'in', pose: { leg_f_up: 30, leg_f_lo: -30, leg_b_up: 6, leg_b_lo: -30, foot_f: 0, foot_b: 0, arm_f_up: 40 } },
      { f: 16, x: 4.0, ease: 'out', pose: { ...CROUCH, arm_f_up: 20, arm_f_lo: 60, blade: 20, arm_b_up: -30 } },
      { f: 24, x: 4.0, pose: { leg_f_up: 16, leg_f_lo: -6, leg_b_up: -14, leg_b_lo: 4, torso: 3, head: -3, arm_f_up: 22, arm_f_lo: 62, hand_f: -10, weapon: -40, arm_b_up: -18, arm_b_lo: 35 } },
    ],
  },
  {
    // acrobatic leaping attack: 2-frame wind-up, arc, dive onto the enemy, slide, get up (~1.2 s)
    name: 'charge', length: 36,
    events: [{ f: 2, type: 'swing' }, { f: 14, type: 'hit' }, { f: 15, type: 'impact' }],
    keys: [
      { f: 0 },
      { f: 2, ease: 'out', pose: { ...CROUCH, torso: -16, arm_f_up: 150, arm_f_lo: 30, blade: 120, arm_b_up: -60 } },
      { f: 5, air: true, x: 1.2, y: 1.6, ease: 'out', pose: { pelvis: -30, torso: -10, leg_f_up: 30, leg_f_lo: -60, leg_b_up: -40, leg_b_lo: -20, arm_f_up: 120, arm_f_lo: 10, blade: 0, arm_b_up: 30, foot_f: 0, foot_b: 0 } },
      { f: 9, air: true, x: 2.6, y: 2.1, ease: 'out', pose: { pelvis: -60, torso: -8, leg_f_up: -6, leg_f_lo: -30, leg_b_up: -30, leg_b_lo: -40, arm_f_up: 120, arm_f_lo: 0, blade: -20, arm_b_up: 60 } },
      { f: 13, air: true, x: 4.4, y: -1.0, ease: 'in', pose: { pelvis: -80, torso: -4, leg_f_up: -4, leg_f_lo: -6, leg_b_up: -18, leg_b_lo: -4, arm_f_up: 165, arm_f_lo: 6, blade: -6, arm_b_up: 150, arm_b_lo: 10 } },
      { f: 15, air: true, x: 5.0, y: -4.1, ease: 'out', pose: { pelvis: -88, torso: -2, head: 10 } },
      { f: 21, air: true, x: 5.3, y: -4.2, ease: 'out' },
      { f: 27, air: true, x: 5.3, y: -2.3, pose: { pelvis: -6, torso: -26, head: 4, leg_f_up: 72, leg_f_lo: -104, leg_b_up: 6, leg_b_lo: -112, foot_f: 30, foot_b: 100, arm_f_up: 30, arm_f_lo: 50, blade: 0, arm_b_up: -20, arm_b_lo: 40 } },
      { f: 36, x: 5.3, pose: { pelvis: 0, leg_f_up: 16, leg_f_lo: -6, leg_b_up: -14, leg_b_lo: 4, torso: 3, head: -3, arm_f_up: 22, arm_f_lo: 62, hand_f: -10, weapon: -40, arm_b_up: -18, arm_b_lo: 35 } },
    ],
  },
  {
    // reference: menu closes and the very next frame is the strike; small grey number, then the splat
    name: 'attack_quick', length: 14,
    events: [{ f: 1, type: 'hit' }],
    keys: [
      { f: 0, x: 0.35, ease: 'step', pose: { torso: -8, head: -4, arm_f_up: 78, arm_f_lo: 6, hand_f: 0, blade: 4, arm_b_up: -36, leg_f_up: 26, leg_f_lo: -14 } },
      { f: 6, x: 0.42, pose: { torso: -9, arm_f_up: 80, blade: 2 } },
      { f: 14, x: 0, pose: { torso: 3, head: -3, arm_f_up: 22, arm_f_lo: 62, hand_f: -10, weapon: -40, arm_b_up: -18, leg_f_up: 16, leg_f_lo: -6 } },
    ],
  },
  {
    name: 'attack_normal', length: 16,
    events: [{ f: 1, type: 'hit' }],
    keys: [
      // deep lunge as in the reference (#7): front knee well bent, back leg stretched out, so the pelvis drops low
      { f: 0, x: 0.6, ease: 'step', pose: { torso: -16, head: -4, arm_f_up: 112, arm_f_lo: -14, hand_f: 0, blade: 60, arm_b_up: -55, arm_b_lo: 20, leg_f_up: 52, leg_f_lo: -58, leg_b_up: -40, leg_b_lo: 8 } },
      { f: 2, x: 0.9, ease: 'out', pose: { torso: -24, head: 2, arm_f_up: 72, arm_f_lo: -24, blade: -33, leg_f_up: 62, leg_f_lo: -80, leg_b_up: -48, leg_b_lo: 6 } },
      { f: 10, x: 0.95, pose: { torso: -22, head: 0, blade: -37, leg_f_up: 60, leg_f_lo: -76, leg_b_up: -47, leg_b_lo: 6 } },
      { f: 13, x: 0.3, pose: { torso: -4, arm_f_up: 40, arm_f_lo: 40, blade: 10, leg_f_up: 24, leg_f_lo: -12, leg_b_up: -18, leg_b_lo: 4, arm_b_up: -24 } },
      { f: 16, x: 0, pose: { torso: 3, head: -3, arm_f_up: 22, arm_f_lo: 62, hand_f: -10, weapon: -40, arm_b_up: -18, arm_b_lo: 35, leg_f_up: 16, leg_f_lo: -6, leg_b_up: -14, leg_b_lo: 4 } },
    ],
  },
  {
    // reference enemy swing: raise overhead 3-5 f, chop down 2 f, hold, recover
    name: 'attack_power', length: 26,
    events: [{ f: 5, type: 'swing' }, { f: 7, type: 'hit' }],
    keys: [
      { f: 0 },
      { f: 5, x: -0.1, ease: 'out', pose: { torso: 12, head: 6, arm_f_up: 176, arm_f_lo: 40, hand_f: 10, blade: 210, arm_b_up: 50, arm_b_lo: 40, leg_f_up: 20, leg_f_lo: -8 } },
      { f: 7, x: 0.9, ease: 'in', pose: { torso: -28, head: -8, arm_f_up: 76, arm_f_lo: -20, hand_f: 0, blade: -62, arm_b_up: -60, arm_b_lo: 20, leg_f_up: 48, leg_f_lo: -45, leg_b_up: -36, leg_b_lo: 10 } },
      { f: 16, x: 1.0, pose: { torso: -26, blade: -66 } },
      { f: 26, x: 0, pose: { torso: 3, head: -3, arm_f_up: 22, arm_f_lo: 62, hand_f: -10, weapon: -40, arm_b_up: -18, arm_b_lo: 35, leg_f_up: 16, leg_f_lo: -6, leg_b_up: -14, leg_b_lo: 4 } },
    ],
  },
  {
    name: 'block', length: 18,
    events: [{ f: 2, type: 'block' }],
    keys: [
      { f: 0 },
      { f: 2, x: -0.25, ease: 'out', pose: GUARD_POSE },
      { f: 12, x: -0.3, pose: { torso: 7 } },
      { f: 18, x: 0, pose: { torso: 3, head: -3, arm_f_up: 22, arm_f_lo: 62, hand_f: -10, weapon: -40, arm_b_up: -18, arm_b_lo: 35, leg_b_up: -14 } },
    ],
  },
  // the Block action (#273): the guard goes up and stays up until a blow lands or the guard ends with the turn;
  // the presenter plays `guard_up`, then holds `guard`, and the reaction (`block`, `hit`, `dodge`) lowers it
  {
    name: 'guard_up', length: 8,
    events: [{ f: 2, type: 'block' }],
    keys: [
      { f: 0 },
      { f: 2, x: -0.25, ease: 'out', pose: GUARD_POSE },
      { f: 8, x: -0.3, pose: { torso: 7 } },
    ],
  },
  {
    name: 'guard', length: 48, loop: true,
    keys: [
      { f: 0, x: -0.3, pose: { ...GUARD_POSE, torso: 7 } },
      { f: 24, x: -0.3, pose: { torso: 9, head: 5, arm_f_up: 98 } },
      { f: 48, x: -0.3, pose: { torso: 7, head: 4, arm_f_up: 96 } },
    ],
  },
  {
    name: 'hit', length: 16,
    events: [{ f: 1, type: 'struck' }],
    keys: [
      { f: 0 },
      { f: 2, x: -0.45, ease: 'out', pose: { torso: 16, head: 22, arm_f_up: 6, arm_f_lo: 34, blade: 0, arm_b_up: -46, arm_b_lo: 10, leg_f_up: 22 } },
      { f: 6, x: -0.5, pose: { torso: 10, head: 12 } },
      { f: 16, x: 0, pose: { torso: 3, head: -3, arm_f_up: 22, arm_f_lo: 62, hand_f: -10, weapon: -40, arm_b_up: -18, arm_b_lo: 35, leg_f_up: 16 } },
    ],
  },
  {
    // the defender when the attack misses (#13): leans the torso away and slides the back foot out on frame 3
    // (the blow passes on the attacker's hit frame), holds, then steps back in; root x returns to 0 (no travel)
    name: 'dodge', length: 12,
    keys: [
      { f: 0 },
      { f: 3, x: -0.75, ease: 'out', pose: { torso: 22, head: 16, arm_f_up: 44, arm_f_lo: 70, hand_f: -6, blade: 72, arm_b_up: -44, arm_b_lo: 26, leg_f_up: 26, leg_f_lo: -24, leg_b_up: -30, leg_b_lo: -6 } },
      { f: 7, x: -0.82, pose: { torso: 19, head: 12 } },
      { f: 12, x: 0, pose: { torso: 3, head: -3, arm_f_up: 22, arm_f_lo: 62, hand_f: -10, weapon: -40, arm_b_up: -18, arm_b_lo: 35, leg_f_up: 16, leg_f_lo: -6, leg_b_up: -14, leg_b_lo: 4 } },
    ],
  },
  {
    // the defender after a successful charge: thrown back, stumbles, recovers
    name: 'knockback', length: 30,
    events: [{ f: 1, type: 'struck' }],
    keys: [
      { f: 0 },
      { f: 3, x: -1.0, ease: 'out', pose: { torso: 28, head: 30, arm_f_up: 60, arm_f_lo: 20, arm_b_up: 70, leg_f_up: 40, leg_f_lo: -20 } },
      { f: 10, x: -1.8, pose: { torso: 18, head: 14, leg_f_up: 30, leg_f_lo: -12, leg_b_up: -30 } },
      { f: 20, x: -2.0, pose: { torso: 6, head: 2 } },
      { f: 30, x: -2.0, pose: { torso: 3, head: -3, arm_f_up: 22, arm_f_lo: 62, hand_f: -10, weapon: -40, arm_b_up: -18, arm_b_lo: 35, leg_f_up: 16, leg_f_lo: -6, leg_b_up: -14, leg_b_lo: 4 } },
    ],
  },
  {
    name: 'taunt', length: 44,
    keys: [
      { f: 0 },
      { f: 6, ease: 'out', pose: { torso: 6, head: 10, arm_f_up: 166, arm_f_lo: 4, hand_f: 0, blade: 95, arm_b_up: 120, arm_b_lo: 40 } },
      { f: 12, pose: { arm_b_up: 145, arm_b_lo: 18, head: 14 } },
      { f: 18, pose: { arm_b_up: 120, arm_b_lo: 40, head: 8 } },
      { f: 24, pose: { arm_b_up: 145, arm_b_lo: 18, head: 14 } },
      { f: 32, pose: { arm_b_up: 125, arm_b_lo: 35 } },
      { f: 44, pose: { torso: 3, head: -3, arm_f_up: 22, arm_f_lo: 62, hand_f: -10, weapon: -40, arm_b_up: -18, arm_b_lo: 35 } },
    ],
  },
  {
    name: 'rest', length: 48,
    keys: [
      { f: 0 },
      { f: 10, pose: { torso: -18, head: -12, arm_f_up: 2, arm_f_lo: 14, hand_f: 0, blade: -82, arm_b_up: -4, arm_b_lo: 14, leg_f_up: 12, leg_b_up: -10 } },
      { f: 20, pose: { torso: -11, head: -8 } },
      { f: 30, pose: { torso: -18, head: -12 } },
      { f: 38, pose: { torso: -11, head: -8 } },
      { f: 48, pose: { torso: 3, head: -3, arm_f_up: 22, arm_f_lo: 62, hand_f: -10, weapon: -40, arm_b_up: -18, arm_b_lo: 35, leg_f_up: 16, leg_b_up: -14 } },
    ],
  },
  {
    name: 'death', length: 40, hold: true,
    events: [{ f: 1, type: 'struck' }, { f: 24, type: 'impact' }],
    keys: [
      { f: 0 },
      { f: 4, x: -0.4, ease: 'out', pose: { torso: 22, head: 28, arm_f_up: 40, arm_f_lo: 20, arm_b_up: 50 } },
      // #7: root heights below keep the lowest sole on the floor while the knees buckle (they used to sink up to 1.6 units)
      { f: 8, air: true, x: -0.5, y: -0.13, pose: { pelvis: 7, torso: 25, head: 28, leg_f_up: 34, leg_f_lo: -45, leg_b_up: 8, leg_b_lo: -44, foot_f: 10, foot_b: 35 } },
      { f: 12, air: true, x: -0.6, y: -0.98, pose: { pelvis: 14, torso: 28, leg_f_up: 52, leg_f_lo: -84, leg_b_up: 30, leg_b_lo: -92, foot_f: 30, foot_b: 60 } },
      { f: 16, air: true, x: -0.71, y: -0.67, pose: { pelvis: 24, torso: 25, head: 25, leg_f_up: 50, leg_f_lo: -74, leg_b_up: 29, leg_b_lo: -79, foot_f: 22, foot_b: 49, arm_f_up: 53, arm_f_lo: 18, arm_b_up: 64, arm_b_lo: 31 } },
      { f: 19, air: true, x: -0.94, y: -1.09, ease: 'in', pose: { pelvis: 44, torso: 18, head: 20, leg_f_up: 46, leg_f_lo: -55, leg_b_up: 27, leg_b_lo: -53, foot_f: 6, foot_b: 26, arm_f_up: 79, arm_f_lo: 15, arm_b_up: 94, arm_b_lo: 23 } },
      { f: 22, air: true, x: -1.3, y: -3.7, ease: 'in', pose: { pelvis: 76, torso: 8, head: 12, leg_f_up: 40, leg_f_lo: -24, leg_b_up: 24, leg_b_lo: -12, arm_f_up: 120, arm_f_lo: 10, arm_b_up: 140, arm_b_lo: 10, foot_f: -20, foot_b: -10 } },
      { f: 25, air: true, x: -1.45, y: -4.15, ease: 'out', pose: { pelvis: 86, head: 18 } },
      { f: 28, air: true, x: -1.5, y: -3.95, pose: { pelvis: 83 } },
      { f: 33, air: true, x: -1.5, y: -4.2, ease: 'out', pose: { pelvis: 88, head: 22, leg_f_up: 10, leg_f_lo: -6, leg_b_up: 4, leg_b_lo: -2, foot_f: -2, foot_b: 8, arm_f_up: 130 } }, // lying: legs level, feet resting on the floor (#7)
      { f: 40, air: true, x: -1.5, y: -4.2 },
    ],
  },
  {
    name: 'victory', length: 12, hold: true,
    keys: [
      { f: 0 },
      { f: 6, ease: 'back', pose: { torso: 6, head: 10, arm_f_up: 170, arm_f_lo: 0, hand_f: 0, blade: 92, arm_b_up: -28, arm_b_lo: 96 } },
      { f: 12, pose: { head: 8 } },
    ],
  },
];

/**
 * Faces in the clips (#26): expression keys (src/rig/expressions.ts) set on existing key frames, 1 = shown.
 * Pain when struck or falling, a shout of triumph, the brows pulled down for effort.
 */
export const CLIP_FACES: Readonly<Record<string, Readonly<Record<number, Pose>>>> = {
  hit: { 2: { eyes: 1, mouth: 1 }, 16: { eyes: 0, mouth: 0 } },
  knockback: { 3: { eyes: 1, mouth: 1 }, 20: { eyes: 0, mouth: 0 } },
  death: { 4: { eyes: 1, mouth: 1 } },
  victory: { 6: { mouth: 1 } },
  attack_power: { 5: { brows: 1 }, 7: { mouth: 1 }, 26: { brows: 0, mouth: 0 } },
  'attack_power@hammer': { 7: { brows: 1 }, 10: { mouth: 1 }, 32: { brows: 0, mouth: 0 } },
  'attack_power@spear': { 5: { brows: 1 }, 7: { mouth: 1 }, 26: { brows: 0, mouth: 0 } },
  charge: { 2: { brows: 1 }, 36: { brows: 0 } },
  taunt: { 6: { brows: 1, mouth: 1 }, 44: { brows: 0, mouth: 0 } },
  block: { 2: { brows: 1 }, 18: { brows: 0 } },
  'block@shield': { 2: { brows: 1 }, 18: { brows: 0 } },
  guard_up: { 2: { brows: 1 } },
  'guard_up@shield': { 2: { brows: 1 } },
  guard: { 0: { brows: 1 } },
  'guard@shield': { 0: { brows: 1 } },
};

/**
 * Shield clips (#38): the Animator plays `block@shield` instead of `block` when the fighter carries a shield.
 * The back arm swings the shield up in front of the chest and face (its centre ~1.6 ahead of the pelvis, at head
 * height); the sword arm stays cocked low behind it instead of parrying. The rig keeps the shield upright (src/rig/shield.ts).
 */
export const SHIELD_CLIPS: Clip[] = [
  {
    name: 'block@shield', length: 18,
    events: [{ f: 2, type: 'block' }],
    keys: [
      { f: 0 },
      { f: 2, x: -0.15, ease: 'out', pose: SHIELD_GUARD_POSE },
      { f: 12, x: -0.2, pose: { torso: 9 } },
      { f: 18, x: 0, pose: { torso: 3, head: -3, arm_f_up: 22, arm_f_lo: 62, hand_f: -10, weapon: -40, arm_b_up: -18, arm_b_lo: 35, leg_b_up: -14 } },
    ],
  },
  {
    // the Block action behind a shield (#273): raised and held until the blow, like `guard_up` / `guard`
    name: 'guard_up@shield', length: 8,
    events: [{ f: 2, type: 'block' }],
    keys: [
      { f: 0 },
      { f: 2, x: -0.15, ease: 'out', pose: SHIELD_GUARD_POSE },
      { f: 8, x: -0.2, pose: { torso: 9 } },
    ],
  },
  {
    name: 'guard@shield', length: 48, loop: true,
    keys: [
      { f: 0, x: -0.2, pose: { ...SHIELD_GUARD_POSE, torso: 9 } },
      { f: 24, x: -0.2, pose: { torso: 11, head: 7, arm_b_up: 80 } },
      { f: 48, x: -0.2, pose: { torso: 9, head: 6, arm_b_up: 78 } },
    ],
  },
];

function withFace(c: Clip): Clip {
  const faces = CLIP_FACES[c.name];
  if (!faces) return c;
  return { ...c, keys: c.keys.map((k) => (faces[k.f] ? { ...k, pose: { ...(k.pose ?? {}), ...faces[k.f] } } : k)) };
}

/** every clip including the weapon-family variants (`attack_power@hammer`, src/anim/weaponClips.ts), with faces */
export const ALL_CLIPS: Clip[] = [...CLIPS, ...FINISHER_CLIPS, ...WEAPON_CLIPS, ...heldWalks(CLIPS), ...heldDodges(CLIPS), ...SHIELD_CLIPS].map(withFace);

export function bakeAll(stance: Pose): Record<string, Baked> {
  const o: Record<string, Baked> = {};
  for (const c of ALL_CLIPS) o[c.name] = bake(c, stance);
  return o;
}
