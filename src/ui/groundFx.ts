/**
 * Draws GroundBits (#17) with the sprites rendered by blender/fx_bits.py (one sheet, assets/fx/bits.png).
 * A fixed pool of Sprites is reused every frame, so the effect costs no allocations while a fight runs.
 * Until the sheet has loaded (or if it is missing) nothing is drawn; the fight never waits for it.
 */
import { Assets, Container, Rectangle, Sprite, Texture } from 'pixi.js';
import type { Animator } from '../anim/Animator';
import type { BitKind, Kick } from './groundBits';
import { GroundBits, MAX_BITS } from './groundBits';

/** sprites are rendered at 120 px per rig unit; the arena draws 38 */
const SPRITE_PPU = 120;

type Frames = Record<BitKind, Texture[]>;
let sheet: Promise<Frames | null> | null = null;

function loadSheet(): Promise<Frames | null> {
  sheet ??= (async () => {
    try {
      const base = import.meta.env.BASE_URL;
      const [tex, meta] = await Promise.all([
        Assets.load<Texture>(`${base}fx/bits.png`),
        fetch(`${base}fx/bits.json`).then((r) => r.json() as Promise<{ frames: Record<string, { x: number; y: number; w: number; h: number }> }>),
      ]);
      const frames: Frames = { flake: [], strip: [], puff: [] };
      for (const [name, f] of Object.entries(meta.frames)) {
        const kind = name.replace(/\d+$/, '') as BitKind;
        frames[kind]?.push(new Texture({ source: tex.source, frame: new Rectangle(f.x, f.y, f.w, f.h) }));
      }
      return frames;
    } catch (e) {
      console.warn('ground fx sheet not loaded', e);
      return null;
    }
  })();
  return sheet;
}

export class GroundFx extends Container {
  readonly sim: GroundBits;
  private frames: Frames | null = null;
  private readonly pool: Sprite[] = [];

  constructor(private readonly unit = 38, random?: () => number) {
    super();
    this.sim = new GroundBits(random);
    void loadSheet().then((f) => { this.frames = f; });
  }

  kick(kind: Kick, x: number, floorY: number, dir: 1 | -1, fromY?: number) {
    this.sim.kick(kind, x, floorY, dir, fromY);
  }

  update(dt: number) {
    this.sim.step(dt * 30);
    const frames = this.frames;
    const bits = this.sim.bits;
    const k = this.unit / SPRITE_PPU;
    let used = 0;
    if (frames) {
      for (const b of bits) {
        const list = frames[b.kind];
        if (!list.length) continue;
        if (used >= this.pool.length && this.pool.length < MAX_BITS) {
          const s = new Sprite();
          s.anchor.set(0.5);
          this.pool.push(s);
          this.addChild(s);
        }
        const s = this.pool[used++];
        s.visible = true;
        s.texture = list[b.variant % list.length];
        s.position.set(b.x, b.y);
        s.rotation = b.rotation;
        s.alpha = b.alpha;
        if (b.kind === 'puff') s.scale.set(b.scale * k);
        else if (b.down) s.scale.set(b.scale * k, b.scale * k * 0.45);   // lying flat on the sand
        else s.scale.set(b.scale * k * (0.35 + 0.65 * Math.abs(Math.cos(b.flip))), b.scale * k);
      }
    }
    for (let i = used; i < this.pool.length; i++) this.pool[i].visible = false;
  }

  clear() { this.sim.clear(); for (const s of this.pool) s.visible = false; }
}

/**
 * Kick up paper from a fighter's clip events: `land` (jump), `impact` (the body hits the sand: a charge, death,
 * finishers) and `struck` (flinching from a blow). Returns a function that detaches the listener.
 */
export function attachGroundFx(anim: Animator, fx: GroundFx, floorY: number): () => void {
  const listener = (e: { type: string }, clip: string) => {
    const rig = anim.rig;
    const fwd = rig.facing;
    if (e.type === 'land') {
      fx.kick('land', rig.view.x + 0.3 * rig.scale * fwd, floorY, fwd);
    } else if (e.type === 'impact') {
      const body = rig.screenPoint('torso', 0.2, 1.4);
      if (clip.startsWith('charge')) fx.kick('charge', body.x, floorY, fwd);
      else fx.kick('fall', body.x, floorY, (-fwd) as 1 | -1);
    } else if (e.type === 'struck') {
      const chest = rig.screenPoint('torso', 0.3, 2.2);
      fx.kick('struck', chest.x, floorY, (-fwd) as 1 | -1, chest.y);
    }
  };
  anim.listeners.add(listener);
  return () => { anim.listeners.delete(listener); };
}
