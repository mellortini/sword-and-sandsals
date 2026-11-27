/**
 * The living crowd (#52) over the arena's painted stands: paper arms rise over the spectators' heads in waves
 * (assets/bg/arena_crowd.json says where every head is), and flowers and coins fly from the stands onto the sand.
 * Goes right after the backdrop, under the fighters: the arms get the stands' blur and dimming (src/scenes/backdrop.ts),
 * the gifts stay sharp because they fly in front of the wall. Nothing is drawn until the sheets have loaded.
 */
import { Assets, BlurFilter, Container, Graphics, Rectangle, Sprite, Texture } from 'pixi.js';
import { armRaise, throwGifts, throwPath } from './crowdWave';
import type { Cheer, GiftKind, Seat, Throw } from './crowdWave';

/** the sheet is rendered at 120 px per rig unit */
const SPRITE_PPU = 120;
/** the backdrop's stands are 5 px soft and dimmed: the arms match them */
const STANDS_BLUR = 4;
const STANDS_DIM = 0.8;
/** the arena picture the seats are measured on */
const PICTURE = { w: 1920, h: 1080 } as const;
/** gifts lie on the sand this long, then fade */
const LIE_FOR = 8;

interface Frame { tex: Texture; px: number; py: number }
interface Loaded { frames: Record<string, Frame>; seats: Seat[] }

let loading: Promise<Loaded | null> | null = null;

function load(): Promise<Loaded | null> {
  loading ??= (async () => {
    try {
      const base = import.meta.env.BASE_URL;
      const [tex, meta, crowd] = await Promise.all([
        Assets.load<Texture>(`${base}fx/crowd.png`),
        fetch(`${base}fx/crowd.json`).then((r) => r.json() as Promise<{ frames: Record<string, { x: number; y: number; w: number; h: number; px: number; py: number }> }>),
        fetch(`${base}bg/arena_crowd.json`).then((r) => r.json() as Promise<{ seats: Seat[] }>),
      ]);
      const frames = Object.fromEntries(Object.entries(meta.frames).map(([name, f]) => [name, {
        tex: new Texture({ source: tex.source, frame: new Rectangle(f.x, f.y, f.w, f.h) }), px: f.px / f.w, py: f.py / f.h,
      }]));
      return { frames, seats: crowd.seats };
    } catch (e) {
      console.warn('crowd fx not loaded', e);
      return null;
    }
  })();
  return loading;
}

/** clothes colour as the stands show it: dimmed like the backdrop */
function dim(hex: string): number {
  const v = parseInt(hex.slice(1), 16);
  const ch = (s: number) => Math.round(((v >> s) & 255) * STANDS_DIM);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

interface Arm { sleeve: Sprite; hand: Sprite }

export class CrowdFx extends Container {
  private data: Loaded | null = null;
  private readonly arms = new Container();
  private readonly gifts = new Container();
  private pool = new Map<number, Arm>();
  private cheers: Cheer[] = [];
  private thrown: { th: Throw; sprite: Sprite }[] = [];
  private t = 0;
  private rngState = 7;
  /** 0..1 how much the crowd loves the fight: a few fans keep waving */
  mood = 0;

  constructor() {
    super();
    this.arms.filters = [new BlurFilter({ strength: STANDS_BLUR, quality: 2 })];
    this.addChild(this.arms, this.gifts);
    // seats at the very edges and the top of a high throw lie outside the picture: never draw into the margins
    this.mask = this.addChild(new Graphics().rect(0, 0, PICTURE.w, PICTURE.h).fill(0xffffff));
    void load().then((d) => { this.data = d; });
  }

  private rand = () => {
    this.rngState = (this.rngState * 1664525 + 1013904223) >>> 0;
    return this.rngState / 4294967296;
  };

  /** the crowd jumps up: `strength` 0..1 of it, as a wave from `x` (px) */
  cheer(strength: number, x: number) {
    this.cheers.push({ start: this.t, strength: Math.max(0, Math.min(1, strength)), fromX: x });
    this.cheers = this.cheers.filter((c) => this.t - c.start < 4);
  }

  /** flowers or coins thrown towards `x` (px), landing on the sand at `floorY` */
  throw(kind: GiftKind, count: number, x: number, floorY: number) {
    if (!this.data) return;
    for (const th of throwGifts(kind, count, this.data.seats, x, floorY, this.t, this.rand)) {
      const f = this.data.frames[th.frame];
      if (!f) continue;
      const sprite = new Sprite(f.tex);
      sprite.anchor.set(f.px, f.py);
      sprite.visible = false;
      this.gifts.addChild(sprite);
      this.thrown.push({ th, sprite });
    }
  }

  clear() {
    this.cheers = [];
    for (const g of this.thrown) g.sprite.destroy();
    this.thrown = [];
    for (const a of this.pool.values()) a.sleeve.visible = a.hand.visible = false;
  }

  update(dt: number) {
    this.t += dt;
    const d = this.data;
    if (!d) return;
    d.seats.forEach((seat, i) => {
      const up = armRaise(seat, i, this.cheers, this.t, this.mood);
      let arm = this.pool.get(i);
      if (up <= 0.02) {
        if (arm) arm.sleeve.visible = arm.hand.visible = false;
        return;
      }
      arm ??= this.makeArm(i, seat, d.frames);
      const s = seat.k / SPRITE_PPU;
      // the arm rises from a shoulder beside the head, leaning outward, longer as it goes up
      const side = i % 2 ? 1 : -1;
      const lean = side * (0.25 + 0.2 * (1 - up));
      const sx = seat.x + side * 0.42 * seat.k, sy = seat.y + 0.55 * seat.k;
      arm.sleeve.position.set(sx, sy);
      arm.sleeve.rotation = lean;
      arm.sleeve.scale.set(s, s * up);
      const len = 1.08 * seat.k * up;
      arm.hand.position.set(sx + Math.sin(lean) * len, sy - Math.cos(lean) * len);
      arm.hand.rotation = lean;
      arm.hand.scale.set(s);
      arm.sleeve.visible = arm.hand.visible = true;
    });
    for (const g of this.thrown) {
      const p = throwPath(g.th, this.t);
      g.sprite.visible = !!p;
      if (!p) continue;
      g.sprite.position.set(p.x, p.y);
      g.sprite.rotation = p.rot;
      // coins turn edge-on while they spin through the air
      const f = g.th.frame === 'coin' && !p.landed && Math.cos(p.rot) < 0.35 ? d.frames.coin_side : d.frames[g.th.frame];
      if (f && g.sprite.texture !== f.tex) g.sprite.texture = f.tex;
      // a little larger than life at the fighters' scale (38 px per unit), so a flower reads on the sand
      g.sprite.scale.set(0.6 * (p.landed ? 0.9 : 1));
      const lying = this.t - g.th.start - g.th.duration;
      g.sprite.alpha = lying > LIE_FOR ? Math.max(0, 1 - (lying - LIE_FOR)) : 1;
    }
    this.thrown = this.thrown.filter((g) => {
      if (g.sprite.alpha > 0) return true;
      g.sprite.destroy();
      return false;
    });
  }

  private makeArm(i: number, seat: Seat, frames: Record<string, Frame>): Arm {
    const sleeve = new Sprite(frames.arm.tex);
    sleeve.anchor.set(frames.arm.px, frames.arm.py);
    sleeve.tint = dim(seat.c);
    const h = frames[`hand${i % 3}`];
    const hand = new Sprite(h.tex);
    hand.anchor.set(h.px, h.py);
    hand.tint = dim('#ffffff');
    this.arms.addChild(sleeve, hand);
    const arm = { sleeve, hand };
    this.pool.set(i, arm);
    return arm;
  }
}
