import { describe, expect, it } from 'vitest';
import { forwardKinematics } from '../rig/twoHand';
import { HEAD_CENTRE, headAt, poseWithLooseHead } from './decap';
import { FINISHER_CLIPS } from './finisherClips';

const decap = FINISHER_CLIPS.find((c) => c.name === 'finish_decap')!;
const flight = decap.head!;
const BONES = [
  { name: 'pelvis', parent: null, x: 0, y: 4.75 },
  { name: 'torso', parent: 'pelvis', x: 0, y: 0 },
  { name: 'head', parent: 'torso', x: 0.12, y: 3.35 },
];

describe('loose head (#20)', () => {
  it('leaves from the neck, rises, then comes down and stays on the sand', () => {
    expect(headAt({ ...flight, from: 3 }, 2)).toBeNull();
    expect(headAt(flight, 0)).toEqual(flight.start);
    const heights = Array.from({ length: decap.length + 1 }, (_, f) => headAt(flight, f)!.h);
    expect(Math.max(...heights)).toBeGreaterThan(flight.start.h + 0.5);
    const rest = flight.hops.at(-1)!;
    expect(Math.min(...heights)).toBeGreaterThanOrEqual(rest.h - 1e-9);
    expect(headAt(flight, decap.length)).toEqual({ x: rest.x, h: rest.h, rot: rest.rot });
  });

  it('bounces on the frames that throw paper', () => {
    const bounces = decap.events!.filter((e) => e.type === 'bounce').map((e) => e.f);
    expect(bounces).toEqual(flight.hops.slice(0, bounces.length).map((h) => h.f));
  });

  it('puts the head centre where the path says, however the body moves', () => {
    const head = { x: 2, h: 1.2, rot: -300 };
    const rootX = -1.5, lift = -4.2, floor = -0.3;
    const pose = poseWithLooseHead({ pelvis: 88, torso: 8 }, head, rootX, lift, floor);
    const joint = forwardKinematics(BONES, pose).get('head')!;
    const c = Math.cos(joint.r), s = Math.sin(joint.r);
    expect(joint.x + HEAD_CENTRE.x * c - HEAD_CENTRE.y * s + rootX).toBeCloseTo(head.x);
    expect(joint.y + HEAD_CENTRE.x * s + HEAD_CENTRE.y * c + lift - floor).toBeCloseTo(head.h);
  });

  it('has a version without gore that keeps the fighter in one piece', () => {
    const fold = FINISHER_CLIPS.find((c) => c.name === 'finish_fold')!;
    expect(fold.head).toBeUndefined();
    expect(fold.hold).toBe(true);
  });
});
