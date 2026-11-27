import { describe, expect, it } from 'vitest';
import { bake, sample } from './clip';
import { ALL_CLIPS, bakeAll } from './clips';

describe('bake: root height', () => {
  it('puts a grounded key without y back on the floor after air keys', () => {
    const c = bake({
      name: 't', length: 10, keys: [
        { f: 0 },
        { f: 4, air: true, y: 2 },
        { f: 6, air: true },
        { f: 10 },
      ],
    }, {});
    expect(c.full.map((k) => k.y)).toEqual([0, 2, 2, 0]);
  });

  it('keeps an explicit y on a grounded key', () => {
    const c = bake({ name: 't', length: 4, keys: [{ f: 0 }, { f: 4, y: -0.5 }] }, {});
    expect(c.full[1].y).toBe(-0.5);
  });

  it('ends every non-looping, non-holding clip with both feet planted (root y = 0, grounded)', () => {
    const baked = bakeAll({});
    for (const clip of ALL_CLIPS.filter((c) => !c.loop && !c.hold)) {
      const end = sample(baked[clip.name], clip.length);
      expect({ clip: clip.name, y: end.y, air: end.air }).toEqual({ clip: clip.name, y: 0, air: false });
    }
  });
});

describe('dodge (#13)', () => {
  const baked = bakeAll({});

  it('lasts 10-14 frames, leans away with a step back and ends where it started', () => {
    const c = baked.dodge;
    expect(c.length).toBeGreaterThanOrEqual(10);
    expect(c.length).toBeLessThanOrEqual(14);
    const deepest = sample(c, 3);
    expect(deepest.x).toBeLessThan(-0.5);
    expect(deepest.pose.torso).toBeGreaterThan(15);
    expect(sample(c, c.length).x).toBe(0);
  });

  it('has hammer, spear and axe variants that keep the weapon in its ready angle while leaning', () => {
    for (const fam of ['hammer', 'spear', 'axe']) {
      const v = baked[`dodge@${fam}`];
      const ready = baked[`idle@${fam}`].full[0].pose;
      const mid = sample(v, 3).pose;
      expect(mid.arm_f_up).toBeCloseTo(ready.arm_f_up ?? 0);
      expect(mid.torso).toBeGreaterThan(15);
      expect(sample(v, v.length).x).toBe(0);
    }
  });

  it('chops with the axe (#47): wound up behind the head, the head comes down on the hit and the clip ends at rest', () => {
    for (const kind of ['quick', 'normal', 'power']) {
      const c = baked[`attack_${kind}@axe`];
      const hit = c.events!.find((e) => e.type === 'hit')!.f;
      const windup = c.full.reduce((a, k) => (k.f < hit && (k.pose.arm_f_up ?? 0) > (a.pose.arm_f_up ?? 0) ? k : a), c.full[0]);
      const at = sample(c, hit).pose;
      // the axe points down-forward on the hit, after being raised over the shoulder
      const blade = (p: typeof at) => (p.pelvis ?? 0) + (p.torso ?? 0) + (p.arm_f_up ?? 0) + (p.arm_f_lo ?? 0) + (p.hand_f ?? 0) + (p.weapon ?? 0);
      expect(blade(windup.pose), kind).toBeGreaterThan(140);
      expect(blade(at), kind).toBeLessThan(0);
      expect(sample(c, c.length).x).toBe(0);
      expect(sample(c, c.length).pose.arm_f_up).toBeCloseTo(baked['idle@axe'].full[0].pose.arm_f_up ?? 0);
    }
  });

  it('stabs twice with the daggers (#47): front hand on the hit, back hand after it, both blades solved', () => {
    for (const kind of ['quick', 'normal']) {
      const c = baked[`attack_${kind}@daggers`];
      const hit = c.events!.find((e) => e.type === 'hit')!.f;
      const second = c.events!.find((e) => e.type === 'swing')!.f;
      expect(second, kind).toBeGreaterThan(hit);
      expect(sample(c, hit).pose.arm_f_up, kind).toBeGreaterThan(70);
      expect(sample(c, second).pose.arm_b_up, kind).toBeGreaterThan(70);
      expect(c.reach).toBeLessThan(0);
    }
    // blade_b is the back weapon's world angle, like blade for the front one
    const p = sample(baked['idle@daggers'], 0).pose;
    expect((p.pelvis ?? 0) + (p.torso ?? 0) + (p.arm_b_up ?? 0) + (p.arm_b_lo ?? 0) + (p.hand_b ?? 0) + (p.weapon_b ?? 0)).toBeCloseTo(34);
    expect(p.blade_b).toBeUndefined();
  });
});
