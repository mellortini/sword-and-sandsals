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
import { headAt } from './decap';
import type { HeadFlight, LooseHead } from './decap';

export type Ease = 'linear' | 'in' | 'out' | 'inout' | 'step' | 'back';
export interface Key { f: number; pose?: Pose; x?: number; y?: number; ease?: Ease; air?: boolean }
/** `struck` = the fighter flinches from a blow (#17: paper flakes fly off), `impact` = the body hits the sand */
/** `step` = a foot comes down while walking (#18: footstep sound) */
export interface ClipEvent { f: number; type: 'hit' | 'block' | 'land' | 'swing' | 'impact' | 'struck' | 'step' | 'cut' | 'bounce' | 'end' }
/**
 * `name@family` makes a clip the variant of `name` for one weapon family (Animator picks it by the look's weapon).
 * `reach` = how much further than a sword the weapon strikes (units): the attack lunge is that much shorter.
 * `head` = the head leaves the neck and flies on its own path (finishers, #20, src/anim/decap.ts).
 */
export interface Clip { name: string; length: number; loop?: boolean; hold?: boolean; keys: Key[]; events?: ClipEvent[]; reach?: number; head?: HeadFlight }

export interface Sample { pose: Pose; x: number; y: number; air: boolean; head?: LooseHead }

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
    // root height carries over only between air keys; a grounded key without y stands on the floor (y = 0),
    // otherwise the last airborne height leaks into the landing (#154: jump landed 1 unit up, then slid down)
    y = k.y ?? (k.air ? y : 0);
    return { f: k.f, pose, x, y, ease: k.ease ?? 'inout', air: !!k.air };
  });
  return { ...clip, full };
}

export type Baked = ReturnType<typeof bake>;

export function sample(c: Baked, frame: number): Sample {
  const head = c.head ? headAt(c.head, frame) : null;
  return head ? { ...sampleBody(c, frame), head } : sampleBody(c, frame);
}

function sampleBody(c: Baked, frame: number): Sample {
  const K = c.full;
  if (frame <= K[0].f) return { pose: K[0].pose, x: K[0].x, y: K[0].y, air: K[0].air };
  for (let i = 1; i < K.length; i++) {
    const a = K[i - 1], b = K[i];
    if (frame <= b.f) {
      const u = (frame - a.f) / Math.max(1e-6, b.f - a.f);
      const t = EASE[b.ease](u);
      const pose: Pose = {};
      for (const k of new Set([...Object.keys(a.pose), ...Object.keys(b.pose)])) {
        const va = a.pose[k] ?? 0, vb = b.pose[k] ?? 0;
        pose[k] = va + (vb - va) * t;
      }
      // on the key itself its own air flag counts (a landing key is grounded)
      return { pose, x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, air: u >= 1 ? b.air : a.air || b.air };
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
