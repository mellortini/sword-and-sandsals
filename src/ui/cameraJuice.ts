/**
 * Camera juice for the fight (#75), kept subtle: a quick micro-zoom towards a critical blow, a short shake when a charge
 * slams in or a body hits the sand, and a slow drift so the arena breathes between actions. Pure numbers here
 * (cameraAt), so it is tested without Pixi; the scene applies the result to the container that holds the arena (never
 * the HUD). With "reduce motion" (src/ui/motion.ts) every effect is off.
 */

export interface CameraPose {
  /** px offset of the picture */
  x: number;
  y: number;
  /** 1 = no zoom */
  scale: number;
  /** radians */
  rotation: number;
  /** the point the zoom is centred on, px of the 1920x1080 picture */
  focusX: number;
  focusY: number;
}

interface Punch { start: number; amount: number; x: number; y: number }
interface Shake { start: number; amount: number }

/** extra zoom at the top of a punch (amount 1): 4% */
export const PUNCH_ZOOM = 0.04;
const PUNCH_IN = 0.06, PUNCH_OUT = 0.45;
/** px at the start of a shake (amount 1), decaying over SHAKE_FOR */
export const SHAKE_PX = 9;
const SHAKE_FOR = 0.35;
/** the slow drift: px and zoom */
const DRIFT_PX = 6, DRIFT_ZOOM = 0.006;

export class CameraJuice {
  private t = 0;
  private punches: Punch[] = [];
  private shakes: Shake[] = [];

  constructor(private readonly w: number, private readonly h: number, private readonly reduced: () => boolean) {}

  /** a micro-zoom towards (x, y); amount 1 for a crit, more for a finishing blow */
  punch(x: number, y: number, amount = 1) {
    if (!this.reduced()) this.punches.push({ start: this.t, amount, x, y });
  }

  /** a short shake; amount 1 for a charge, less for a landing */
  shake(amount = 1) {
    if (!this.reduced()) this.shakes.push({ start: this.t, amount });
  }

  clear() {
    this.punches = [];
    this.shakes = [];
  }

  update(dt: number): CameraPose {
    this.t += dt;
    this.punches = this.punches.filter((p) => this.t - p.start < PUNCH_IN + PUNCH_OUT);
    this.shakes = this.shakes.filter((s) => this.t - s.start < SHAKE_FOR);
    return cameraAt(this.t, this.punches, this.shakes, this.w, this.h, this.reduced());
  }
}

/** how much of a punch is on at `local` seconds into it: fast in, eased out */
export function punchEnvelope(local: number): number {
  if (local <= 0) return 0;
  if (local < PUNCH_IN) return local / PUNCH_IN;
  const u = (local - PUNCH_IN) / PUNCH_OUT;
  return u >= 1 ? 0 : (1 - u) * (1 - u);
}

export function cameraAt(t: number, punches: readonly Punch[], shakes: readonly Shake[], w: number, h: number, reduced: boolean): CameraPose {
  const rest: CameraPose = { x: 0, y: 0, scale: 1, rotation: 0, focusX: w / 2, focusY: h / 2 };
  if (reduced) return rest;
  let zoom = 0, fx = w / 2, fy = h / 2;
  for (const p of punches) {
    const e = punchEnvelope(t - p.start) * p.amount;
    if (e > zoom) {
      zoom = e;
      // the focus slides towards the blow as the zoom comes on, so the picture never jumps
      const k = Math.min(1, e * 3);
      fx = w / 2 + (p.x - w / 2) * k;
      fy = h / 2 + (p.y - h / 2) * k;
    }
  }
  let sx = 0, sy = 0, rot = 0;
  for (const s of shakes) {
    const u = (t - s.start) / SHAKE_FOR;
    if (u < 0 || u >= 1) continue;
    const k = s.amount * (1 - u) * (1 - u);
    // a few incommensurate sines: rough like a hand-held camera, but the same every time
    sx += SHAKE_PX * k * Math.sin(t * 83.0 + 1.3);
    sy += SHAKE_PX * k * 0.7 * Math.sin(t * 71.0 + 0.4);
    rot += 0.004 * k * Math.sin(t * 57.0);
  }
  return {
    x: sx + DRIFT_PX * Math.sin(t * 0.21),
    y: sy + DRIFT_PX * 0.6 * Math.sin(t * 0.17 + 1.1),
    scale: 1 + DRIFT_ZOOM * (0.5 + 0.5 * Math.sin(t * 0.13)) + PUNCH_ZOOM * zoom,
    rotation: rot,
    focusX: fx,
    focusY: fy,
  };
}

/**
 * The container transform for a pose (pivot at the focus, zoomed, then moved). A 1.5% margin of zoom is always on, and
 * the offset is clamped, so shake and drift never pull an edge of the picture into the frame.
 */
export function stageTransform(p: CameraPose, w: number, h: number) {
  const scale = p.scale * 1.015;
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  const dx = clamp(p.x, -(w - p.focusX) * (scale - 1), p.focusX * (scale - 1));
  const dy = clamp(p.y, -(h - p.focusY) * (scale - 1), p.focusY * (scale - 1));
  return { scale, rotation: p.rotation, pivotX: p.focusX, pivotY: p.focusY, x: p.focusX + dx, y: p.focusY + dy };
}

/** puts the camera on a Pixi container (anything with scale / pivot / position / rotation) */
export function applyCamera(
  stage: { scale: { set(v: number): void }; pivot: { set(x: number, y: number): void }; position: { set(x: number, y: number): void }; rotation: number },
  pose: CameraPose, w: number, h: number,
) {
  const t = stageTransform(pose, w, h);
  stage.pivot.set(t.pivotX, t.pivotY);
  stage.position.set(t.x, t.y);
  stage.scale.set(t.scale);
  stage.rotation = t.rotation;
}
