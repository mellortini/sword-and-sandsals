import { PULPPORT_LEAGUES } from './leagues';
import { WEAPONS } from './weapons';
import type { Weapon } from './weapons';

const championWeapons = Object.values(PULPPORT_LEAGUES).flat()
  .flatMap(({ champion }) => champion ? [champion.weapon] : []);

export function findChampionWeapon(id?: string): Weapon | undefined {
  return championWeapons.find((weapon) => weapon.id === id);
}

/** Equipment lookup includes league prizes. Shops use the separate catalogue. */
export function findWeapon(id?: string): Weapon | undefined {
  return findChampionWeapon(id) ?? WEAPONS.find((weapon) => weapon.id === id);
}
