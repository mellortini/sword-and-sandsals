import { describe, expect, it } from 'vitest';
import { shownSword, swordForSet, swordId, swordName } from './swordLooks';

describe('wardrobe swords', () => {
  it('names the choices like the sprites of #36', () => {
    expect(swordId(0)).toBe('gladius');
    expect(swordId(7)).toBe('sword7');
    expect(swordName(0)).toBe('Gladius');
    expect(swordName(3)).toMatch(/^3\. /);
  });

  it('matches the sword to the armour set tier', () => {
    expect(swordForSet(0)).toBe(0);
    expect(swordForSet(8)).toBe(8);
    expect(swordForSet(12)).toBe(10);
  });

  it('shows the gladius while a sword has no sprite yet', () => {
    const only = (keys: string[]) => (k: string) => keys.includes(k);
    expect(shownSword(4, only(['weapon_gladius']))).toEqual({ weapon: 'gladius', missing: true });
    expect(shownSword(4, only(['weapon_gladius', 'weapon_sword4']))).toEqual({ weapon: 'sword4', missing: false });
    expect(shownSword(0, only(['weapon_gladius']))).toEqual({ weapon: 'gladius', missing: false });
  });
});
