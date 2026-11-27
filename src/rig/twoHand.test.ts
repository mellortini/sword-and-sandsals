import { describe, expect, it } from 'vitest';
import kitJson from '../../assets/chars/kit/kit.json';
import { ALL_CLIPS, bakeAll } from '../anim/clips';
import { sample } from '../anim/clip';
import { MAX_SHOULDER_SHIFT, forwardKinematics, holdWithBothHands } from './twoHand';
import type { Bone } from './twoHand';

const kit = kitJson as unknown as {
  bones: Bone[]; pose_test: Record<string, number>; sprites: Record<string, { grip2?: [number, number] }>;
};

/** where the back hand closes, in the weapon's own frame (x along the haft, y across it) */
function backGrip(pose: Record<string, number>, grip2: readonly [number, number]) {
  const held = holdWithBothHands(kit.bones, pose, grip2);
  const J = forwardKinematics(kit.bones, held);
  const off = kit.bones.find((b) => b.name === 'weapon')!;
  const hb = J.get('hand_b')!, w = J.get('weapon')!;
  const hx = hb.x + off.x * Math.cos(hb.r) - off.y * Math.sin(hb.r), hy = hb.y + off.x * Math.sin(hb.r) + off.y * Math.cos(hb.r);
  const dx = hx - w.x, dy = hy - w.y;
  return { along: dx * Math.cos(w.r) + dy * Math.sin(w.r), across: -dx * Math.sin(w.r) + dy * Math.cos(w.r), held };
}

describe('two-handed grip (#36)', () => {
  it('kit marks spears and hammers as two-handed, swords not', () => {
    expect(kit.sprites.weapon_spear5.grip2).toBeDefined();
    expect(kit.sprites.weapon_hammer5.grip2).toBeDefined();
    expect(kit.sprites.weapon_sword5.grip2).toBeUndefined();
  });

  it('the back hand stays on the haft, behind the front hand, through every frame of the hammer and spear clips', () => {
    const baked = bakeAll(kit.pose_test);
    for (const fam of ['hammer', 'spear']) {
      const grip2 = kit.sprites[`weapon_${fam}5`].grip2!;
      for (const clip of ALL_CLIPS.filter((c) => c.name.endsWith(`@${fam}`))) {
        const c = baked[clip.name];
        for (let f = 0; f <= c.length; f++) {
          const at = `${clip.name} frame ${f}`;
          const { along, across, held } = backGrip(sample(c, f).pose, grip2);
          expect(Math.abs(across), at).toBeLessThan(0.05);
          expect(along, at).toBeGreaterThanOrEqual(grip2[0] - 0.01);
          expect(along, at).toBeLessThan(-0.7);
          expect(held.arm_b_lo, `${at} elbow`).toBeGreaterThanOrEqual(-0.01);
          expect(held.arm_b_shift, at).toBeLessThanOrEqual(MAX_SHOULDER_SHIFT);
        }
      }
    }
  });
});
