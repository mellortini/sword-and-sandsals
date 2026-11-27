import { describe, expect, it } from 'vitest';
import { ARENAS, isArenaId } from './arenas';

// only the keys are used for the pictures; the crowds are loaded
const pictures = Object.keys(import.meta.glob('../../assets/bg/*.png'));
interface Crowd { size: number[]; seats: { y: number; sheet: number[] }[] }
const crowds = import.meta.glob<Crowd>('../../assets/bg/*_people.json', { eager: true, import: 'default' });

describe('arenas', () => {
  it.each(Object.entries(ARENAS))('%s has its empty stands and a crowd on a 1920x1080 frame', (_, { picture, people }) => {
    expect(pictures).toContain(`../../assets/${picture}`);
    expect(pictures).toContain(`../../assets/${people}.png`);
    const crowd = crowds[`../../assets/${people}.json`];
    expect(crowd.size).toEqual([1920, 1080]);
    expect(crowd.seats.length).toBeGreaterThan(100);
    // every head is in the stands, above the floor line backdrop.ts keeps sharp
    expect(Math.max(...crowd.seats.map((s) => s.y))).toBeLessThan(665);
    for (const s of crowd.seats) expect(s.sheet).toHaveLength(4);
  });

  it('knows only its own ids', () => {
    expect(isArenaId('kraftmoor')).toBe(true);
    expect(isArenaId('toString')).toBe(false);
    expect(isArenaId(null)).toBe(false);
  });
});
