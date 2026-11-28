import { Container, Graphics, Text } from 'pixi.js';
import { RHYTHM_STEPS, onSeventhStep, rhythmSteps } from '../core/rhythm';

const FEET_X = 104;
const FOOT_GAP = 22;
const LIT = 0xe0b04a;
const FULL = 0xf5d462;
const DIM = 0x51424a;

/** one paper footprint, toes up: sole, heel and four toes, around (0, 0) */
function drawFoot(g: Graphics, color: number) {
  g.clear()
    .ellipse(0, -1, 5.2, 7.5).fill(color)
    .ellipse(0, 8, 4.2, 4.6).fill(color);
  for (const [x, y, r] of [[-4.2, -10.5, 1.9], [-1.4, -12.3, 2.1], [1.6, -12.2, 2], [4.3, -10.4, 1.7]] as const) g.circle(x, y, r).fill(color);
}

/**
 * The fighter's Rhythm (#294) as a paper strip above the crowd strip: seven footprints, lit one by one as the Rhythm
 * grows; all seven glow and pulse on the Seventh Step, when the next attack cannot miss.
 */
export class RhythmTrack extends Container {
  private readonly feet: Graphics[] = [];
  private readonly stepText = new Text({
    text: '7TH STEP',
    style: { fontFamily: 'Georgia', fontSize: 14, fontWeight: 'bold', fill: '#f5d462', letterSpacing: 1 },
  });
  private lit = -1;
  private full = false;
  private time = 0;

  constructor(width: number) {
    super();
    const strip = new Graphics()
      .roundRect(0, 0, width, 30, 6)
      .fill({ color: 0x2a1b1d, alpha: 0.9 })
      .stroke({ color: 0x815a46, width: 2 });
    const label = new Text({
      text: 'RHYTHM',
      style: { fontFamily: 'Georgia', fontSize: 16, fontWeight: 'bold', fill: '#c9a47e', letterSpacing: 1 },
    });
    label.anchor.set(0, 0.5);
    label.position.set(12, 15);
    this.addChild(strip, label);
    for (let i = 0; i < RHYTHM_STEPS; i++) {
      const foot = new Graphics();
      // a walk: left and right feet in turn, a little up and down, toes forward
      foot.position.set(FEET_X + 10 + i * FOOT_GAP, i % 2 ? 14 : 17);
      foot.rotation = i % 2 ? 0.35 : -0.35;
      foot.scale.set(i % 2 ? -0.95 : 0.95, 0.95);
      this.feet.push(foot);
      this.addChild(foot);
    }
    this.stepText.anchor.set(0, 0.5);
    this.stepText.position.set(FEET_X + RHYTHM_STEPS * FOOT_GAP + 4, 15);
    this.addChild(this.stepText);
    this.setRhythm(0);
  }

  setRhythm(rhythm: number) {
    const lit = rhythmSteps(rhythm);
    const full = onSeventhStep(rhythm);
    if (lit === this.lit && full === this.full) return;
    this.lit = lit;
    this.full = full;
    this.feet.forEach((foot, i) => drawFoot(foot, i < lit ? (full ? FULL : LIT) : DIM));
    this.stepText.visible = full;
    if (!full) for (const foot of this.feet) foot.alpha = 1;
  }

  update(dt: number) {
    if (!this.full) return;
    // the full walk breathes, one footprint after another
    this.time += dt;
    this.feet.forEach((foot, i) => { foot.alpha = 0.72 + 0.28 * Math.sin(this.time * 6 - i * 0.7); });
    this.stepText.alpha = 0.75 + 0.25 * Math.sin(this.time * 6);
  }
}
