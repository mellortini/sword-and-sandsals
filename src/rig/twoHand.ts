/**
 * Two-handed weapons (#36): spears and war hammers are held with both hands. The clips animate the front arm and
 * the weapon as for a sword; this bends the BACK arm (two-bone IK) so the back hand holds the haft at `grip2`
 * (weapon-bone units, from kit.json). Pure maths on rig units (y up, angles CCW), so it is unit-tested.
 *
 * Seen from the side the shoulders are far apart (the back one is behind the chest), so a straight back arm often
 * cannot reach a haft held out in front. A real fighter turns the chest into a two-handed grip; the puppet does the
 * same by sliding the back shoulder forward along the torso (pose key `arm_b_shift`, hidden behind the torso).
 * If that is still not enough, the back hand slides up the haft towards the front hand.
 */
import type { Pose } from './PaperRig';

export interface Bone { name: string; parent: string | null; x: number; y: number }
export interface Joint { x: number; y: number; r: number }

/** how far the back shoulder may come forward along the torso (units) */
export const MAX_SHOULDER_SHIFT = 2.7;
/** the back hand never slides closer than this to the front hand (weapon-bone x) */
const CLOSEST_GRIP = -0.75;
/** keep the arm a little bent at full reach */
const SLACK = 0.18;

/** a bone's joint offset in its parent, with the two-handed shoulder shift applied */
export function boneOffset(b: Bone, pose: Pose): { x: number; y: number } {
  if (b.name === 'arm_b_up') return { x: b.x + (pose.arm_b_shift ?? 0), y: b.y };
  // the weapon shoulder slides back along the torso in the quarter turn (#273, #280, `quarterTurn`)
  if (b.name === 'arm_f_up') return { x: b.x + (pose.arm_f_shift ?? 0), y: b.y };
  return { x: b.x, y: b.y };
}

/** a head torn off its neck (finishers, #20) sits where the pose puts it, whatever the torso does */
export function looseHead(pose: Pose): Joint {
  return { x: pose.head_x ?? 0, y: pose.head_y ?? 0, r: ((pose.head_rot ?? 0) * Math.PI) / 180 };
}

/** forward kinematics in rig units: joint position and world rotation (radians CCW) of every bone */
export function forwardKinematics(bones: readonly Bone[], pose: Pose): Map<string, Joint> {
  const out = new Map<string, Joint>();
  for (const b of bones) {
    const rot = ((pose[b.name] ?? 0) * Math.PI) / 180;
    if (!b.parent) { out.set(b.name, { x: b.x, y: b.y, r: rot }); continue; }
    if (b.name === 'head' && pose.neck_cut) { out.set(b.name, looseHead(pose)); continue; }
    const p = out.get(b.parent)!;
    const o = boneOffset(b, pose);
    const c = Math.cos(p.r), s = Math.sin(p.r);
    out.set(b.name, { x: p.x + o.x * c - o.y * s, y: p.y + o.x * s + o.y * c, r: p.r + rot });
  }
  return out;
}

const DEG = 180 / Math.PI;
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * The pose with arm_b_shift / arm_b_up / arm_b_lo / hand_b solved so the back hand grips the weapon's haft.
 * The back hand holds the haft the way the front hand does (same angle to the weapon); the elbow bends the natural
 * way (forearm folding forward, like the idle stance).
 */
export function holdWithBothHands(bones: readonly Bone[], pose: Pose, grip2: readonly [number, number]): Pose {
  const bone = (n: string) => bones.find((b) => b.name === n)!;
  // the shoulder starts where the quarter turn puts it (#280) and comes further forward only if the haft needs it
  const turnShift = pose.arm_b_shift ?? 0;
  const J = forwardKinematics(bones, { ...pose, arm_b_shift: turnShift });
  const wpn = J.get('weapon')!, torso = J.get('torso')!, shoulder0 = J.get('arm_b_up')!;
  const cw = Math.cos(wpn.r), sw = Math.sin(wpn.r);
  // the hand closes on the haft the same way as the front hand: wrist = grip point - hand -> weapon offset
  const hand = wpn.r - ((pose.weapon ?? 0) * Math.PI) / 180;
  const off = bone('weapon');
  const ch = Math.cos(hand), sh = Math.sin(hand);
  const wristAt = (gx: number) => ({
    x: wpn.x + gx * cw - grip2[1] * sw - (off.x * ch - off.y * sh),
    y: wpn.y + gx * sw + grip2[1] * cw - (off.x * sh + off.y * ch),
  });
  const lo = bone('arm_b_lo'), hb = bone('hand_b');
  const L1 = Math.hypot(lo.x, lo.y), L2 = Math.hypot(hb.x, hb.y);
  const R = L1 + L2 - SLACK;
  const u = { x: Math.cos(torso.r), y: Math.sin(torso.r) };   // forward along the torso

  /** smallest forward shoulder shift that brings `w` within reach (clamped) */
  const shiftFor = (w: { x: number; y: number }) => {
    const D = { x: w.x - shoulder0.x, y: w.y - shoulder0.y };
    const du = D.x * u.x + D.y * u.y, dd = D.x * D.x + D.y * D.y;
    if (dd <= R * R) return 0;
    const disc = du * du - dd + R * R;
    const s = disc >= 0 ? du - Math.sqrt(disc) : du;
    return Math.min(MAX_SHOULDER_SHIFT, Math.max(0, s));
  };
  const gap = (w: { x: number; y: number }, s: number) =>
    Math.hypot(w.x - shoulder0.x - s * u.x, w.y - shoulder0.y - s * u.y) - R;

  // preferred grip first; slide towards the front hand only while it is out of reach
  let wrist = wristAt(grip2[0]), shift = shiftFor(wrist);
  if (gap(wrist, shift) > 1e-3) {
    let best = { wrist, shift, g: gap(wrist, shift) };
    for (let i = 1; i <= 16; i++) {
      const w = wristAt(grip2[0] + (CLOSEST_GRIP - grip2[0]) * (i / 16)), s = shiftFor(w), g = gap(w, s);
      if (g < best.g) best = { wrist: w, shift: s, g };
      if (g <= 1e-3) break;
    }
    ({ wrist, shift } = best);
  }

  const S = { x: shoulder0.x + shift * u.x, y: shoulder0.y + shift * u.y };
  const dx = wrist.x - S.x, dy = wrist.y - S.y;
  const d = Math.min(L1 + L2 - 1e-4, Math.max(Math.abs(L1 - L2) + 1e-4, Math.hypot(dx, dy)));
  const base = Math.atan2(dy, dx);
  const alpha = Math.acos((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d));
  const reach = { x: S.x + d * Math.cos(base), y: S.y + d * Math.sin(base) };
  // a bone at rotation 0 hangs down (-y): world rotation = direction + 90 deg
  let best: Pose | null = null;
  for (const sign of [1, -1]) {
    const upDir = base + sign * alpha;
    const ex = S.x + L1 * Math.cos(upDir), ey = S.y + L1 * Math.sin(upDir);
    const loDir = Math.atan2(reach.y - ey, reach.x - ex);
    const upR = upDir + Math.PI / 2, loR = loDir + Math.PI / 2;
    const bend = wrap(loR - upR);
    const solved: Pose = {
      ...pose,
      arm_b_shift: turnShift + shift,
      arm_b_up: wrap(upR - torso.r) * DEG,
      arm_b_lo: bend * DEG,
      hand_b: wrap(hand - loR) * DEG,
    };
    if (bend >= -1e-6) return solved;
    best ??= solved;
  }
  return best!;
}
