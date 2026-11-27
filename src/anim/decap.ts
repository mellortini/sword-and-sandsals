/**
 * The loose head of a finisher (#20). The body is keyframed as usual; the head leaves the skeleton and flies on its own
 * path: parabolic hops over the sand, spinning, each lower than the one before. Pure maths, so it is unit-tested.
 *
 * Path space is the world, not the (falling) body: x = units forward of where the fighter stood, h = units above the
 * floor, both for the CENTRE of the head (it spins around its middle, not around the neck).
 */
import type { Pose } from '../rig/PaperRig';

/** one arc: ends on frame `f` at (x, h) turned `rot` degrees; `peak` = extra height of the arc over its chord */
export interface Hop { f: number; x: number; h: number; rot: number; peak: number }
export interface HeadFlight { from: number; start: { x: number; h: number; rot: number }; hops: Hop[] }
export interface LooseHead { x: number; h: number; rot: number }

/** centre of the head seen from the neck joint, in head-bone units */
export const HEAD_CENTRE = { x: 0.13, y: 1.29 };

/** where the head is on `frame`; null while it is still on the neck */
export function headAt(flight: HeadFlight, frame: number): LooseHead | null {
  if (frame < flight.from) return null;
  let a = { f: flight.from, ...flight.start };
  for (const b of flight.hops) {
    if (frame <= b.f) {
      const u = (frame - a.f) / Math.max(1e-6, b.f - a.f);
      return {
        x: a.x + (b.x - a.x) * u,
        h: a.h + (b.h - a.h) * u + 4 * b.peak * u * (1 - u),
        rot: a.rot + (b.rot - a.rot) * u,
      };
    }
    a = b;
  }
  return { x: a.x, h: a.h, rot: a.rot };
}

/**
 * The body pose plus the loose head as the rig wants it: `neck_cut` and the neck joint's place in the puppet's own
 * (forward-kinematics) space. `rootX` / `lift` = where the body's root is now, `floor` = sole height of the stance.
 */
export function poseWithLooseHead(pose: Pose, head: LooseHead, rootX: number, lift: number, floor: number): Pose {
  const r = (head.rot * Math.PI) / 180;
  const c = Math.cos(r), s = Math.sin(r);
  return {
    ...pose,
    neck_cut: 1,
    head_x: head.x - (HEAD_CENTRE.x * c - HEAD_CENTRE.y * s) - rootX,
    head_y: floor + head.h - (HEAD_CENTRE.x * s + HEAD_CENTRE.y * c) - lift,
    head_rot: head.rot,
  };
}
