import { Container, Graphics, Text } from 'pixi.js';
import type { CrowdGift } from '../core/crowd';
import { CROWD_BONUS_FROM, CROWD_GIFTS_FROM, crowdFraction, crowdGiftText, crowdMood } from './crowdMood';
import type { CrowdTier } from './crowdMood';

const BAR_X = 78;
const BAR_W = 168;
const BAR_H = 12;
const FILL_DURATION = 0.4;
const GIFT_DURATION = 1.8;

const TIER_COLOR: Record<CrowdTier, number> = {
  jeering: 0x9a3b31,
  restless: 0xb26a3a,
  watching: 0xbf9a5c,
  cheering: 0xe0b04a,
  roaring: 0xf5d462,
};

/**
 * The crowd's favour for one fighter (#51): a paper strip above the fighter's panel with a bar, notches where
 * the crowd starts adding damage (65) and throwing gifts (80), and the crowd's mood. Gifts float up from it.
 */
export class CrowdMeter extends Container {
  private readonly fill = new Graphics();
  private readonly moodText = new Text({
    style: { fontFamily: 'Georgia', fontSize: 18, fontWeight: 'bold', fill: '#f4d3a7' },
  });
  private readonly notes = new Container();
  private floating: { note: Text; age: number }[] = [];
  private shown = 0;
  private from = 0;
  private target = 0;
  private elapsed = FILL_DURATION;
  private color = TIER_COLOR.watching;

  constructor(width: number) {
    super();
    const strip = new Graphics()
      .roundRect(0, 0, width, 30, 6)
      .fill({ color: 0x2a1b1d, alpha: 0.9 })
      .stroke({ color: 0x815a46, width: 2 })
      .roundRect(BAR_X, 9, BAR_W, BAR_H, 4)
      .fill(0x51424a);
    const notches = new Graphics();
    for (const at of [CROWD_BONUS_FROM, CROWD_GIFTS_FROM]) {
      const x = BAR_X + (BAR_W * at) / 100;
      notches.moveTo(x, 5).lineTo(x, 9 + BAR_H + 4);
    }
    notches.stroke({ color: 0xe7bc99, width: 2, alpha: 0.85 });
    const frame = new Graphics().roundRect(BAR_X, 9, BAR_W, BAR_H, 4).stroke({ color: 0xe7bc99, width: 1.5 });
    const label = new Text({
      text: 'CROWD',
      style: { fontFamily: 'Georgia', fontSize: 16, fontWeight: 'bold', fill: '#c9a47e', letterSpacing: 1 },
    });
    label.anchor.set(0, 0.5);
    label.position.set(12, 15);
    this.moodText.anchor.set(0, 0.5);
    this.moodText.position.set(BAR_X + BAR_W + 12, 15);
    this.addChild(strip, this.fill, notches, frame, label, this.moodText, this.notes);
  }

  setFavour(favour: number, immediate = false) {
    const mood = crowdMood(favour);
    this.moodText.text = mood.label;
    this.moodText.style.fill = mood.tier === 'jeering' ? '#e08a7c' : mood.tier === 'roaring' ? '#ffe28a' : '#f4d3a7';
    this.color = TIER_COLOR[mood.tier];
    const fraction = crowdFraction(favour);
    if (immediate) {
      this.target = fraction;
      this.elapsed = FILL_DURATION;
      this.draw(fraction);
    } else if (fraction !== this.target) {
      this.from = this.shown;
      this.target = fraction;
      this.elapsed = 0;
    } else {
      this.draw(this.shown);
    }
  }

  /** a gift from the stands: its note rises from the strip and fades */
  celebrate(gift: CrowdGift, amount: number) {
    const note = new Text({
      text: crowdGiftText(gift, amount),
      style: {
        fontFamily: 'Georgia', fontSize: 24, fontWeight: 'bold',
        fill: gift === 'bouquet' ? '#ffb3c4' : '#ffd86a', stroke: { color: '#3a1a10', width: 4 },
      },
    });
    note.anchor.set(0.5, 1);
    note.position.set(BAR_X + BAR_W / 2, 0);
    this.notes.addChild(note);
    this.floating.push({ note, age: 0 });
  }

  update(dt: number) {
    for (const f of this.floating) {
      f.age += dt;
      const k = f.age / GIFT_DURATION;
      f.note.y = -8 - 46 * Math.min(1, k * 1.6);
      f.note.alpha = k < 0.7 ? 1 : Math.max(0, 1 - (k - 0.7) / 0.3);
      if (k >= 1) f.note.destroy();
    }
    this.floating = this.floating.filter((f) => f.age < GIFT_DURATION);
    if (this.elapsed >= FILL_DURATION) return;
    this.elapsed = Math.min(FILL_DURATION, this.elapsed + dt);
    const remaining = 1 - this.elapsed / FILL_DURATION;
    this.draw(this.target + (this.from - this.target) * remaining * remaining);
  }

  private draw(fraction: number) {
    this.shown = fraction;
    this.fill.clear();
    if (fraction <= 0) return;
    this.fill.roundRect(BAR_X, 9, Math.max(BAR_H * 0.6, BAR_W * fraction), BAR_H, 4).fill(this.color);
  }
}
