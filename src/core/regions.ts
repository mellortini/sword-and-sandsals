import { REGIONS } from '../data/regions';
import type { RegionId } from '../data/regions';
import { applyCombatStatus, createCombat } from './combat';
import type { SavedCharacter } from './save';
import type { CombatState, FighterSetup } from './types';

export function isRegionUnlocked(region: RegionId, character: Pick<SavedCharacter, 'leagueWins'>): boolean {
  const requiredBout = REGIONS[region].unlockAfterBout;
  return requiredBout === undefined || (character.leagueWins?.includes(requiredBout) ?? false);
}

/** Create a bout using the arena defaults and existing status and resistance rules. */
export function createRegionalCombat(seed: number, region: RegionId, player: FighterSetup = {}, enemy: FighterSetup = {}): CombatState {
  const { openingStatus, startingPositions } = REGIONS[region];
  const state = startingPositions
    ? createCombat(seed,
      { ...player, position: player.position ?? startingPositions.player },
      { ...enemy, position: enemy.position ?? startingPositions.enemy })
    : createCombat(seed, player, enemy);
  if (!openingStatus) return state;
  return applyCombatStatus(applyCombatStatus(state, 'player', openingStatus), 'enemy', openingStatus);
}
