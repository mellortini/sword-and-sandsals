/**
 * The living crowd (#52), the parts that are only numbers (tested without Pixi):
 *  - crowdPose(): how a spectator stands this moment (#272): a few cheer with both arms up, most of the others sway
 *    very gently from side to side
 *  - armRaise(): how far a spectator's arm is up — a cheer runs across the stands as a wave from where the blow fell,
 *    a share of the crowd joins in (all of it for a finishing blow), and a crowd that loves the fighters waves anyway
 *  - throwPath(): a flower or coin thrown from a seat in an arc onto the sand, where it then lies
 */

export interface Seat {
  /** the spectator's head, px of the 1920x1080 arena picture (assets/bg/arena_people.json) */
  readonly x: number;
  readonly y: number;
  /** px per rig unit at that seat's depth */
  readonly k: number;
  readonly tier: number;
  /** clothes colour */
  readonly c: string;
}

export interface Cheer {
  /** seconds, on the crowd's clock */
  readonly start: number;
  /** 0..1: the share of the crowd that stands up */
  readonly strength: number;
  /** px: where the wave starts (above the blow) */
  readonly fromX: number;
}

/** px per second the wave runs along the stands */
export const WAVE_SPEED = 1400;
const RISE = 0.12, HOLD = 0.9, FALL = 0.35;

/** a stable 0..1 per spectator, so the same people cheer every time */
export function seatHash(i: number, salt = 0): number {
  const v = Math.sin((i + 1) * 12.9898 + salt * 78.233) * 43758.5453;
  return v - Math.floor(v);
}

function envelope(local: number, hold: number): number {
  if (local <= 0) return 0;
  if (local < RISE) return local / RISE;
  if (local < RISE + hold) return 1;
  const fall = (local - RISE - hold) / FALL;
  return fall < 1 ? 1 - fall : 0;
}

/**
 * 0 (arm down, not drawn) .. 1 (arm straight up) for spectator `i` at time `t`.
 * `mood` 0..1 = how much the crowd loves the fight (favour): a few fans wave slowly even between cheers.
 */
export function armRaise(seat: Seat, i: number, cheers: readonly Cheer[], t: number, mood = 0): number {
  let up = 0;
  for (const c of cheers) {
    if (seatHash(i) >= c.strength) continue;
    const local = t - c.start - Math.abs(seat.x - c.fromX) / WAVE_SPEED - seatHash(i, 1) * 0.08;
    const e = envelope(local, HOLD * (0.7 + 0.6 * seatHash(i, 2)));
    // a held arm bobs a little: people shake their fists
    up = Math.max(up, e * (0.88 + 0.12 * Math.sin(t * 11 + i)));
  }
  if (mood > 0 && seatHash(i, 3) < mood * 0.12) {
    const wave = 0.5 + 0.5 * Math.sin(t * 1.4 + seatHash(i, 4) * 20);
    up = Math.max(up, wave > 0.55 ? (wave - 0.55) / 0.45 : 0);
  }
  return up;
}

/** a share of the arms that are up at all (for tests and tuning) */
export function raisedShare(seats: readonly Seat[], cheers: readonly Cheer[], t: number, mood = 0): number {
  return seats.reduce((n, s, i) => n + (armRaise(s, i, cheers, t, mood) > 0.5 ? 1 : 0), 0) / Math.max(1, seats.length);
}

/** the share of the crowd that cheers on its own, with both arms up, and the share of the rest that sways */
export const CHEERERS = 0.08, SWAYERS = 0.75;
/** radians: how far a spectator leans to either side; about 3 px at the head */
export const SWAY = 0.035;

export interface Pose {
  /** 0 arms down (not drawn) .. 1 both arms straight up */
  readonly up: number;
  /** radians around the lowest visible point of the spectator */
  readonly sway: number;
  /** how much taller a cheering spectator stretches this moment, 0..BOUNCE */
  readonly bounce: number;
}

export const BOUNCE = 0.045;

/** the arms of one of the keen fans, who put both up for a few seconds, rest, and start again */
function keen(i: number, t: number): number {
  if (seatHash(i, 5) >= CHEERERS) return 0;
  const wave = Math.sin(t * (0.7 + 0.5 * seatHash(i, 6)) + seatHash(i, 7) * Math.PI * 2);
  return Math.max(0, Math.min(1, (wave + 0.35) / 0.3));
}

/** `still` = the Reduce motion setting: nobody sways or cheers on their own, the fight's cheers still show */
export function crowdPose(seat: Seat, i: number, cheers: readonly Cheer[], t: number, mood = 0, still = false): Pose {
  const up = Math.max(armRaise(seat, i, cheers, t, mood), still ? 0 : keen(i, t));
  const bounce = BOUNCE * up * Math.abs(Math.sin(t * (4.5 + 2 * seatHash(i, 8)) + i));
  const sways = !still && up < 0.5 && seatHash(i, 9) < SWAYERS;
  const sway = sways ? SWAY * (1 - 2 * up) * Math.sin(t * (1.1 + 0.8 * seatHash(i, 10)) + seatHash(i, 11) * Math.PI * 2) : 0;
  return { up, sway, bounce };
}

export interface Throw {
  readonly frame: string;
  readonly from: { x: number; y: number };
  readonly to: { x: number; y: number };
  readonly start: number;
  readonly duration: number;
  /** turns per second in the air */
  readonly spin: number;
  /** px above the higher end at the top of the arc */
  readonly lift: number;
  /** how it lies on the sand, radians */
  readonly rest: number;
}

export type GiftKind = 'bouquet' | 'coin';

/**
 * `count` gifts thrown from seats near `targetX` to the sand around it, a little apart in time.
 * `rand` is a 0..1 source so a test can pin it.
 */
export function throwGifts(kind: GiftKind, count: number, seats: readonly Seat[], targetX: number, floorY: number, t0: number, rand: () => number): Throw[] {
  if (!seats.length) return [];
  // the people nearest the blow throw first; a front tier throws as far as a back one
  const near = [...seats].sort((a, b) => Math.abs(a.x - targetX) - Math.abs(b.x - targetX)).slice(0, Math.max(count * 4, 12));
  return Array.from({ length: count }, (_, n) => {
    const seat = near[Math.floor(rand() * near.length)];
    return {
      frame: kind === 'coin' ? 'coin' : `flower${Math.floor(rand() * 3)}`,
      from: { x: seat.x, y: seat.y },
      to: { x: targetX + (rand() - 0.5) * 360, y: floorY + rand() * 70 },
      start: t0 + n * 0.12 + rand() * 0.15,
      duration: 0.9 + rand() * 0.4,
      spin: (kind === 'coin' ? 3 : 1.2) * (rand() < 0.5 ? -1 : 1),
      lift: 140 + rand() * 120,
      rest: (rand() - 0.5) * 1.6,
    };
  });
}

/** where a thrown gift is at `t`: in the air on its arc, or lying where it fell (null before it is thrown) */
export function throwPath(th: Throw, t: number): { x: number; y: number; rot: number; landed: boolean } | null {
  const u = (t - th.start) / th.duration;
  if (u < 0) return null;
  if (u >= 1) return { x: th.to.x, y: th.to.y, rot: th.rest, landed: true };
  const top = Math.min(th.from.y, th.to.y) - th.lift;
  // a parabola through from (u=0), the top, and to (u=1): quadratic Bezier with the control point lifted
  const cy = 2 * top - (th.from.y + th.to.y) / 2;
  const y = (1 - u) * (1 - u) * th.from.y + 2 * u * (1 - u) * cy + u * u * th.to.y;
  const x = th.from.x + (th.to.x - th.from.x) * u;
  return { x, y, rot: th.spin * Math.PI * 2 * (t - th.start), landed: false };
}
