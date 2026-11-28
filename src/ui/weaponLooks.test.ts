import type { Kit } from '../rig/PaperRig';
import { describe, expect, it } from 'vitest';
import { WEAPON_FAMILIES, shownWeapon, tierForSet, weaponId, weaponName, drawableLook } from './weaponLooks';

describe('wardrobe weapons', () => {
  it('offers every family of the catalogue', () => {
    expect([...WEAPON_FAMILIES]).toEqual(['sword', 'axe', 'spear', 'hammer', 'trident']);
  });

  it('names the choices like the catalogue and the sprites of #36', () => {
    expect(weaponId({ family: 'axe', tier: 0 })).toBe('gladius');
    expect(weaponId({ family: 'axe', tier: 7 })).toBe('axe7');
    expect(weaponId({ family: 'spear', tier: 10 })).toBe('spear10');
    expect(weaponName({ family: 'hammer', tier: 0 })).toBe('Gladius');
    expect(weaponName({ family: 'hammer', tier: 3 })).toMatch(/^3\. .*Hammer$/);
  });

  it('matches the weapon tier to the armour set tier', () => {
    expect(tierForSet(0)).toBe(0);
    expect(tierForSet(8)).toBe(8);
    expect(tierForSet(12)).toBe(10);
  });

  it('shows the gladius while a weapon has no sprite yet', () => {
    const only = (keys: string[]) => (k: string) => keys.includes(k);
    expect(shownWeapon({ family: 'spear', tier: 4 }, only(['weapon_gladius']))).toEqual({ weapon: 'gladius', missing: true });
    expect(shownWeapon({ family: 'spear', tier: 4 }, only(['weapon_spear4']))).toEqual({ weapon: 'spear4', missing: false });
    expect(shownWeapon({ family: 'sword', tier: 0 }, only(['weapon_gladius']))).toEqual({ weapon: 'gladius', missing: false });
  });
});

describe('drawable look', () => {
  const kit = { has: (key: string) => key === 'weapon_gladius' || key === 'weapon_sword1' } as unknown as Kit;
  const look = { skin: 0, face: 0, hair: 0, hairColor: 0, beard: 0, helmet: 0, armor: 0, shoulders: 0, greaves: 0, boots: 0, weapon: 'sword1' };
  it('keeps a weapon the kit can draw and shows the gladius for one without a sprite yet', () => {
    expect(drawableLook(kit, look)).toBe(look);
    expect(drawableLook(kit, { ...look, weapon: 'sword7' })).toEqual({ ...look, weapon: 'gladius' });
  });
});
