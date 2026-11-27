/**
 * The living crowd (#52, #272): every spectator is a sprite of its own (<arena>_people.png, rendered by
 * blender/arena_lib.py) over the empty stands. Most sway very gently, a few cheer with both paper arms up, a cheer of
 * the fight runs across the stands as a wave, and flowers and coins fly from them onto the sand.
 * Goes right after the backdrop, under the fighters: the sprites get the stands' blur, colour and light
 * (src/scenes/backdrop.ts) baked in once, the gifts stay sharp because they fly in front of the wall.
 * Nothing is drawn until the sheets have loaded.
 */
import { Assets, Container, Graphics, Rectangle, Sprite, Texture } from 'pixi.js';
import { crowdPose, throwGifts, throwPath } from './crowdWave';
import { reduceMotion } from './motion';
import { ARENAS } from '../scenes/arenas';
import type { ArenaTheme } from '../scenes/arenas';
import { SUNNY, standsLight } from '../scenes/backdrop';
import type { StandsLook } from '../scenes/backdrop';
import type { Cheer, GiftKind, Seat, Throw } from './crowdWave';

/** the sheet is rendered at 120 px per rig unit */
const SPRITE_PPU = 120;
/** the arms stay a little sharper and darker than the picture, so they read without standing out of the crowd */
const ARM_BLUR = 0.8;
const ARM_DIM = 0.94;
/** the arena picture the seats are measured on */
const PICTURE = { w: 1920, h: 1080 } as const;
/** gifts lie on the sand this long, then fade */
const LIE_FOR = 8;

interface Frame { tex: Texture; px: number; py: number }
interface Rect { x: number; y: number; w: number; h: number }
/** a spectator of <arena>_people.json: its place on the sheet, in the picture, and the lowest point it sways around */
interface Person extends Seat {
  readonly sheet: readonly [number, number, number, number];
  readonly at: readonly [number, number];
  readonly foot: number;
}
interface Loaded { frames: Record<string, Frame>; seats: Person[]; people: Texture[] }

const loading = new Map<string, Promise<Loaded | null>>();

/** `source` (or a rectangle of it) on a canvas of its own, with `pad` px around it and a CSS filter baked in */
function bake(source: CanvasImageSource, rect: Rect, pad: number, filter: string): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = rect.w + 2 * pad;
  c.height = rect.h + 2 * pad;
  const g = c.getContext('2d')!;
  // browsers without canvas filters draw the crowd sharp; the tint still dims it
  if (typeof (g as { filter?: unknown }).filter === 'string') g.filter = filter;
  g.drawImage(source, rect.x, rect.y, rect.w, rect.h, pad, pad, rect.w, rect.h);
  return c;
}

/**
 * The spectator sheet with `filter` baked in, one sprite at a time and clipped to its own rectangle. Filtering the
 * whole sheet at once lets the blur of one spectator spill into the next rectangle (those cut by the edge of the
 * picture reach right to their border), and that neighbour then carries a stripe of foreign colour with a hard
 * vertical end into the stands (#272).
 */
function bakeSheet(source: CanvasImageSource, width: number, height: number, rects: readonly Person['sheet'][], filter: string): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  const g = c.getContext('2d')!;
  const canFilter = typeof (g as { filter?: unknown }).filter === 'string';
  for (const [x, y, w, h] of rects) {
    g.save();
    g.beginPath();
    g.rect(x, y, w, h);
    g.clip();
    if (canFilter) g.filter = filter;
    g.drawImage(source, x, y, w, h, x, y, w, h);
    g.restore();
  }
  return c;
}

function load(theme: ArenaTheme): Promise<Loaded | null> {
  const known = loading.get(theme.people);
  if (known) return known;
  const sheets = (async () => {
    try {
      const base = import.meta.env.BASE_URL;
      const look = theme.stands ?? SUNNY;
      const [armSheet, meta, crowd, peopleSheet] = await Promise.all([
        Assets.load<Texture>(`${base}fx/crowd.png`),
        fetch(`${base}fx/crowd.json`).then((r) => r.json() as Promise<{ frames: Record<string, Rect & { px: number; py: number }> }>),
        fetch(`${base}${theme.people}.json`).then((r) => r.json() as Promise<{ seats: Person[] }>),
        Assets.load<Texture>(`${base}${theme.people}.png`),
      ]);
      // the arm frames are shrunk to the seats' size when drawn, so their blur is measured in sheet px
      const perUnit = crowd.seats.reduce((n, s) => n + s.k, 0) / Math.max(1, crowd.seats.length);
      const armBlur = (look.blur * ARM_BLUR * SPRITE_PPU) / perUnit;
      const pad = Math.ceil(armBlur * 2);
      const frames = Object.fromEntries(Object.entries(meta.frames).map(([name, f]) => {
        const c = bake(armSheet.source.resource as CanvasImageSource, f, pad, `blur(${armBlur}px)`);
        return [name, { tex: Texture.from(c), px: (f.px + pad) / c.width, py: (f.py + pad) / c.height }];
      }));
      const soft = Texture.from(bakeSheet(peopleSheet.source.resource as CanvasImageSource, peopleSheet.width, peopleSheet.height,
        crowd.seats.map((p) => p.sheet), `blur(${look.blur}px) saturate(${look.saturation}) brightness(${look.brightness})`));
      const people = crowd.seats.map(({ sheet: [x, y, w, h] }) => new Texture({ source: soft.source, frame: new Rectangle(x, y, w, h) }));
      return { frames, seats: crowd.seats, people };
    } catch (e) {
      console.warn('crowd fx not loaded', e);
      return null;
    }
  })();
  loading.set(theme.people, sheets);
  return sheets;
}

/** `hex` at `light` of its brightness, washed out to `saturation` like the stands around it */
function shade(hex: string, light: number, saturation = 1): number {
  const v = parseInt(hex.slice(1), 16);
  const rgb = [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  const grey = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  const [r, g, b] = rgb.map((c) => Math.max(0, Math.min(255, Math.round((grey + (c - grey) * saturation) * light))));
  return (r << 16) | (g << 8) | b;
}

interface Arm { sleeve: Sprite; hand: Sprite; side: number }
interface Fan { node: Container; arms?: Arm[] }

export class CrowdFx extends Container {
  private data: Loaded | null = null;
  private readonly stands = new Container();
  private readonly gifts = new Container();
  private fans: Fan[] = [];
  private readonly look: StandsLook;
  private cheers: Cheer[] = [];
  private thrown: { th: Throw; sprite: Sprite }[] = [];
  private t = 0;
  private rngState = 7;
  /** 0..1 how much the crowd loves the fight: a few fans keep waving */
  mood = 0;

  /** `theme`: the arena whose spectators these are (src/scenes/arenas.ts) */
  constructor(theme: ArenaTheme = ARENAS.pulpport) {
    super();
    this.look = theme.stands ?? SUNNY;
    this.addChild(this.stands, this.gifts);
    // seats at the very edges and the top of a high throw lie outside the picture: never draw into the margins
    this.mask = this.addChild(new Graphics().rect(0, 0, PICTURE.w, PICTURE.h).fill(0xffffff));
    void load(theme).then((d) => {
      if (!d || this.destroyed) return;
      this.data = d;
      this.seat(d);
    });
  }

  /** everybody sits down, back rows first */
  private seat(d: Loaded) {
    this.fans = d.seats.map((p, i) => {
      const node = new Container();
      const body = new Sprite(d.people[i]);
      body.position.set(p.at[0], p.at[1]);
      const grey = Math.round(255 * standsLight(p.x, p.y, this.look));
      body.tint = (grey << 16) | (grey << 8) | grey;
      node.addChild(body);
      node.pivot.set(p.x, p.foot);
      node.position.set(p.x, p.foot);
      this.stands.addChild(node);
      return { node };
    });
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
  }

  update(dt: number) {
    this.t += dt;
    const d = this.data;
    if (!d) return;
    const still = reduceMotion();
    d.seats.forEach((seat, i) => {
      const fan = this.fans[i];
      const pose = crowdPose(seat, i, this.cheers, this.t, this.mood, still);
      fan.node.rotation = pose.sway;
      fan.node.scale.y = 1 + pose.bounce;
      if (pose.up <= 0.02) {
        for (const a of fan.arms ?? []) a.sleeve.visible = a.hand.visible = false;
        return;
      }
      fan.arms ??= this.makeArms(fan, i, seat, d.frames);
      const s = seat.k / SPRITE_PPU;
      for (const arm of fan.arms) {
        // both arms rise from the shoulders in a V and shake while they are up
        const lean = arm.side * (0.34 + 0.3 * (1 - pose.up) + 0.1 * pose.up * Math.sin(this.t * 7 + i + arm.side));
        const sx = seat.x + arm.side * 0.36 * seat.k, sy = seat.y + 0.55 * seat.k;
        arm.sleeve.position.set(sx, sy);
        arm.sleeve.rotation = lean;
        arm.sleeve.scale.set(s, s * pose.up);
        const len = 1.08 * seat.k * pose.up;
        arm.hand.position.set(sx + Math.sin(lean) * len, sy - Math.cos(lean) * len);
        arm.hand.rotation = lean;
        arm.hand.scale.set(s);
        arm.sleeve.visible = arm.hand.visible = true;
      }
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

  /** two arms behind the spectator's body, so the shoulders hide where they start */
  private makeArms(fan: Fan, i: number, seat: Person, frames: Record<string, Frame>): Arm[] {
    const light = ARM_DIM * this.look.brightness * standsLight(seat.x, seat.y, this.look);
    return [-1, 1].map((side) => {
      const sleeve = new Sprite(frames.arm.tex);
      sleeve.anchor.set(frames.arm.px, frames.arm.py);
      sleeve.tint = shade(seat.c, light, this.look.saturation);
      const h = frames[`hand${i % 3}`];
      const hand = new Sprite(h.tex);
      hand.anchor.set(h.px, h.py);
      hand.tint = shade('#ffffff', light);
      fan.node.addChildAt(sleeve, 0);
      fan.node.addChildAt(hand, 1);
      return { sleeve, hand, side };
    });
  }
}
