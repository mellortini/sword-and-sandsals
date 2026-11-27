import { describe, expect, it } from 'vitest';
import crowd from '../../assets/bg/arena_crowd.json';
import sheet from '../../assets/fx/crowd.json';
import { WAVE_SPEED, armRaise, raisedShare, seatHash, throwGifts, throwPath } from './crowdWave';
import type { Seat } from './crowdWave';

const seats = crowd.seats as Seat[];

describe('the living crowd (#52)', () => {
  it('knows where the painted spectators sit', () => {
    expect(seats.length).toBeGreaterThan(300);
    for (const s of seats) {
      expect(s.y).toBeGreaterThan(150);
      expect(s.y).toBeLessThan(620);   // in the stands, above the wall and the sand
      expect(s.k).toBeGreaterThan(30);
      expect(s.c).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('a cheer runs across the stands from where the blow fell', () => {
    const cheer = [{ start: 0, strength: 1, fromX: 200 }];
    const near = seats.findIndex((s) => Math.abs(s.x - 200) < 40);
    const far = seats.findIndex((s) => s.x > 1700);
    expect(armRaise(seats[near], near, cheer, 0.2)).toBeGreaterThan(0.5);
    expect(armRaise(seats[far], far, cheer, 0.2)).toBe(0);
    expect(armRaise(seats[far], far, cheer, 0.2 + 1550 / WAVE_SPEED)).toBeGreaterThan(0.5);
    // and everyone sits down again
    expect(raisedShare(seats, cheer, 5)).toBe(0);
  });

  it('a crit brings part of the stands up, a finishing blow nearly all of it', () => {
    const peak = (strength: number) => Math.max(...[0.6, 0.9, 1.2, 1.5].map((t) => raisedShare(seats, [{ start: 0, strength, fromX: 960 }], t)));
    const crit = peak(0.5), finish = peak(1);
    expect(crit).toBeGreaterThan(0.3);
    expect(crit).toBeLessThan(0.65);
    expect(finish).toBeGreaterThan(0.85);
  });

  it('a crowd in love with the fight keeps a few fans waving between cheers', () => {
    const share = (mood: number) => Math.max(...[0, 1, 2, 3, 4].map((t) => raisedShare(seats, [], t, mood)));
    expect(share(0)).toBe(0);
    expect(share(1)).toBeGreaterThan(0.02);
    expect(share(1)).toBeLessThan(0.15);
    expect(seatHash(3)).toBe(seatHash(3));
  });

  it('throws flowers and coins in an arc onto the sand, where they stay', () => {
    let r = 0.1;
    const rand = () => (r = (r * 9301 + 49297) % 233280 / 233280);
    const throws = throwGifts('bouquet', 5, seats, 700, 890, 2, rand);
    expect(throws).toHaveLength(5);
    for (const th of throws) {
      expect(sheet.frames).toHaveProperty(th.frame);
      expect(throwPath(th, th.start - 0.01)).toBeNull();
      const start = throwPath(th, th.start)!, top = throwPath(th, th.start + th.duration / 2)!, end = throwPath(th, th.start + th.duration + 3)!;
      expect(start.y).toBeCloseTo(th.from.y);
      expect(top.y).toBeLessThan(Math.min(th.from.y, th.to.y));   // up in the air
      expect(end).toMatchObject({ x: th.to.x, y: th.to.y, landed: true });
      expect(Math.abs(th.to.x - 700)).toBeLessThanOrEqual(180);
      expect(th.to.y).toBeGreaterThanOrEqual(890);
    }
    expect(throwGifts('coin', 3, seats, 700, 890, 0, rand).every((t) => t.frame === 'coin')).toBe(true);
    expect(throwGifts('coin', 3, [], 700, 890, 0, rand)).toEqual([]);
  });
});
