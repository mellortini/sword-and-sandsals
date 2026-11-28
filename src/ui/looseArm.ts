/**
 * The cut-off shield arm (#275 / #332): the forearm with its hand, bracer and shield leaves the elbow, tumbles away
 * from the blow, bounces on the sand and stays lying flat there until the effects layer is cleared.
 *
 * It is a second puppet with the look `armLoose` (only the forearm, torn at its top), posed exactly as the fighter was
 * at the cut and drawn once; then only its holder moves. Screen px, 30 fps, like the paper scraps.
 */
import { Container } from 'pixi.js';
import type { Renderer } from 'pixi.js';
import { PaperRig } from '../rig/PaperRig';

const FPS = 30;
/** the arm's speeds in rig units per frame: away from the blow and up, gravity per frame² */
const THROW = { back: 0.1, up: 0.3, gravity: 0.034, spin: 0.2 };
const BOUNCE = 0.32;
/** frames to settle flat once it stops bouncing */
const SETTLE = 9;

interface Pt { x: number; y: number }

/** the rotation nearest to `rot` that turns a direction at `angle` (screen radians) level with the sand */
export function lyingRotation(angle: number, rot: number): number {
  const base = -angle;                        // angle + r = 0 (mod PI)
  const n = Math.round((rot - base) / Math.PI);
  return base + n * Math.PI;
}

/** the lowest of `hull` (relative to the pivot) turned by `rot` */
export function lowest(hull: readonly Pt[], rot: number): number {
  const c = Math.cos(rot), s = Math.sin(rot);
  return Math.max(...hull.map((p) => p.x * s + p.y * c));
}

export class LooseArm extends Container {
  private vx = 0;
  private vy = 0;
  private spin = 0;
  private settle = -1;
  private from = 0;
  private to = 0;
  private done = false;

  private constructor(
    private readonly rig: PaperRig, private readonly hull: Pt[], private readonly lieAngle: number, private readonly floorY: number,
  ) {
    super();
  }

  /**
   * Cut `source`'s shield forearm off as it stands now. Call it BEFORE the source drops its forearm
   * (`setLook({ armCut: true })`): the loose piece copies the look with the shield still on.
   */
  static async create(source: PaperRig, renderer: Renderer, floorY: number): Promise<LooseArm> {
    const rig = new PaperRig(source.kit, { scale: source.scale, facing: source.facing, shadow: source.shadow });
    rig.pose = { ...source.pose };
    rig.view.position.copyFrom(source.view.position);
    await rig.setLook({ ...source.look, armCut: false, armLoose: true });
    // where the pieces are now, in the fighters' space: the elbow is the pivot
    const elbow = rig.screenPoint('arm_b_lo');
    const wrist = rig.screenPoint('hand_b');
    const pts: Pt[] = [elbow, wrist, rig.screenPoint('hand_b', 0.1, -0.75)];
    const tier = source.look.shield;
    const m = tier ? rig.kit.json.sprites[`shield${tier}`] : undefined;
    if (m && rig.hasShield()) {
      const ppu = rig.kit.json.ppu;
      for (const [px, py] of [[0, 0], [m.w, 0], [0, m.h], [m.w, m.h]]) {
        pts.push(rig.screenPoint('shield', (px - m.pivot[0]) / ppu, -(py - m.pivot[1]) / ppu));
      }
    }
    const hull = pts.map((p) => ({ x: p.x - elbow.x, y: p.y - elbow.y }));
    const arm = new LooseArm(rig, hull, Math.atan2(wrist.y - elbow.y, wrist.x - elbow.x), floorY);
    rig.render(renderer);
    rig.view.position.set(rig.view.x - elbow.x, rig.view.y - elbow.y);
    arm.position.set(elbow.x, elbow.y);
    arm.addChild(rig.view);
    // thrown away from the blow (the fighter faces his attacker), turning over backwards
    const k = source.scale;
    arm.vx = -source.facing * THROW.back * k;
    arm.vy = -THROW.up * k;
    arm.spin = -source.facing * THROW.spin;
    return arm;
  }

  /** has it come to rest on the sand? */
  get resting() { return this.done; }

  update(dt: number) {
    if (this.done) return;
    const frames = dt * FPS;
    if (frames <= 0) return;
    const k = this.rig.scale;
    if (this.settle < 0) {
      this.vy += THROW.gravity * k * frames;
      this.x += this.vx * frames;
      this.y += this.vy * frames;
      this.rotation += this.spin * frames;
      const over = this.y + lowest(this.hull, this.rotation) - this.floorY;
      if (over >= 0 && this.vy > 0) {
        this.y -= over;
        this.vy *= -BOUNCE;
        this.vx *= 0.55;
        this.spin *= 0.45;
        // too slow to bounce again: lie down flat
        if (Math.abs(this.vy) < 0.09 * k) {
          this.settle = 0;
          this.from = this.rotation;
          this.to = lyingRotation(this.lieAngle, this.rotation);
        }
      }
      return;
    }
    this.settle = Math.min(SETTLE, this.settle + frames);
    const u = this.settle / SETTLE;
    this.rotation = this.from + (this.to - this.from) * u * u * (3 - 2 * u);
    this.x += this.vx * frames * (1 - u);
    this.y = this.floorY - lowest(this.hull, this.rotation);
    if (u >= 1) this.done = true;
  }

  /** the puppet drew itself once into its own texture: free it with the arm */
  override destroy(options?: Parameters<Container['destroy']>[0]) {
    const texture = this.rig.view.texture;
    super.destroy(options);
    texture.destroy(true);
  }
}
