import { Container, Graphics, Text } from 'pixi.js';
import type { XpSweep } from './levelUpRules';

const BAR_H = 26;
/** seconds for a full bar; shorter sweeps take proportionally less, but never under MIN_SWEEP */
const FULL_SWEEP = 1.1;
const MIN_SWEEP = 0.35;
const START_DELAY = 0.5;
const LEVEL_FLASH = 0.9;

/**
 * XP bar for the result screen (#24): "LEVEL N", the XP the fight earned, and an ink bar that sweeps from the old
 * standing to the new one, filling and starting over once per level gained with a gold "LEVEL UP" flash.
 * Call `update(dt)` every frame (seconds).
 */
export class XpBar extends Container {
  private readonly fill = new Graphics();
  private readonly glow = new Graphics();
  private readonly levelText: Text;
  private readonly flash: Text;
  private readonly sweeps: XpSweep[];
  private index = 0;
  private t = -START_DELAY;
  private flashT = LEVEL_FLASH;
  /** called once when the bar first crosses into a new level */
  onLevelUp?: (level: number) => void;

  constructor(private readonly barWidth: number, sweeps: readonly XpSweep[], earned: number, private readonly caption: (level: number) => string) {
    super();
    this.sweeps = [...sweeps];
    const first = this.sweeps[0];
    this.levelText = new Text({
      text: caption(first.level),
      style: { fontFamily: 'Georgia', fontSize: 26, fontWeight: 'bold', fill: '#f4d3a7', letterSpacing: 2 },
    });
    this.levelText.position.set(0, 0);
    const gain = new Text({
      text: earned > 0 ? `+${earned} XP` : 'No XP',
      style: { fontFamily: 'Georgia', fontSize: 26, fontWeight: 'bold', fill: earned > 0 ? '#f2c14e' : '#a8907e' },
    });
    gain.anchor.set(1, 0);
    gain.position.set(barWidth, 0);

    const y = 40;
    const track = new Graphics()
      .roundRect(0, y, barWidth, BAR_H, 8).fill(0x2a1b1d)
      .roundRect(0, y, barWidth, BAR_H, 8).stroke({ color: 0xb58758, width: 2.5 });
    this.fill.position.set(0, y);
    this.glow.position.set(0, y);
    this.flash = new Text({
      text: 'LEVEL UP',
      style: { fontFamily: 'Georgia', fontSize: 44, fontWeight: 'bold', fill: '#ffe28a', letterSpacing: 6, stroke: { color: '#3a1a10', width: 6 } },
    });
    this.flash.anchor.set(0.5);
    this.flash.position.set(barWidth / 2, y + BAR_H / 2);
    this.flash.alpha = 0;
    this.addChild(track, this.fill, this.glow, this.levelText, gain, this.flash);
    this.draw(first.from);
  }

  /** the whole animation has played */
  get finished(): boolean { return this.index >= this.sweeps.length && this.flashT >= LEVEL_FLASH; }

  /** jump to the end (a click or key on the result screen) */
  skip() {
    while (this.index < this.sweeps.length) this.finishSweep(this.sweeps[this.index]);
    this.flashT = LEVEL_FLASH;
    this.flash.alpha = 0;
  }

  update(dt: number) {
    if (this.flashT < LEVEL_FLASH) {
      this.flashT += dt;
      const k = Math.min(1, this.flashT / LEVEL_FLASH);
      this.flash.alpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
      this.flash.scale.set(1 + 0.25 * Math.min(1, k * 4) - 0.25 * Math.max(0, k * 4 - 1) / 3);
      this.glow.alpha = 1 - k;
      if (this.flashT < LEVEL_FLASH) return;
    }
    const sweep = this.sweeps[this.index];
    if (!sweep) return;
    this.t += dt;
    if (this.t < 0) return;
    const duration = Math.max(MIN_SWEEP, FULL_SWEEP * Math.abs(sweep.to - sweep.from));
    const k = Math.min(1, this.t / duration);
    const eased = 1 - (1 - k) * (1 - k);
    this.draw(sweep.from + (sweep.to - sweep.from) * eased);
    if (k >= 1) {
      this.finishSweep(sweep);
      if (sweep.levelUp) this.flashT = 0;
    }
  }

  private finishSweep(sweep: XpSweep) {
    this.index++;
    this.t = 0;
    if (sweep.levelUp) {
      const next = sweep.level + 1;
      this.levelText.text = this.caption(next);
      this.glow.clear().roundRect(0, 0, this.barWidth, BAR_H, 8).fill({ color: 0xffe28a, alpha: 0.75 });
      this.onLevelUp?.(next);
      const following = this.sweeps[this.index];
      this.draw(following ? following.from : 0);
    } else {
      this.draw(sweep.to);
    }
  }

  private draw(fraction: number) {
    this.fill.clear();
    if (fraction <= 0) return;
    const w = Math.max(10, this.barWidth * Math.min(1, fraction));
    this.fill.roundRect(0, 0, w, BAR_H, 8).fill(0xc99a3e)
      .roundRect(4, 4, Math.max(0, w - 8), 6, 3).fill({ color: 0xffe9a8, alpha: 0.55 });
  }
}
