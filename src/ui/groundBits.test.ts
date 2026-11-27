import { describe, expect, it } from 'vitest';
import { GroundBits, MAX_BITS } from './groundBits';
import { ALL_CLIPS } from '../anim/clips';

/** deterministic random for the tests */
function seeded(seed = 1) {
  let s = seed;
  return () => ((s = (Math.imul(s, 1_664_525) + 1_013_904_223) >>> 0) / 0x1_0000_0000);
}

const FLOOR = 890;

describe('ground bits (#17)', () => {
  it('a landing puffs dust to both sides and throws flakes that come down on the sand', () => {
    const g = new GroundBits(seeded());
    g.kick('land', 500, FLOOR, 1);
    const puffs = g.bits.filter((b) => b.kind === 'puff');
    expect(puffs.some((b) => b.vx < 0) && puffs.some((b) => b.vx > 0)).toBe(true);
    const flakes = g.bits.filter((b) => b.kind === 'flake');
    expect(flakes.length).toBeGreaterThan(3);
    for (let i = 0; i < 30; i++) g.step(1);
    for (const f of flakes) {
      expect(f.down).toBe(true);
      expect(Math.abs(f.y - FLOOR)).toBeLessThan(20);
    }
  });

  it('a charge throws its paper forward (the way the fighter faces)', () => {
    for (const dir of [1, -1] as const) {
      const g = new GroundBits(seeded(3));
      g.kick('charge', 800, FLOOR, dir);
      const paper = g.bits.filter((b) => b.kind !== 'puff');
      const meanVx = paper.reduce((s, b) => s + b.vx, 0) / paper.length;
      expect(Math.sign(meanVx)).toBe(dir);
    }
  });

  it('struck flakes start at the given height and fly away from the blow', () => {
    const g = new GroundBits(seeded(5));
    g.kick('struck', 900, FLOOR, -1, 700);
    expect(g.bits.length).toBeGreaterThan(0);
    for (const b of g.bits) {
      expect(b.kind).toBe('flake');
      expect(b.y).toBe(700);
      expect(b.vx).toBeLessThan(0);
    }
  });

  it('puffs grow and fade; everything is gone within two seconds', () => {
    const g = new GroundBits(seeded(7));
    g.kick('fall', 600, FLOOR, -1);
    const puff = g.bits.find((b) => b.kind === 'puff')!;
    const s0 = puff.scale, a0 = puff.alpha;
    for (let i = 0; i < 10; i++) g.step(1);
    expect(puff.scale).toBeGreaterThan(s0);
    expect(puff.alpha).toBeLessThan(a0);
    for (let i = 0; i < 50; i++) g.step(1);
    expect(g.bits.length).toBe(0);
  });

  it('never keeps more than MAX_BITS pieces, however often it is kicked', () => {
    const g = new GroundBits(seeded(9));
    for (let i = 0; i < 40; i++) { g.kick('charge', 500, FLOOR, 1); g.step(0.5); }
    expect(g.bits.length).toBeLessThanOrEqual(MAX_BITS);
  });
});

describe('clip events for ground fx (#17)', () => {
  const events = (name: string) => ALL_CLIPS.find((c) => c.name === name)!.events?.map((e) => e.type) ?? [];
  it('fire on landing, on the body hitting the sand and on flinching', () => {
    expect(events('jump')).toContain('land');
    expect(events('charge')).toContain('impact');
    expect(events('death')).toEqual(expect.arrayContaining(['struck', 'impact']));
    expect(events('hit')).toContain('struck');
    expect(events('knockback')).toContain('struck');
  });
});
