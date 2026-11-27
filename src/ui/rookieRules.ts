import type { SavedCharacter } from '../core/save';
import type { Attributes } from '../core/types';

/**
 * The first bout of a new gladiator is an easy one: a level 1 rookie with no armour, every attribute below the
 * creator's floor, fighting with the calmer `defender` AI. Simulated: sensible play wins practically always,
 * even random clicking about 9 times in 10, and the bout still takes about 20 actions.
 */
export const ROOKIE_ATTRIBUTE = 3;

export const ROOKIE_ATTRIBUTES: Readonly<Attributes> = {
  might: ROOKIE_ATTRIBUTE, agility: ROOKIE_ATTRIBUTE, precision: ROOKIE_ATTRIBUTE, guard: ROOKIE_ATTRIBUTE,
  vitality: ROOKIE_ATTRIBUTE, stamina: ROOKIE_ATTRIBUTE, charm: ROOKIE_ATTRIBUTE, arcana: ROOKIE_ATTRIBUTE,
};

/** True until the saved gladiator has finished any bout, won or lost. */
export function isFirstBout(character: SavedCharacter): boolean {
  return character.level === 1 && character.experience === 0
    && !character.achievements?.completedFightIds.length && !character.nemesis && !character.leagueWins?.length;
}
