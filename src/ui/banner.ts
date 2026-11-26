import { Container, Graphics, Text } from 'pixi.js';
import type { Ticker } from 'pixi.js';

/** Timing at 30 fps, as measured in the reference (docs/ANALIZA_REFERENCJI.md): in ~6 frames, hold ~1 s, out. */
export const BANNER_IN = 6 / 30;
export const BANNER_HOLD = 1;
export const BANNER_OUT = 6 / 30;
export const BANNER_TIME = BANNER_IN + BANNER_HOLD + BANNER_OUT;

const easeOutBack = (t: number) => 1 + 2.2 * (t - 1) ** 3 + 1.2 * (t - 1) ** 2;
const easeIn = (t: number) => t * t * t;

/**
 * Where a line stands at time `t` (s) as a fraction of the slide: -1 = off screen on the side it came from, 0 = in place,
 * +1 = off screen on the far side (it leaves in the direction it came in). Overshoots a little on arrival.
 */
export function bannerOffset(t: number): number {
  if (t <= 0) return -1;
  if (t < BANNER_IN) return easeOutBack(t / BANNER_IN) - 1;
  if (t < BANNER_IN + BANNER_HOLD) return 0;
  if (t < BANNER_TIME) return easeIn((t - BANNER_IN - BANNER_HOLD) / BANNER_OUT);
  return 1;
}

/** A strip of torn paper `w`×`h` centred on (0, 0), with a darker copy under it as its shadow. */
function paperStrip(w: number, h: number, color: number, edge: number, seed: number) {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const torn = (x: number, from: number, to: number) => {
    const pts: number[] = [];
    const steps = 9;
    for (let i = 0; i <= steps; i++) pts.push(x + (rnd() - 0.5) * 22, from + ((to - from) * i) / steps);
    return pts;
  };
  const outline = [
    ...torn(-w / 2, -h / 2, h / 2),
    ...torn(w / 2, h / 2, -h / 2),
  ];
  // the top and bottom edges stay straight, the ends are torn
  const g = new Graphics();
  g.poly(outline.map((v, i) => v + (i % 2 ? 9 : 7))).fill({ color: 0x1a0d0a, alpha: 0.4 });
  g.poly(outline).fill(color).stroke({ color: edge, width: 3, alignment: 0 });
  // a faint fold across the strip
  g.moveTo(-w / 2 + 30, -h * 0.06).lineTo(w / 2 - 30, h * 0.04).stroke({ color: 0xffffff, alpha: 0.12, width: 2 });
  return g;
}

function bannerLine(text: string, paper: number, edge: number, ink: string, fontSize: number, seed: number) {
  const line = new Container();
  const t = new Text({
    text: text.toUpperCase(),
    style: { fontFamily: 'Georgia', fontSize, fontWeight: 'bold', fill: ink, letterSpacing: fontSize * 0.12 },
  });
  t.anchor.set(0.5);
  line.addChild(paperStrip(t.width + fontSize * 1.4, fontSize * 1.45, paper, edge, seed), t);
  return line;
}

export interface BannerOptions {
  /** stage width and the y of the banner's centre */
  width: number;
  y: number;
  /** a click or a key ends the hold early (default true) */
  skippable?: boolean;
}

/**
 * Title banner of two lines (#15), e.g. "ARENA" / "BATTLE": the first slides in from the left on cream paper, the second
 * from the right on red paper; they hold for a second and leave the way they were going. Resolves when both are gone.
 * A click or a key ends the hold early. With reduced motion the lines just appear and disappear.
 */
export function playBanner(parent: Container, ticker: Ticker, [top, bottom]: readonly [string, string],
  { width, y, skippable = true }: BannerOptions): Promise<void> {
  const root = new Container();
  const upper = bannerLine(top, 0xecd9b0, 0xa07a4f, '#3a2418', 104, 7);
  const lower = bannerLine(bottom, 0x9b2a24, 0x5e1612, '#fff0cb', 128, 19);
  upper.y = y - 78;
  lower.y = y + 70;
  upper.rotation = -0.025;
  lower.rotation = 0.02;
  root.addChild(upper, lower);
  parent.addChild(root);

  const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const travel = (line: Container) => width / 2 + line.width / 2 + 40;
  let t = 0;
  const place = () => {
    const o = still ? 0 : bannerOffset(t);
    upper.x = width / 2 + o * travel(upper);
    lower.x = width / 2 - o * travel(lower);
    root.alpha = still ? (t < BANNER_TIME ? 1 : 0) : 1;
  };
  place();

  return new Promise((resolve) => {
    const listening = new AbortController();
    const skip = () => { if (t < BANNER_IN + BANNER_HOLD) t = Math.max(t, BANNER_IN + BANNER_HOLD); };
    if (skippable) {
      window.addEventListener('keydown', skip, { signal: listening.signal });
      window.addEventListener('pointerdown', skip, { signal: listening.signal });
    }
    const tick = (tk: Ticker) => {
      t += tk.deltaMS / 1000;
      place();
      if (t < BANNER_TIME) return;
      ticker.remove(tick);
      listening.abort();
      root.destroy({ children: true });
      resolve();
    };
    ticker.add(tick);
  });
}
