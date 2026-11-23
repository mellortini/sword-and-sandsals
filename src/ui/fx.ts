/**
 * Combat pop-ups in paper style. Timing from the reference: the number appears on the hit frame small and grey,
 * bursts into a red splat in 2-3 frames with an overshoot, and STAYS above the head until the next hit.
 */
import { Container, Graphics, Text } from 'pixi.js';

const FPS = 30;

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
  update(dt: number) { this.t += dt * FPS; this.step(); }
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
    sh.position.set(4, 5);
    sh.alpha = 0.55;
    const g = new Graphics();
    star(g, 34, 56, 9, 7, crit ? 0xd8452c : 0xb8302a);
    const inner = new Graphics();
    star(inner, 22, 36, 9, 3, crit ? 0xe8683e : 0xc93a30);
    const num = new Text({ text: String(value), style: { fill: '#fbf3e6', fontSize: 42, fontFamily: 'Georgia', fontWeight: 'bold', stroke: { color: '#5a1612', width: 4 } } });
    num.anchor.set(0.5);
    this.burst.addChild(sh, g, inner, num);
    if (crit) {
      const c = new Text({ text: 'CRITICAL', style: { fill: '#e8be4c', fontSize: 20, fontFamily: 'Georgia', fontWeight: 'bold', stroke: { color: '#3a1a10', width: 4 } } });
      c.anchor.set(0.5);
      c.position.set(0, -58);
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
    this.burst.scale.set(s);
  }
}

export class BlockShield extends Pop {
  private icon = new Container();
  constructor() {
    super();
    const g = new Graphics();
    const shape = [-26, -24, 26, -24, 28, 4, 0, 34, -28, 4];
    const sh = new Graphics().poly(shape).fill(0x2e2a28);
    sh.position.set(3, 4);
    sh.alpha = 0.45;
    g.poly(shape).fill(0xb9bec6);
    const inner = new Graphics().poly([-18, -17, 18, -17, 19, 2, 0, 24, -19, 2]).fill(0x8d939b);
    const tx = new Text({ text: 'BLOCK', style: { fill: '#f3e6d6', fontSize: 13, fontFamily: 'Georgia', fontWeight: 'bold', stroke: { color: '#3b3a38', width: 3 } } });
    tx.anchor.set(0.5);
    tx.position.set(0, -3);
    this.icon.addChild(sh, g, inner, tx);
    this.icon.scale.set(0);
    this.addChild(this.icon);
  }
  protected step() {
    if (this.dead) { this.icon.scale.set(Math.max(0, this.icon.scale.x - 0.25)); if (this.icon.scale.x <= 0) this.destroy(); return; }
    const t = this.t;
    this.icon.scale.set(t < 2 ? t * 0.65 : t < 4 ? 1.3 - (t - 2) * 0.15 : 1.0);
  }
}

/** keeps at most one pop per fighter slot and ticks them */
export class FxLayer extends Container {
  private slots = new Map<string, Pop>();
  show(slot: string, p: Pop, x: number, y: number) {
    this.slots.get(slot)?.fadeOut();
    p.position.set(x, y);
    this.addChild(p);
    this.slots.set(slot, p);
  }
  clear() { for (const p of this.slots.values()) p.fadeOut(); this.slots.clear(); }
  update(dt: number) {
    for (const c of [...this.children]) if (c instanceof Pop && !c.destroyed) c.update(dt);
  }
}
