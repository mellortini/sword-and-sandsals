import { describe, expect, it } from 'vitest';
import kitJson from '../../assets/chars/kit/kit.json';
import { forwardKinematics, type Bone } from '../rig/twoHand';
import { sample } from './clip';
import { bakeAll } from './clips';

const kit = kitJson as unknown as { bones: Bone[]; pose_test: Record<string, number> };
const SOLE = [[-0.38, -0.42], [1.05, -0.42]] as const; // heel / toe, as PaperRig.soleLow
const FEET = ['foot_b', 'foot_f'] as const;

/** each foot's ankle x and lowest sole point (rig units, relative to the pelvis) */
function feet(pose: Record<string, number>) {
  const J = forwardKinematics(kit.bones, pose);
  return Object.fromEntries(FEET.map((f) => {
    const t = J.get(f)!;
    return [f, { x: t.x, y: Math.min(...SOLE.map(([px, py]) => t.y + px * Math.sin(t.r) + py * Math.cos(t.r))) }];
  })) as Record<(typeof FEET)[number], { x: number; y: number }>;
}

const clips = bakeAll(kit.pose_test);
const floor = Math.min(...FEET.map((f) => feet(kit.pose_test)[f].y));

/** both feet in world units over the clip (x along the facing, y above the floor), as the Animator places the rig */
function track(name: string) {
  const c = clips[name];
  return Array.from({ length: c.length + 1 }, (_, f) => {
    const s = sample(c, f), ft = feet(s.pose);
    const low = Math.min(ft.foot_b.y, ft.foot_f.y);
    const lift = s.air ? s.y : s.y + floor - low;
    return Object.fromEntries(FEET.map((k) => [k, { x: s.x + ft[k].x, y: ft[k].y + lift - floor }])) as Record<(typeof FEET)[number], { x: number; y: number }>;
  });
}

describe('feet on the floor (#7)', () => {
  it('walk_back: the standing foot does not slide while the other one steps', () => {
    const t = track('walk_back');
    for (const foot of FEET) {
      let planted: number | null = null;
      for (const fr of t) {
        if (fr[foot].y > 0.03) { planted = null; continue; }
        planted ??= fr[foot].x;
        expect(Math.abs(fr[foot].x - planted)).toBeLessThan(0.2);
      }
    }
  });

  it('death: the feet stay on the floor while the knees buckle and rest on it when lying', () => {
    const t = track('death');
    for (const fr of t.slice(0, 22)) expect(Math.min(fr.foot_b.y, fr.foot_f.y)).toBeGreaterThan(-0.25);
    const end = t[t.length - 1];
    expect(Math.min(end.foot_b.y, end.foot_f.y)).toBeGreaterThan(-0.1);
    expect(Math.min(end.foot_b.y, end.foot_f.y)).toBeLessThan(0.3);
  });
});
