/**
 * Keyframed cut-out animation clips (30 fps, like the reference).
 *
 * A key holds bone rotations (degrees, CCW; only the bones that change) and optional root offset in rig units
 * (x = forward in the fighter's facing, y = up). Missing bones carry over from the previous key (the first key
 * starts from the stance). `ease` shapes the segment that ENDS at this key.
 * Grounded keys (default) get their root height corrected so the lowest foot stays on the floor; set air: true for
 * jumps / falls where root.y is authored by hand.
 */
import type { Pose } from '../rig/PaperRig';

export type Ease = 'linear' | 'in' | 'out' | 'inout' | 'step' | 'back';
export interface Key { f: number; pose?: Pose; x?: number; y?: number; ease?: Ease; air?: boolean }
export interface ClipEvent { f: number; type: 'hit' | 'block' | 'land' | 'swing' | 'impact' | 'end' }
export interface Clip { name: string; length: number; loop?: boolean; hold?: boolean; keys: Key[]; events?: ClipEvent[] }

export interface Sample { pose: Pose; x: number; y: number; air: boolean }

const EASE: Record<Ease, (t: number) => number> = {
  linear: (t) => t,
  in: (t) => t * t,
  out: (t) => 1 - (1 - t) * (1 - t),
  inout: (t) => t * t * (3 - 2 * t),
  step: (t) => (t < 1 ? 0 : 1),
  back: (t) => { const c = 1.7; const u = t - 1; return 1 + (c + 1) * u * u * u + c * u * u; },
};

/** resolve carry-over once: every key gets a full pose */
export function bake(clip: Clip, stance: Pose): Clip & { full: { f: number; pose: Pose; x: number; y: number; ease: Ease; air: boolean }[] } {
  let pose = { ...stance }, x = 0, y = 0;
  const full = clip.keys.map((k) => {
    const kp = { ...(k.pose ?? {}) };
    const blade = kp.blade;
    delete kp.blade;
    pose = { ...pose, ...kp };
    // 'blade' = wanted world angle of the sword (deg CCW from +x); solve the weapon bone for it
    if (blade !== undefined) pose.weapon = blade - ((pose.pelvis ?? 0) + (pose.torso ?? 0) + (pose.arm_f_up ?? 0) + (pose.arm_f_lo ?? 0) + (pose.hand_f ?? 0));
    // grounded keys keep both soles flat unless a foot angle is given
    if (!k.air) {
      if (kp.foot_f === undefined) pose.foot_f = -((pose.pelvis ?? 0) + (pose.leg_f_up ?? 0) + (pose.leg_f_lo ?? 0));
      if (kp.foot_b === undefined) pose.foot_b = -((pose.pelvis ?? 0) + (pose.leg_b_up ?? 0) + (pose.leg_b_lo ?? 0));
    }
    x = k.x ?? x;
    y = k.y ?? y;
    return { f: k.f, pose, x, y, ease: k.ease ?? 'inout', air: !!k.air };
  });
  return { ...clip, full };
}

export type Baked = ReturnType<typeof bake>;

export function sample(c: Baked, frame: number): Sample {
  const K = c.full;
  if (frame <= K[0].f) return { pose: K[0].pose, x: K[0].x, y: K[0].y, air: K[0].air };
  for (let i = 1; i < K.length; i++) {
    const a = K[i - 1], b = K[i];
    if (frame <= b.f) {
      const t = EASE[b.ease]((frame - a.f) / Math.max(1e-6, b.f - a.f));
      const pose: Pose = {};
      for (const k of new Set([...Object.keys(a.pose), ...Object.keys(b.pose)])) {
        const va = a.pose[k] ?? 0, vb = b.pose[k] ?? 0;
        pose[k] = va + (vb - va) * t;
      }
      return { pose, x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, air: a.air || b.air };
    }
  }
  const z = K[K.length - 1];
  return { pose: z.pose, x: z.x, y: z.y, air: z.air };
}

export function lerpPose(a: Pose, b: Pose, t: number): Pose {
  const o: Pose = {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) o[k] = (a[k] ?? 0) + ((b[k] ?? 0) - (a[k] ?? 0)) * t;
  return o;
}
