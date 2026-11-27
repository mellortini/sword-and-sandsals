/**
 * Day and night over the town (#29): one number `phase` in [0, 1) drives the sky colours, the sun and the moon on
 * their arc, the tint of the paper world and when lamps and torches burn.
 * 0 = sunrise (sun at the left horizon), 0.25 = noon, 0.5 = sunset (right horizon), 0.75 = midnight.
 */

export interface DayState {
  /** sky gradient, top and horizon */
  skyTop: number;
  skyBottom: number;
  /** multiplies the paper world (white by day, blue at night) */
  tint: number;
  /** multiplies the clouds */
  cloud: number;
  /** sun or moon on its arc, in px of the 1920x1080 frame */
  body: { x: number; y: number; moon: boolean; tint: number };
  /** 0..1: lit windows, torches and braziers */
  lights: number;
  /** 0..1 */
  stars: number;
}

// [phase, sky top, sky bottom, world tint, cloud tint]
const KEYS: readonly [number, number, number, number, number][] = [
  [0.0, 0x6d86b8, 0xf4b48c, 0xf2cdb8, 0xffd6c4],
  [0.08, 0x8fbad6, 0xf3d8b0, 0xfff0e0, 0xfff4ea],
  [0.25, 0x9fc6d6, 0xf5ddb0, 0xffffff, 0xffffff],
  [0.42, 0x8db4cf, 0xf6cf96, 0xfff0dc, 0xfff0e0],
  [0.5, 0x5a6aa3, 0xf28a5c, 0xf5b894, 0xffb59a],
  [0.56, 0x2d3768, 0x8b5d78, 0x9a8aa8, 0x8f86a8],
  [0.75, 0x0e1633, 0x26315c, 0x5d6894, 0x5a6488],
  [0.94, 0x2a3566, 0x8a6c88, 0x8c86a6, 0x9a8ca8],
];

export function mixColor(a: number, b: number, t: number): number {
  const ch = (s: number) => Math.round(((a >> s) & 255) + (((b >> s) & 255) - ((a >> s) & 255)) * t);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (v: number) => { const t = clamp01(v); return t * t * (3 - 2 * t); };

/** sun / moon path: rises at the left horizon, peaks high in the middle, sets on the right */
export const ARC = { x0: 120, x1: 1800, horizon: 600, peak: 110 };

export function dayState(phase: number): DayState {
  const p = ((phase % 1) + 1) % 1;
  let i = KEYS.length - 1;
  while (KEYS[i][0] > p) i--;
  const a = KEYS[i], b = KEYS[(i + 1) % KEYS.length];
  const span = (b[0] <= a[0] ? b[0] + 1 : b[0]) - a[0];
  const t = smooth((p - a[0]) / span);

  const moon = p >= 0.5;
  const u = moon ? (p - 0.5) / 0.5 : p / 0.5;
  const lift = Math.sin(Math.PI * u);
  const body = {
    x: ARC.x0 + (ARC.x1 - ARC.x0) * u,
    y: ARC.horizon - (ARC.horizon - ARC.peak) * lift,
    moon,
    // the sun goes orange near the horizon; the moon stays pale
    tint: moon ? 0xe6ecfa : mixColor(0xffa060, 0xffffff, smooth(lift * 2.2)),
  };

  // lamps light up just before sunset and go out just after sunrise (phase wraps through 0)
  const d = p < 0.25 ? p + 1 : p;
  const lights = smooth((d - 0.45) / 0.07) * smooth((1.06 - d) / 0.06);
  const stars = smooth((d - 0.55) / 0.08) * smooth((0.98 - d) / 0.08);
  return {
    skyTop: mixColor(a[1], b[1], t), skyBottom: mixColor(a[2], b[2], t),
    tint: mixColor(a[3], b[3], t), cloud: mixColor(a[4], b[4], t),
    body, lights, stars,
  };
}
