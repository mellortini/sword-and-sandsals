import { describe, expect, it } from 'vitest';
import { CameraJuice, PUNCH_ZOOM, cameraAt, punchEnvelope, stageTransform } from './cameraJuice';
import { cycleMotion, motionMode } from './motion';

const W = 1920, H = 1080;

describe('camera juice (#75)', () => {
  it('does nothing at all with reduce motion', () => {
    let reduced = true;
    const cam = new CameraJuice(W, H, () => reduced);
    cam.punch(1500, 400, 2);
    cam.shake(1);
    for (let i = 0; i < 10; i++) expect(cam.update(0.05)).toEqual({ x: 0, y: 0, scale: 1, rotation: 0, focusX: W / 2, focusY: H / 2 });
    reduced = false;
    cam.punch(1500, 400, 1);
    expect(cam.update(0.05).scale).toBeGreaterThan(1);
  });

  it('zooms quickly towards a crit and eases back out', () => {
    expect(punchEnvelope(0)).toBe(0);
    expect(punchEnvelope(0.06)).toBeCloseTo(1);
    expect(punchEnvelope(0.3)).toBeLessThan(1);
    expect(punchEnvelope(0.6)).toBe(0);
    const at = (t: number) => cameraAt(t, [{ start: 0, amount: 1, x: 1500, y: 300 }], [], W, H, false);
    const peak = at(0.06);
    expect(peak.scale).toBeGreaterThan(1 + PUNCH_ZOOM * 0.9);
    expect(peak.focusX).toBeCloseTo(1500);   // centred on the blow at the top of the punch
    expect(at(0.005).focusX).toBeLessThan(1500);   // sliding there, not jumping
    expect(at(1).scale).toBeLessThan(1.01);   // only the drift is left
  });

  it('shakes briefly and dies down', () => {
    const at = (t: number) => cameraAt(t, [], [{ start: 0, amount: 1 }], W, H, false);
    const calm = (t: number) => cameraAt(t, [], [], W, H, false);
    const jolt = Math.max(...[0.01, 0.02, 0.03, 0.05].map((t) => Math.hypot(at(t).x - calm(t).x, at(t).y - calm(t).y)));
    expect(jolt).toBeGreaterThan(3);
    expect(jolt).toBeLessThan(12);
    expect(at(0.5)).toEqual(calm(0.5));
  });

  it('never shows the edge of the picture', () => {
    for (const t of [0, 0.03, 0.06, 0.2, 0.8, 3.3, 10]) {
      for (const focus of [[0, 0], [W, H], [W / 2, H / 2], [1700, 200]]) {
        const pose = cameraAt(t, [{ start: 0, amount: 1.6, x: focus[0], y: focus[1] }], [{ start: 0, amount: 1 }], W, H, false);
        const s = stageTransform(pose, W, H);
        const map = (x: number, y: number) => [(x - s.pivotX) * s.scale + s.x, (y - s.pivotY) * s.scale + s.y];
        const [l, top] = map(0, 0), [r, bottom] = map(W, H);
        expect(l).toBeLessThanOrEqual(0.001);
        expect(top).toBeLessThanOrEqual(0.001);
        expect(r).toBeGreaterThanOrEqual(W - 0.001);
        expect(bottom).toBeGreaterThanOrEqual(H - 0.001);
      }
    }
  });

  it('remembers the reduce motion choice', () => {
    const before = motionMode();
    expect(['full', 'reduced']).toContain(before);
    const next = cycleMotion();
    expect(next).not.toBe(before);
    expect(motionMode()).toBe(next);
    cycleMotion();
    expect(motionMode()).toBe(before);
  });
});
