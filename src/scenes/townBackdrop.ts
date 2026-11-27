/**
 * The animated Pulpport town (#29): the layered render from blender/town.py plus a day and night cycle.
 * Clouds drift left to right, the sun (and at night the moon) crosses the sky on an arc, the sky and the paper world
 * change colour with it, windows, torches and braziers light up at dusk and the forge fire always burns.
 *
 * Draw order: sky gradient → paper sky (multiply) → stars → sun/moon → clouds → background → each building with its
 * flames just above it → lit windows. `buildings` maps a building id to its sprite (for hover highlight / hit-tests).
 */
import { Assets, Container, Graphics, Sprite, Texture } from 'pixi.js';
import { dayState } from './dayCycle';
import type { DayState } from './dayCycle';

interface Rect { image: string; x: number; y: number; w: number; h: number }
interface TownManifest {
  size: [number, number];
  background: string;
  sky: Rect;
  sun: { image: string; w: number; h: number };
  clouds: { image: string; w: number; h: number }[];
  lights: string;
  flame: { image: string; w: number; h: number; ax: number; ay: number };
  flames: { layer: string; x: number; y: number; s: number; always: boolean }[];
  buildings: (Rect & { id: string; name: string })[];
}

interface Flame { root: Container; fire: Sprite; glow: Sprite; s: number; always: boolean; ph: number }
interface Cloud { sprite: Sprite; speed: number }

export interface TownOptions {
  /** seconds for a whole day and night (default 120) */
  daySeconds?: number;
  /** start phase: 0 sunrise, 0.25 noon, 0.5 sunset, 0.75 midnight (default 0.3) */
  phase?: number;
  /** freeze the clock at `phase` (clouds and flames still move) */
  frozen?: boolean;
}

/** soft round glow, white in the middle, for additive blending */
function glowTexture(): Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, 'rgba(255,190,110,0.9)');
  r.addColorStop(0.35, 'rgba(255,140,60,0.35)');
  r.addColorStop(1, 'rgba(255,120,40,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 128, 128);
  return Texture.from(c);
}

export class TownBackdrop extends Container {
  phase: number;
  daySeconds: number;
  frozen: boolean;
  readonly buildings = new Map<string, Sprite>();
  readonly manifest: TownManifest;

  private readonly skyCanvas = document.createElement('canvas');
  private readonly skyTex: Texture;
  private readonly stars = new Graphics();
  private readonly body: Sprite;
  private readonly clouds: Cloud[] = [];
  private readonly tinted: Sprite[] = [];
  private readonly flames: Flame[] = [];
  private readonly lights: Sprite;
  private time = 0;
  private lastSky = -1;

  static async load(base: string, options: TownOptions = {}): Promise<TownBackdrop> {
    const dir = `${base}bg/`;
    const manifest: TownManifest = await (await fetch(`${dir}town.json`)).json();
    const files = [manifest.background, manifest.sky.image, manifest.sun.image, manifest.lights, manifest.flame.image,
      ...manifest.clouds.map((c) => c.image), ...manifest.buildings.map((b) => b.image)];
    const tex = new Map<string, Texture>();
    await Promise.all(files.map(async (f) => tex.set(f, await Assets.load(dir + f))));
    return new TownBackdrop(manifest, tex, options);
  }

  private constructor(m: TownManifest, tex: Map<string, Texture>, o: TownOptions) {
    super();
    this.manifest = m;
    this.phase = o.phase ?? 0.3;
    this.daySeconds = o.daySeconds ?? 120;
    this.frozen = o.frozen ?? false;
    const [W] = m.size;

    // sky: a tiny gradient canvas stretched over the sky, the paper sky multiplied on top
    this.skyCanvas.width = 2;
    this.skyCanvas.height = 64;
    this.skyTex = Texture.from(this.skyCanvas);
    const grad = new Sprite(this.skyTex);
    grad.width = W;
    grad.height = m.sky.h;
    const paper = new Sprite(tex.get(m.sky.image)!);
    paper.position.set(m.sky.x, m.sky.y);
    paper.blendMode = 'multiply';
    this.addChild(grad, paper);

    // stars: fixed random dots in the upper sky
    let seed = 29;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 90; i++) {
      this.stars.circle(rnd() * W, rnd() * 420, 0.8 + rnd() * 1.6).fill({ color: 0xfff6dc, alpha: 0.5 + rnd() * 0.5 });
    }
    this.addChild(this.stars);

    this.body = new Sprite(tex.get(m.sun.image)!);
    this.body.anchor.set(0.5);
    this.addChild(this.body);

    for (let i = 0; i < 7; i++) {
      const c = m.clouds[i % m.clouds.length];
      const s = new Sprite(tex.get(c.image)!);
      const k = 0.65 + rnd() * 0.55;
      s.anchor.set(0.5);
      s.scale.set(k * (rnd() < 0.5 ? -1 : 1), k);
      s.position.set(rnd() * (W + 300) - 150, 50 + rnd() * 190);
      this.clouds.push({ sprite: s, speed: 8 + k * 18 });
      this.addChild(s);
    }

    const glow = glowTexture();
    const flamesOf = (layer: string) => {
      for (const f of m.flames.filter((q) => q.layer === layer)) {
        const root = new Container();
        root.position.set(f.x, f.y);
        const g = new Sprite(glow);
        g.anchor.set(0.5);
        g.blendMode = 'add';
        g.y = -14 * f.s;
        const fire = new Sprite(tex.get(m.flame.image)!);
        fire.anchor.set(m.flame.ax, m.flame.ay);
        root.addChild(g, fire);
        this.flames.push({ root, fire, glow: g, s: f.s, always: f.always, ph: rnd() * 100 });
        this.addChild(root);
      }
    };

    const bg = new Sprite(tex.get(m.background)!);
    this.tinted.push(bg);
    this.addChild(bg);
    flamesOf('bg');
    for (const b of m.buildings) {
      const s = new Sprite(tex.get(b.image)!);
      s.position.set(b.x, b.y);
      s.label = b.id;
      this.buildings.set(b.id, s);
      this.tinted.push(s);
      this.addChild(s);
      flamesOf(b.id);
    }
    this.lights = new Sprite(tex.get(m.lights)!);
    this.addChild(this.lights);
    this.apply(dayState(this.phase));
  }

  /** advance the clock by `dt` seconds */
  update(dt: number) {
    this.time += dt;
    if (!this.frozen) this.phase = (this.phase + dt / this.daySeconds) % 1;
    const W = this.manifest.size[0];
    for (const c of this.clouds) {
      c.sprite.x += c.speed * dt;
      const half = Math.abs(c.sprite.width) / 2;
      if (c.sprite.x - half > W) c.sprite.x = -half;
    }
    this.apply(dayState(this.phase));
  }

  private apply(s: DayState) {
    if (this.lastSky !== s.skyTop * 7 + s.skyBottom) {
      this.lastSky = s.skyTop * 7 + s.skyBottom;
      const g = this.skyCanvas.getContext('2d')!;
      const lin = g.createLinearGradient(0, 0, 0, 64);
      lin.addColorStop(0, `#${s.skyTop.toString(16).padStart(6, '0')}`);
      lin.addColorStop(1, `#${s.skyBottom.toString(16).padStart(6, '0')}`);
      g.fillStyle = lin;
      g.fillRect(0, 0, 2, 64);
      this.skyTex.source.update();
    }
    this.stars.alpha = s.stars;
    this.body.position.set(s.body.x, s.body.y);
    this.body.tint = s.body.tint;
    this.body.scale.set(s.body.moon ? 0.55 : 1);
    for (const c of this.clouds) c.sprite.tint = s.cloud;
    for (const t of this.tinted) t.tint = s.tint;
    this.lights.alpha = s.lights;

    const t = this.time;
    for (const f of this.flames) {
      const on = f.always ? 1 : s.lights;
      f.root.visible = on > 0.01;
      if (!f.root.visible) continue;
      const k = f.s * (0.35 + 0.65 * on);
      const p = f.ph;
      f.fire.scale.set(
        k * (1 - 0.09 * Math.sin(t * 13 + p) + 0.04 * Math.sin(t * 29 + p * 3)),
        k * (1 + 0.13 * Math.sin(t * 11 + p) + 0.07 * Math.sin(t * 23 + p * 2)),
      );
      f.fire.skew.x = 0.14 * Math.sin(t * 7 + p) + 0.05 * Math.sin(t * 17 + p);
      const flicker = 0.85 + 0.15 * Math.sin(t * 19 + p) * Math.sin(t * 5 + p);
      // the glow shows most at night; by day the forge only warms its mouth
      const dark = 1 - ((s.tint >> 8) & 255) / 255;
      f.glow.alpha = flicker * on * (0.35 + 0.65 * Math.min(1, dark * 3 + s.lights));
      f.glow.scale.set(k * (1.1 + 0.08 * flicker));
    }
  }
}
