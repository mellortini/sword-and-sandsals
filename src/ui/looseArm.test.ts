import { describe, expect, it } from 'vitest';
import { lowest, lyingRotation } from './looseArm';

describe('loose arm (#332)', () => {
  it('lies down level with the sand, turning as little as it can', () => {
    for (const angle of [0.3, Math.PI / 2, -2.1, 3]) {
      for (const rot of [0, 1.2, -4, 7.5]) {
        const r = lyingRotation(angle, rot);
        expect(Math.abs(Math.sin(angle + r))).toBeLessThan(1e-9);
        expect(Math.abs(r - rot)).toBeLessThanOrEqual(Math.PI / 2 + 1e-9);
      }
    }
  });

  it('finds the lowest point of the turned piece', () => {
    const hull = [{ x: 0, y: 0 }, { x: 0, y: 40 }, { x: 10, y: 20 }];
    expect(lowest(hull, 0)).toBeCloseTo(40);
    // a quarter turn clockwise on screen: +x goes down
    expect(lowest(hull, Math.PI / 2)).toBeCloseTo(10);
  });
});
