/**
 * Paper flying off a finisher (#20): torn red crepe strips, drops of red ink, or - with gore off - plain confetti.
 * Pieces flutter, fall and stay lying on the sand until the scene clears the effects layer. Screen px, 30 fps.
 */
import { Container, Graphics } from 'pixi.js';
import type { GoreMode } from './gore';

const FPS = 30;
const GRAVITY = 1.15;      // px per frame^2

const COLORS: Record<GoreMode, readonly number[]> = {
  shreds: [0x8f141c, 0xc3262b, 0xe0483c, 0xa81c22],
  ink: [0x6e0d14, 0x8c1119, 0x560a10],
  off: [0xf4ead5, 0xd8c39a, 0xb99766, 0xe9d9b4, 0xc9a24e],
};

export interface Burst {
  x: number;
  y: number;
  /** how many pieces fly out at once */
  count: number;
  /** main direction, radians, screen space (-PI/2 = up) */
  angle: number;
  spread: number;
  speed: number;
}

interface Piece {
  g: Graphics;
  vx: number;
  vy: number;
  spin: number;
  flip: number;
  flipSpeed: number;
  drag: number;
  floor: number;
  down: boolean;
}

export class PaperScraps extends Container {
  private pieces: Piece[] = [];
  private spurt: { from: () => { x: number; y: number }; left: number; carry: number } | null = null;

  constructor(readonly mode: GoreMode, private readonly floorY: number, private readonly random: () => number = Math.random) {
    super();
  }

  private between(a: number, b: number) { return a + (b - a) * this.random(); }

  private shape(): Graphics {
    const g = new Graphics();
    const colors = COLORS[this.mode];
    const color = colors[Math.floor(this.random() * colors.length)];
    if (this.mode === 'ink') {
      const r = this.between(3, 8);
      // a drop with a short tail along +x (turned to the direction of flight)
      g.circle(0, 0, r).fill(color).poly([-r * 3.2, 0, -r * 0.2, -r * 0.85, -r * 0.2, r * 0.85]).fill(color);
    } else if (this.mode === 'shreds') {
      const l = this.between(12, 30), w = this.between(4, 9);
      g.poly([-l / 2, -w / 3, -l / 6, -w / 2, l / 5, -w / 5, l / 2, -w / 2, l / 2.6, w / 3, 0, w / 2, -l / 3, w / 5]).fill(color);
    } else {
      const s = this.between(7, 15);
      g.poly([-s / 2, -s / 3, s / 2.4, -s / 2, s / 2, s / 3, -s / 3, s / 2]).fill(color);
    }
    return g;
  }

  private spawn(x: number, y: number, angle: number, speed: number) {
    const g = this.shape();
    g.position.set(x, y);
    this.addChild(g);
    const ink = this.mode === 'ink';
    this.pieces.push({
      g,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      spin: ink ? 0 : this.between(-0.4, 0.4),
      flip: this.between(0, Math.PI * 2),
      flipSpeed: ink ? 0 : this.between(0.3, 0.8),
      // light paper brakes hard in the air, ink does not
      drag: ink ? 0.985 : this.between(0.9, 0.95),
      floor: this.floorY + this.between(-12, 22),
      down: false,
    });
  }

  burst(b: Burst) {
    for (let i = 0; i < b.count; i++) {
      this.spawn(b.x, b.y, b.angle + this.between(-b.spread, b.spread), b.speed * this.between(0.35, 1));
    }
  }

  /** keep throwing a few pieces a frame from a moving point (the torn neck) for `frames` frames, weakening */
  spray(from: () => { x: number; y: number }, frames: number) {
    this.spurt = { from, left: frames, carry: 0 };
  }

  private land(p: Piece) {
    p.down = true;
    p.g.y = p.floor;
    if (this.mode === 'ink') {
      // the drop splats flat
      p.g.rotation = this.between(-0.15, 0.15);
      p.g.scale.set(this.between(1.1, 1.9), this.between(0.25, 0.4));
    } else {
      p.g.scale.set(1, this.between(0.3, 0.55));
    }
  }

  update(dt: number) {
    const frames = dt * FPS;
    const s = this.spurt;
    if (s && frames > 0) {
      s.left -= frames;
      s.carry += frames * Math.min(1, s.left / 16) * 1.6;
      for (; s.carry >= 1; s.carry--) {
        const at = s.from();
        // two heartbeats' worth of surging, straight up out of the neck
        const surge = 0.65 + 0.35 * Math.abs(Math.sin(s.left * 0.45));
        this.spawn(at.x, at.y, -Math.PI / 2 + this.between(-0.35, 0.35), this.between(8, 19) * surge);
      }
      if (s.left <= 0) this.spurt = null;
    }
    for (const p of this.pieces) {
      if (p.down) continue;
      const k = Math.pow(p.drag, frames);
      p.vx *= k;
      p.vy = p.vy * k + GRAVITY * frames;
      p.g.x += p.vx * frames;
      p.g.y += p.vy * frames;
      if (this.mode === 'ink') {
        p.g.rotation = Math.atan2(p.vy, p.vx);
      } else {
        p.g.rotation += p.spin * frames;
        p.flip += p.flipSpeed * frames;
        p.g.scale.x = 0.35 + 0.65 * Math.abs(Math.cos(p.flip));   // the strip turns over as it falls
      }
      if (p.vy > 0 && p.g.y >= p.floor) this.land(p);
    }
  }

  /** pieces still in the air */
  get flying() { return this.pieces.filter((p) => !p.down).length; }
}
