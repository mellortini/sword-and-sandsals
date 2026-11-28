/**
 * Where the status effects sit on a fighter (#50), pure so it can be tested: for a list of statuses and a time, the
 * paper bits to draw (frames of assets/fx/status.png, rendered by blender/status_fx.py), each on a bone.
 *  - burning: paper flames on the torso, then the arm and the thigh (one per stack), flickering
 *  - soaked: dark wet stains on the body and drops running off it
 *  - stunned: three stars circling the head
 *  - taped: strips of tape stuck across the body (one per stack)
 *  - torn: torn flaps in the paper (one per stack)
 *  - feared: sweat drops flying off the head
 *  - slowed: glue hanging from a hand and a foot
 *  - netted: the trident's rope net thrown over the chest (#258), swaying a little
 */
import type { StatusKind } from '../core/status';

export interface StatusBit {
  frame: string;
  bone: string;
  /** on the bone, rig units (y up) */
  x: number;
  y: number;
  /** after the bone: rig units, world axes (y up), so drops fall and stars circle whatever the pose */
  wx?: number;
  wy?: number;
  /** radians, clockwise on screen; on the bone's angle unless `upright` */
  rot: number;
  /** keeps the world's up (flames, drops, stars) instead of turning with the bone (stains, tape) */
  upright?: boolean;
  scale: number;
  alpha: number;
  /** stains darken the paper under them */
  multiply?: boolean;
}

export interface ShownStatus { readonly kind: StatusKind; readonly stacks: number }

/** the sheet's pieces are small cut-outs; on a fighter they are drawn this many times larger (rig units stay readable) */
const SIZE = 2;

const SPOTS = {
  burning: [['torso', 0.45, 2.0], ['arm_f_up', 0.0, -1.2], ['leg_f_up', 0.1, -1.3]],
  soaked: [['torso', 0.3, 1.1], ['leg_b_up', 0.0, -1.1]],
  taped: [['torso', 0.2, 1.9, 0.5, 'tape1'], ['torso', 0.35, 0.9, -0.4, 'tape2'], ['arm_f_up', 0.0, -1.0, 1.35, 'tape2']],
  torn: [['torso', 0.5, 2.2, 0.25], ['leg_f_up', 0.1, -1.3, -0.5], ['arm_b_up', 0.0, -1.0, 1.2]],
} as const;

const DROP_EVERY = 0.9;
const SWEAT_EVERY = 0.75;
const fraction = (v: number) => v - Math.floor(v);

/** the bits for one fighter's statuses at time `t` (seconds) */
export function statusBits(statuses: readonly ShownStatus[], t: number): StatusBit[] {
  const out: StatusBit[] = [];
  for (const { kind, stacks } of statuses) {
    const n = Math.max(1, stacks);
    switch (kind) {
      case 'burning':
        SPOTS.burning.slice(0, n).forEach(([bone, x, y], i) => out.push({
          frame: `flame${(i % 3) + 1}`, bone, x, y, upright: true,
          rot: 0.08 * Math.sin(t * 7 + i * 2.1), scale: SIZE * (0.9 + 0.12 * Math.sin(t * 13 + i * 1.7)), alpha: 1,
        }));
        break;
      case 'soaked': {
        SPOTS.soaked.slice(0, n).forEach(([bone, x, y], i) => out.push({ frame: `blot${i + 1}`, bone, x, y, rot: i * 0.6, scale: SIZE * 1.1, alpha: 0.55, multiply: true }));
        // a drop runs off the chest, falling faster and faster, every DROP_EVERY seconds
        const p = fraction(t / DROP_EVERY);
        out.push({ frame: 'drop', bone: 'torso', x: 0.9, y: 0.6, wy: -3 * p * p, upright: true, rot: 0, scale: SIZE * 0.8, alpha: p < 0.85 ? 1 : (1 - p) / 0.15 });
        break;
      }
      case 'stunned':
        for (let i = 0; i < 3; i++) {
          const a = t * 3.2 + (i * Math.PI * 2) / 3;
          out.push({
            frame: 'star', bone: 'head', x: 0.15, y: 2.9, wx: 1.3 * Math.cos(a), wy: 0.35 * Math.sin(a), upright: true,
            rot: t * 4 + i, scale: SIZE * (0.8 + 0.18 * Math.sin(a)), alpha: 1,
          });
        }
        break;
      case 'taped':
        SPOTS.taped.slice(0, n).forEach(([bone, x, y, rot, frame]) => out.push({ frame, bone, x, y, rot, scale: SIZE, alpha: 0.92 }));
        break;
      case 'torn':
        SPOTS.torn.slice(0, n).forEach(([bone, x, y, rot]) => out.push({ frame: 'rip', bone, x, y, rot, scale: SIZE, alpha: 1 }));
        break;
      case 'feared':
        for (const [side, off] of [[-1, 0], [1, 0.5]] as const) {
          const p = fraction(t / SWEAT_EVERY + off);
          out.push({
            frame: 'sweat', bone: 'head', x: side < 0 ? -0.7 : 1.1, y: 2.1, wx: side * 1.0 * p, wy: 0.5 * p - 1.4 * p * p,
            upright: true, rot: side * (0.4 + p), scale: SIZE * 0.85, alpha: 1 - p,
          });
        }
        break;
      case 'blinded':
        // sand in the eyes (#295): a grey-gold smear across the face
        out.push({ frame: 'blot1', bone: 'head', x: 0.7, y: 1.5, rot: 0.3, scale: SIZE * 0.75, alpha: 0.55, multiply: true });
        break;
      case 'netted':
        out.push({ frame: 'mesh', bone: 'torso', x: 0.35, y: 1.6, rot: 0.15 + 0.04 * Math.sin(t * 2.4), scale: SIZE * 1.15, alpha: 1 });
        break;
      case 'slowed':
        for (const [bone, x, y, i] of [['hand_f', 0.05, -0.7, 0], ['foot_f', 0.5, -0.55, 1]] as const) {
          out.push({ frame: 'glue', bone, x, y, upright: true, rot: 0.05 * Math.sin(t * 2 + i), scale: SIZE * (0.8 + 0.08 * Math.sin(t * 2.2 + i)), alpha: 0.95 });
        }
        break;
    }
  }
  return out;
}
