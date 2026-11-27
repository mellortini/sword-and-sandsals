/**
 * The animated Pulpport town (#29): the layered render from blender/town.py plus a day and night cycle.
 * Clouds drift left to right, the sun (and at night the moon) crosses the sky on an arc, the sky and the paper world
 * change colour with it, windows, torches and braziers light up at dusk and the forge fire always burns.
 *
 * Draw order: sky gradient → paper sky (multiply) → stars → sun/moon → clouds → background → each building with its
 * flames just above it → lit windows. `buildings` maps a building id to its sprite (for hover highlight / hit-tests).
 */
import { Assets, BlurFilter, Container, Graphics, Sprite, Texture } from 'pixi.js';
import { dayState, mixColor } from './dayCycle';
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
  fountain?: { x: number; y: number };
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
/** a canvas texture from a 2D painter */
function canvasTexture(w: number, h: number, paint: (g: CanvasRenderingContext2D) => void): Texture {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  paint(c.getContext('2d')!);
  return Texture.from(c);
}

/** white, opaque at the haze's horizon, fading out above and below; stretched over the depth band it covers */
const hazeTexture = () => canvasTexture(2, 128, (g) => {
  const l = g.createLinearGradient(0, 0, 0, 128);
  l.addColorStop(0, 'rgba(255,255,255,0.55)');
  l.addColorStop(0.75, 'rgba(255,255,255,1)');
  l.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = l;
  g.fillRect(0, 0, 2, 128);
});

/** soft dark oval for the shadow a building throws on the ground */
const shadowTexture = () => canvasTexture(128, 32, (g) => {
  g.scale(1, 0.25);
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, 'rgba(40,24,16,0.55)');
  r.addColorStop(0.6, 'rgba(40,24,16,0.3)');
  r.addColorStop(1, 'rgba(40,24,16,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 128, 128);
});

/**
 * Depth: the farther a row stands, the more air between it and the eye. Rows by the building's baseline
 * (y + h of its sprite): back (the arena's terrace), middle terrace, front (the forum).
 */
const ROWS = [
  // [baseline up to, haze over everything drawn so far: top, bottom, strength, blur of the row's sprites]
  { until: 600, haze: [40, 640, 0.3], blur: 0.9 },
  { until: 800, haze: [330, 790, 0.16], blur: 0.35 },
  { until: Infinity, haze: null, blur: 0 },
] as const;

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
  private readonly hazes: { sprite: Sprite; strength: number }[] = [];
  private readonly water = new Graphics();
  private readonly fountain?: { x: number; y: number };
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
    this.fountain = m.fountain;
    this.tinted.push(this.water as unknown as Sprite);
    this.addChild(this.water);
    flamesOf('bg');
    const haze = hazeTexture(), shadow = shadowTexture();
    let row = 0;
    const addHaze = ([top, bottom, strength]: readonly [number, number, number]) => {
      const h = new Sprite(haze);
      h.position.set(0, top);
      h.width = W;
      h.height = bottom - top;
      this.hazes.push({ sprite: h, strength });
      this.addChild(h);
    };
    for (const b of m.buildings) {
      // a nearer row starts: veil everything behind it in the air of the farther row
      while (b.y + b.h > ROWS[row].until) {
        const hz = ROWS[row].haze;
        if (hz) addHaze(hz);
        row++;
      }
      const sh = new Sprite(shadow);
      sh.anchor.set(0.5, 0.5);
      sh.position.set(b.x + b.w / 2 + 10, b.y + b.h - 10);
      sh.width = b.w * 1.05;
      sh.height = 26 + row * 10;
      this.addChild(sh);
      const s = new Sprite(tex.get(b.image)!);
      if (ROWS[row].blur) s.filters = [new BlurFilter({ strength: ROWS[row].blur, quality: 2 })];
      s.position.set(b.x, b.y);
      s.label = b.id;
      this.buildings.set(b.id, s);
      this.tinted.push(s);
      this.addChild(s);
      flamesOf(b.id);
    }
    for (; row < ROWS.length; row++) if (ROWS[row].haze) addHaze(ROWS[row].haze!);
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
    // the air takes the colour of the sky at the horizon, a little paler by day
    const air = mixColor(s.skyBottom, 0xffffff, 0.35 * (1 - s.lights));
    for (const h of this.hazes) { h.sprite.tint = air; h.sprite.alpha = h.strength; }
    this.drawFountain();

    const t = this.time;
    for (const f of this.flames) {
      const on = f.always ? 1 : s.lights;
      f.root.visible = on > 0.01;
      if (!f.root.visible) continue;
      const k = f.s * (0.35 + 0.65 * on);
      const p = f.ph;
      f.fire.scale.set(
        k * (1 - 0.07 * Math.sin(t * 4.5 + p) + 0.03 * Math.sin(t * 9.5 + p * 3)),
        k * (1 + 0.1 * Math.sin(t * 4 + p) + 0.05 * Math.sin(t * 8.5 + p * 2)),
      );
      f.fire.skew.x = 0.1 * Math.sin(t * 2.6 + p) + 0.04 * Math.sin(t * 6 + p);
      const flicker = 0.88 + 0.12 * Math.sin(t * 6.5 + p) * Math.sin(t * 2 + p);
      // the glow shows most at night; by day the forge only warms its mouth
      const dark = 1 - ((s.tint >> 8) & 255) / 255;
      // the forge glows softer than the torches: its fire is bigger, so its halo would blow out the shop
      const soft = f.always ? 0.45 : 1;
      f.glow.alpha = soft * flicker * on * (0.3 + 0.7 * Math.min(1, dark * 3 + s.lights));
      f.glow.scale.set(k * (f.always ? 0.8 : 1.1) * (1 + 0.06 * flicker));
    }
  }

  /** drops running down the painted jets and rings spreading on the water, slow and quiet */
  private drawFountain() {
    const f = this.fountain;
    if (!f) return;
    const g = this.water.clear();
    const t = this.time;
    const drop = (x: number, y: number, r: number, a: number) => g.circle(x, y, r).fill({ color: 0xe8f7f7, alpha: a });
    for (const side of [-1, 1]) {
      for (let k = 0; k < 4; k++) {
        // upper jet: from the top spout down into the bowl
        const u = (t * 0.45 + k / 4 + (side > 0 ? 0.12 : 0)) % 1;
        drop(f.x + side * (6 + 40 * u), f.y - 118 - 30 * Math.sin(Math.PI * u * 0.7) + 50 * u * u, 2.2, 0.8 * Math.sin(Math.PI * u));
        // lower arcs: from the bowl's rim into the basin
        const v = (t * 0.38 + k / 4 + (side > 0 ? 0.37 : 0.6)) % 1;
        drop(f.x + side * (40 + 34 * v), f.y - 66 + 60 * v * v, 2, 0.75 * Math.sin(Math.PI * v));
      }
    }
    // rings where the water lands, growing and fading
    for (const [cx, cy, rx, ry, speed, off] of [
      [f.x - 74, f.y - 4, 22, 4, 0.5, 0], [f.x + 74, f.y - 4, 22, 4, 0.5, 0.5],
      [f.x - 44, f.y - 75, 10, 2, 0.7, 0.25], [f.x + 44, f.y - 75, 10, 2, 0.7, 0.75],
    ] as const) {
      for (let k = 0; k < 2; k++) {
        const p = (t * speed + off + k / 2) % 1;
        g.ellipse(cx, cy, rx * (0.3 + p), ry * (0.3 + p)).stroke({ color: 0xe8f7f7, width: 1.5, alpha: 0.7 * (1 - p) });
      }
    }
    // the jet on top bobs a little
    g.ellipse(f.x, f.y - 120 - 2 * Math.sin(t * 2.2), 5, 3 + Math.sin(t * 3.1)).fill({ color: 0xe8f7f7, alpha: 0.85 });
  }
}
