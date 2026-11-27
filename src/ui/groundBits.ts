/**
 * Paper bits kicked up from the arena floor (#17): torn flakes, strips and puffs of tissue-paper dust when a fighter
 * lands, slams into the sand after a charge, falls, or flinches from a blow. Pure simulation in screen px at 30 fps;
 * src/ui/groundFx.ts draws it. Everything is short-lived and the pool is capped, so a long fight never piles up pieces.
 */

export type Kick = 'land' | 'charge' | 'fall' | 'struck';
export type BitKind = 'flake' | 'strip' | 'puff';

/** how many sprite variants of each kind the sheet has (assets/fx/bits.json: flake1-4, strip1-2, puff1-3) */
export const VARIANTS: Readonly<Record<BitKind, number>> = { flake: 4, strip: 2, puff: 3 };

export interface Bit {
  kind: BitKind;
  variant: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  spin: number;
  /** turning over in the air: drawn width = 0.35 .. 1 of the piece */
  flip: number;
  flipSpeed: number;
  /** drawn size relative to the sprite (puffs grow) */
  scale: number;
  alpha: number;
  age: number;
  /** frames to live; pieces lying on the sand fade in their last frames */
  life: number;
  floor: number;
  down: boolean;
  /** puffs only: size at birth and when gone */
  grow?: [number, number];
}

/** most pieces alive at once; the oldest give way to new ones */
export const MAX_BITS = 120;
const GRAVITY = 1.0;   // px per frame^2, as the finisher scraps
const FADE = 10;       // frames a piece takes to fade out at the end of its life

export class GroundBits {
  readonly bits: Bit[] = [];
  constructor(private readonly random: () => number = Math.random) {}

  private between(a: number, b: number) { return a + (b - a) * this.random(); }
  private pick(kind: BitKind) { return Math.floor(this.random() * VARIANTS[kind]); }

  private add(b: Bit) {
    if (this.bits.length >= MAX_BITS) this.bits.shift();
    this.bits.push(b);
  }

  /** a paper piece thrown from (x, y) at `angle` (radians, screen: -PI/2 = up) */
  private piece(kind: 'flake' | 'strip', x: number, y: number, angle: number, speed: number, floorY: number) {
    this.add({
      kind, variant: this.pick(kind), x, y,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      rotation: this.between(0, Math.PI * 2), spin: this.between(-0.35, 0.35),
      flip: this.between(0, Math.PI * 2), flipSpeed: this.between(0.25, 0.6),
      scale: kind === 'strip' ? this.between(0.75, 1) : this.between(0.6, 1),
      alpha: 1, age: 0, life: Math.round(this.between(40, 56)),
      floor: floorY + this.between(-4, 14), down: false,
    });
  }

  /** a puff of dust rolling along the sand from x in direction `dir` (+1 right, -1 left) */
  private puff(x: number, floorY: number, dir: number, speed: number, size: number) {
    const s = size * this.between(0.85, 1.15);
    this.add({
      kind: 'puff', variant: this.pick('puff'), x, y: floorY + this.between(-2, 6),
      vx: dir * speed * this.between(0.7, 1.1), vy: -this.between(0.2, 0.7),
      rotation: this.between(-0.08, 0.08), spin: 0, flip: 0, flipSpeed: 0,
      scale: s * 0.55, alpha: 0.9, age: 0, life: Math.round(this.between(20, 28)),
      floor: floorY, down: true, grow: [s * 0.55, s * 1.25],
    });
  }

  private spray(kind: 'flake' | 'strip', n: number, x: number, y: number, angle: number, spread: number, speed: number, floorY: number) {
    for (let i = 0; i < n; i++) this.piece(kind, x + this.between(-8, 8), y, angle + this.between(-spread, spread), speed * this.between(0.45, 1), floorY);
  }

  /**
   * Kick up paper for one event. `x` = where it happens, `floorY` = the sand line, `dir` = the way the bits fly
   * (+1 right, -1 left: forward for a charge, away from the blow when struck), `fromY` = where struck flakes start.
   */
  kick(kind: Kick, x: number, floorY: number, dir: 1 | -1, fromY = floorY - 6) {
    const up = -Math.PI / 2;
    switch (kind) {
      case 'land':
        // both feet come down: a low puff to each side, a few flakes hop up
        this.puff(x - 18, floorY, -1, 3.2, 0.8);
        this.puff(x + 18, floorY, 1, 3.2, 0.8);
        this.spray('flake', 6, x, floorY - 4, up, 1.1, 10, floorY);
        break;
      case 'charge':
        // the body ploughs into the sand: dust and paper thrown ahead
        this.puff(x + dir * 30, floorY, dir, 5, 1.05);
        this.puff(x, floorY, dir, 2.5, 0.95);
        this.puff(x - dir * 24, floorY, -dir, 2, 0.75);
        this.spray('flake', 10, x + dir * 20, floorY - 6, up + dir * 0.55, 0.7, 15, floorY);
        this.spray('strip', 2, x + dir * 20, floorY - 6, up + dir * 0.45, 0.5, 13, floorY);
        break;
      case 'fall':
        // flat on the back: a wide puff both ways
        this.puff(x - 34, floorY, -1, 4, 1.1);
        this.puff(x + 34, floorY, 1, 4, 1.1);
        this.puff(x, floorY, dir, 1.2, 0.9);
        this.spray('flake', 8, x, floorY - 6, up, 1.2, 12, floorY);
        this.spray('strip', 2, x, floorY - 6, up, 0.9, 10, floorY);
        break;
      case 'struck':
        // a few flakes knocked off the body, away from the blow
        this.spray('flake', 5, x, fromY, up + dir * 0.9, 0.5, 11, floorY);
        break;
    }
  }

  /** advance by `frames` (30 fps frames) */
  step(frames: number) {
    for (const b of this.bits) {
      b.age += frames;
      if (b.kind === 'puff') {
        const t = Math.min(1, b.age / b.life);
        const k = Math.pow(0.86, frames);
        b.vx *= k; b.vy *= k;
        b.x += b.vx * frames; b.y += b.vy * frames;
        b.scale = b.grow![0] + (b.grow![1] - b.grow![0]) * (1 - (1 - t) * (1 - t));
        b.alpha = 0.9 * (1 - t * t);
        continue;
      }
      if (!b.down) {
        const k = Math.pow(0.93, frames);
        b.vx *= k;
        b.vy = b.vy * k + GRAVITY * frames;
        b.x += b.vx * frames; b.y += b.vy * frames;
        b.rotation += b.spin * frames;
        b.flip += b.flipSpeed * frames;
        if (b.vy > 0 && b.y >= b.floor) { b.y = b.floor; b.down = true; }
      }
      b.alpha = Math.max(0, Math.min(1, (b.life - b.age) / FADE));
    }
    for (let i = this.bits.length - 1; i >= 0; i--) if (this.bits[i].age >= this.bits[i].life) this.bits.splice(i, 1);
  }

  clear() { this.bits.length = 0; }
}
