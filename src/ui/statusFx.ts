/**
 * Draws the status effects (#50) on the fighters: the bits from statusBits() with the sprites of assets/fx/status.png,
 * pinned to the puppets' bones every frame. Sprites are pooled per fighter; nothing is drawn until the sheet has loaded.
 */
import { Assets, Container, Rectangle, Sprite, Texture } from 'pixi.js';
import type { PaperRig } from '../rig/PaperRig';
import type { ShownStatus } from './statusBits';
import { statusBits } from './statusBits';

/** the sheet is rendered at 120 px per rig unit */
const SPRITE_PPU = 120;

let sheet: Promise<Record<string, Texture> | null> | null = null;

function loadSheet(): Promise<Record<string, Texture> | null> {
  sheet ??= (async () => {
    try {
      const base = import.meta.env.BASE_URL;
      const [tex, meta] = await Promise.all([
        Assets.load<Texture>(`${base}fx/status.png`),
        fetch(`${base}fx/status.json`).then((r) => r.json() as Promise<{ frames: Record<string, { x: number; y: number; w: number; h: number }> }>),
      ]);
      return Object.fromEntries(Object.entries(meta.frames).map(([name, f]) => [name, new Texture({ source: tex.source, frame: new Rectangle(f.x, f.y, f.w, f.h) })]));
    } catch (e) {
      console.warn('status fx sheet not loaded', e);
      return null;
    }
  })();
  return sheet;
}

interface Wearer { rig: PaperRig; statuses: readonly ShownStatus[]; sprites: Sprite[] }

export class StatusFx extends Container {
  private frames: Record<string, Texture> | null = null;
  private wearers = new Map<string, Wearer>();
  private t = 0;

  constructor() {
    super();
    void loadSheet().then((f) => { this.frames = f; });
  }

  /** follow a puppet under a name (the fighter's side) */
  attach(name: string, rig: PaperRig) {
    this.detach(name);
    this.wearers.set(name, { rig, statuses: [], sprites: [] });
  }

  detach(name: string) {
    const w = this.wearers.get(name);
    for (const s of w?.sprites ?? []) s.destroy();
    this.wearers.delete(name);
  }

  /** what a fighter suffers now (the core's statuses after an action) */
  set(name: string, statuses: readonly ShownStatus[]) {
    const w = this.wearers.get(name);
    if (w) w.statuses = statuses.filter((s) => s.stacks > 0);
  }

  clear() {
    for (const w of this.wearers.values()) w.statuses = [];
    this.update(0);
  }

  update(dt: number) {
    this.t += dt;
    for (const w of this.wearers.values()) {
      // the stump drips only where it is drawn (#332): with gore off the arm stays on and nothing drips
      const shown = w.rig.look.armCut ? w.statuses : w.statuses.filter((s) => s.kind !== 'bleeding');
      const bits = this.frames ? statusBits(shown, this.t) : [];
      while (w.sprites.length < bits.length) {
        const s = new Sprite();
        s.anchor.set(0.5);
        w.sprites.push(this.addChild(s));
      }
      const { rig } = w;
      const f = rig.facing, k = rig.scale;
      w.sprites.forEach((s, i) => {
        const b = bits[i];
        const tex = b && this.frames![b.frame];
        s.visible = !!tex && rig.view.visible;
        if (!s.visible) return;
        s.texture = tex!;
        const p = rig.screenPoint(b.bone, b.x, b.y);
        const q = rig.screenPoint(b.bone, b.x + 1, b.y);
        // the bone's angle as if the puppet faced right; a left-facing puppet is that picture mirrored
        const phi = Math.atan2(q.y - p.y, q.x - p.x);
        const psi = (b.upright ? 0 : f === 1 ? phi : Math.PI - phi) + b.rot;
        s.position.set(p.x + (b.wx ?? 0) * k * f, p.y - (b.wy ?? 0) * k);
        s.rotation = f === 1 ? psi : -psi;
        const scale = (k / SPRITE_PPU) * b.scale;
        s.scale.set(scale * f, scale);
        s.alpha = b.alpha;
        s.blendMode = b.multiply ? 'multiply' : 'normal';
      });
    }
  }
}
