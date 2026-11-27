import { describe, expect, it } from 'vitest';
import sheet from '../../assets/fx/status.json';
import kitJson from '../../assets/chars/kit/kit.json';
import type { StatusKind } from '../core/status';
import { statusBits } from './statusBits';

const KINDS: StatusKind[] = ['burning', 'soaked', 'stunned', 'taped', 'torn', 'feared', 'slowed'];
const bones = new Set(kitJson.bones.map((b) => b.name));

describe('status effects on the fighters (#50)', () => {
  it('shows every status with pieces the sheet has, on bones the rig has', () => {
    for (const kind of KINDS) {
      const bits = statusBits([{ kind, stacks: 1 }], 0.3);
      expect(bits.length, kind).toBeGreaterThan(0);
      for (const b of bits) {
        expect(sheet.frames, `${kind} ${b.frame}`).toHaveProperty(b.frame);
        expect(bones.has(b.bone), `${kind} ${b.bone}`).toBe(true);
        expect(b.alpha).toBeGreaterThanOrEqual(0);
        expect(b.alpha).toBeLessThanOrEqual(1);
        expect(b.scale).toBeGreaterThan(0);
      }
    }
    expect(statusBits([], 1)).toEqual([]);
  });

  it('adds a flame, a strip of tape or a tear per stack', () => {
    for (const kind of ['burning', 'taped', 'torn'] as const) {
      const count = (stacks: number) => statusBits([{ kind, stacks }], 0).length;
      expect([count(1), count(2), count(3)], kind).toEqual([1, 2, 3]);
    }
  });

  it('keeps flames, drops and stars upright, stains and tape on the body', () => {
    const at = (kind: StatusKind) => statusBits([{ kind, stacks: 2 }], 0.5);
    expect(at('burning').every((b) => b.upright)).toBe(true);
    expect(at('stunned').every((b) => b.upright)).toBe(true);
    expect(at('taped').some((b) => b.upright)).toBe(false);
    const soaked = at('soaked');
    expect(soaked.filter((b) => b.frame.startsWith('blot')).every((b) => b.multiply && !b.upright)).toBe(true);
    expect(soaked.find((b) => b.frame === 'drop')?.upright).toBe(true);
  });

  it('moves over time: stars circle the head, drops fall', () => {
    const stars = (t: number) => statusBits([{ kind: 'stunned', stacks: 1 }], t).map((b) => [b.wx, b.wy]);
    expect(stars(0)).not.toEqual(stars(0.4));
    for (const t of [0, 0.3, 0.7, 1.1]) {
      for (const [wx, wy] of stars(t)) expect(Math.hypot(wx! / 1.3, wy! / 0.35)).toBeCloseTo(1);
    }
    const drop = (t: number) => statusBits([{ kind: 'soaked', stacks: 1 }], t).find((b) => b.frame === 'drop')!.wy!;
    expect(drop(0.5)).toBeLessThan(drop(0.2));
  });
});
