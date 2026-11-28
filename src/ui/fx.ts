/**
 * Combat pop-ups in paper style. Timing from the reference: the number appears on the hit frame small and grey,
 * bursts into a red splat in 2-3 frames with an overshoot and hangs above the head.
 * Readability over the busy crowd (#148): every pop sits on a soft dark halo, drifts up a little and fades out after
 * ~1.6 s, so an old number never sits next to a new one.
 */
import { Container, Graphics, Sprite, Text, Texture } from 'pixi.js';
import { PaperScraps } from './scraps';
import { StatusFx } from './statusFx';
import { GroundFx } from './groundFx';

const FPS = 30;
/** frames a pop stays before it fades on its own */
const LIFE = 48;
/** px the pop rises over its life */
const RISE = 26;

let haloTex: Texture | null = null;
/** soft dark disc behind a pop: lifts it off the crowd without a hard frame */
function halo(radius: number, alpha = 0.6): Sprite {
  if (!haloTex) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d')!;
    const r = g.createRadialGradient(64, 64, 6, 64, 64, 64);
    r.addColorStop(0, 'rgba(24,10,12,1)');
    r.addColorStop(0.55, 'rgba(24,10,12,0.75)');
    r.addColorStop(1, 'rgba(24,10,12,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, 128, 128);
    haloTex = Texture.from(c);
  }
  const s = new Sprite(haloTex);
  s.anchor.set(0.5);
  s.width = s.height = radius * 2;
  s.alpha = alpha;
  return s;
}

function star(g: Graphics, r0: number, r1: number, n: number, seed: number, color: number) {
  const pts: number[] = [];
  let s = seed;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2 + 0.1;
    const r = i % 2 ? r0 * (0.85 + rnd() * 0.3) : r1 * (0.8 + rnd() * 0.45);
    pts.push(Math.cos(a) * r, Math.sin(a) * r);
  }
  g.poly(pts).fill(color);
}

abstract class Pop extends Container {
  protected t = 0;
  dead = false;
  private baseY: number | null = null;
  update(dt: number) {
    this.t += dt * FPS;
    if (this.t > LIFE) this.dead = true;
    this.baseY ??= this.y;
    // ease-out drift upwards
    const k = Math.min(1, this.t / LIFE);
    this.y = this.baseY - RISE * (1 - (1 - k) * (1 - k));
    this.step();
  }
  protected abstract step(): void;
  fadeOut() { this.dead = true; }
}

export class DamageSplat extends Pop {
  private burst = new Container();
  private small: Text;
  constructor(value: number | string, crit = false) {
    super();
    const sh = new Graphics();
    star(sh, 34, 56, 9, 7, 0x5a1612);
    this.burst.addChild(halo(crit ? 96 : 84));
    sh.position.set(4, 5);
    sh.alpha = 0.55;
    const g = new Graphics();
    star(g, 34, 56, 9, 7, crit ? 0xd8452c : 0xb8302a);
    const inner = new Graphics();
    star(inner, 22, 36, 9, 3, crit ? 0xe8683e : 0xc93a30);
    const num = new Text({ text: String(value), style: { fill: '#fbf3e6', fontSize: 46, fontFamily: 'Georgia', fontWeight: 'bold', stroke: { color: '#3a0e0b', width: 6 } } });
    num.anchor.set(0.5);
    this.burst.addChild(sh, g, inner, num);
    if (crit) {
      const c = new Text({ text: 'CRITICAL!', style: { fill: '#f2c14e', fontSize: 28, fontFamily: 'Georgia', fontWeight: 'bold', letterSpacing: 2, stroke: { color: '#2a1008', width: 6 } } });
      c.anchor.set(0.5);
      c.position.set(0, -64);
      this.burst.addChild(c);
    }
    this.small = new Text({ text: String(value), style: { fill: '#d9d2c6', fontSize: 30, fontFamily: 'Georgia', fontWeight: 'bold' } });
    this.small.anchor.set(0.5);
    this.burst.scale.set(0);
    this.addChild(this.burst, this.small);
  }
  protected step() {
    const t = this.t;
    this.small.visible = t < 2;
    if (this.dead) {
      // shrink away in ~4 frames
      this.burst.scale.set(Math.max(0, this.burst.scale.x - 0.25));
      if (this.burst.scale.x <= 0) this.destroy();
      return;
    }
    const s = t < 1 ? 0 : t < 3 ? 0.4 + (t - 1) * 0.45 : t < 5 ? 1.3 - (t - 3) * 0.15 : 1.0;
    this.burst.scale.set(s * 1.15);
  }
}

/**
 * The grey BLOCK shield. With a real shield (#273) a red paper slip under it says what the blow took off the shield;
 * the blow that breaks it turns the icon rust-red and says BROKEN.
 */
export class BlockShield extends Pop {
  private icon = new Container();
  constructor(shield?: { lost: number; broken: boolean }) {
    super();
    const g = new Graphics();
    const shape = [-26, -24, 26, -24, 28, 4, 0, 34, -28, 4];
    const broken = shield?.broken ?? false;
    const sh = new Graphics().poly(shape).fill(0x2e2a28);
    sh.position.set(3, 4);
    sh.alpha = 0.45;
    g.poly(shape).fill(broken ? 0xa5543c : 0xb9bec6);
    const inner = new Graphics().poly([-18, -17, 18, -17, 19, 2, 0, 24, -19, 2]).fill(broken ? 0x7d3626 : 0x8d939b);
    const tx = new Text({ text: broken ? 'BROKEN' : 'BLOCK', style: { fill: '#f3e6d6', fontSize: broken ? 11 : 13, fontFamily: 'Georgia', fontWeight: 'bold', stroke: { color: '#3b3a38', width: 3 } } });
    tx.anchor.set(0.5);
    tx.position.set(0, -3);
    this.icon.addChild(halo(62), sh, g, inner, tx);
    if (broken) {
      // the crack: a zigzag tear down the middle
      this.icon.addChild(new Graphics().poly([-2, -24, 4, -10, -3, 2, 5, 14, 0, 34, -5, 14, -9, 2, -2, -10]).fill(0x2e1a14));
    }
    if (shield && shield.lost > 0) {
      const slip = new Text({ text: `−${shield.lost}`, style: { fill: '#fbf3e6', fontSize: 18, fontFamily: 'Georgia', fontWeight: 'bold', stroke: { color: '#5a1612', width: 4 } } });
      slip.anchor.set(0.5);
      slip.position.set(0, 46);
      this.icon.addChild(slip);
    }
    this.icon.scale.set(0);
    this.addChild(this.icon);
  }
  protected step() {
    if (this.dead) { this.icon.scale.set(Math.max(0, this.icon.scale.x - 0.25)); if (this.icon.scale.x <= 0) this.destroy(); return; }
    const t = this.t;
    this.icon.scale.set((t < 2 ? t * 0.65 : t < 4 ? 1.3 - (t - 2) * 0.15 : 1.0) * 1.4);
  }
}

/**
 * "MISS" on a tilted grey slip of paper with a soft drop shadow (#13): pops in 2 frames with an overshoot, settles by
 * frame 4, drifts up a little and fades (a miss leaves nothing on screen).
 */
export class MissText extends Pop {
  private slip = new Container();
  constructor() {
    super();
    // slightly uneven cut: a paper slip, not a UI box
    const shape = [-62, -22, 58, -26, 64, 20, -58, 24];
    const sh = new Graphics().poly(shape).fill(0x2a2224);
    sh.position.set(4, 5);
    sh.alpha = 0.45;
    const paper = new Graphics().poly(shape).fill(0xd9d4ca);
    const fold = new Graphics().poly([-62, -22, 58, -26, 59, -18, -61, -14]).fill(0xeae6dd);
    const word = new Text({ text: 'MISS', style: { fill: '#3b3436', fontSize: 34, fontFamily: 'Georgia', fontWeight: 'bold', letterSpacing: 4 } });
    word.anchor.set(0.5);
    word.position.set(1, 1);
    this.slip.addChild(halo(78, 0.5), sh, paper, fold, word);
    this.slip.rotation = -0.09;
    this.slip.scale.set(0);
    this.addChild(this.slip);
  }
  protected step() {
    const t = this.t;
    if (this.dead) { this.alpha -= 0.2; if (this.alpha <= 0) this.destroy(); return; }
    // 1.2: as large on screen as the damage splat
    this.slip.scale.set((t < 2 ? t * 0.62 : t < 4 ? 1.24 - (t - 2) * 0.12 : 1.0) * 1.2);
    this.slip.rotation = -0.09 + (t < 4 ? (4 - t) * 0.03 : 0);
  }
}

/**
 * A Master's technique called out (#295): its name on a long slip of old gold paper with a dark ink edge, over the
 * fighter who uses it. Pops in like MISS, but wider and tilted the other way, so the two never read as one.
 */
export class TechniqueText extends Pop {
  private slip = new Container();
  constructor(name: string) {
    super();
    const word = new Text({ text: name.toUpperCase(), style: { fill: '#3a2410', fontSize: 26, fontFamily: 'Georgia', fontWeight: 'bold', letterSpacing: 3 } });
    word.anchor.set(0.5);
    const w = word.width / 2 + 22;
    const shape = [-w, -20, w - 4, -24, w + 4, 18, -w + 6, 22];
    const sh = new Graphics().poly(shape).fill(0x2a2224);
    sh.position.set(4, 5);
    sh.alpha = 0.45;
    const paper = new Graphics().poly(shape).fill(0xe2b85a).stroke({ color: 0x5a3414, width: 3 });
    const fold = new Graphics().poly([-w, -20, w - 4, -24, w - 3, -16, -w + 1, -12]).fill(0xf0d48a);
    this.slip.addChild(halo(w + 20, 0.45), sh, paper, fold, word);
    this.slip.rotation = 0.07;
    this.slip.scale.set(0);
    this.addChild(this.slip);
  }
  protected step() {
    const t = this.t;
    if (this.dead) { this.alpha -= 0.2; if (this.alpha <= 0) this.destroy(); return; }
    this.slip.scale.set(t < 2 ? t * 0.6 : t < 4 ? 1.2 - (t - 2) * 0.1 : 1.0);
    this.slip.rotation = 0.07 - (t < 4 ? (4 - t) * 0.03 : 0);
  }
}

/** keeps at most one pop per fighter slot and ticks them */
export class FxLayer extends Container {
  private slots = new Map<string, Pop>();
  /** paper and dust kicked up from the sand (#17), under every pop-up */
  readonly ground = this.addChild(new GroundFx());
  /** flames, stains, stars, tape on the fighters (#50), over the bodies and under every pop-up */
  readonly status = this.addChild(new StatusFx());
  show(slot: string, p: Pop, x: number, y: number) {
    this.slots.get(slot)?.fadeOut();
    p.position.set(x, y);
    this.addChild(p);
    this.slots.set(slot, p);
  }
  /** finisher paper (#20): lies on the sand until clear(), under any pop-up shown later */
  addScraps(s: PaperScraps) { this.addChild(s); }
  clear() {
    for (const p of this.slots.values()) p.fadeOut();
    this.slots.clear();
    for (const c of [...this.children]) if (c instanceof PaperScraps) c.destroy({ children: true });
    this.ground.clear();
    this.status.clear();
  }
  update(dt: number) {
    this.ground.update(dt);
    this.status.update(dt);
    for (const c of [...this.children]) if ((c instanceof Pop || c instanceof PaperScraps) && !c.destroyed) c.update(dt);
  }
}
