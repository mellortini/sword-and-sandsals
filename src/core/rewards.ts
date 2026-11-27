import { findChampionWeapon } from '../data/weaponLookup';
import type { Weapon } from '../data/weapons';
import { crowdGoldReward } from './crowd';
import { FORGE_MATERIALS, forgeFightLoot, readForgedItem } from './forge';
import type { ForgeMaterials } from './forge';
import { awardExperience, fightExperience } from './progression';
import { updateSavedGame } from './save';
import type { SavedCharacter } from './save';
import type { CombatState } from './types';

export interface FightReward {
  readonly fightId: string;
  readonly gold: number;
  readonly experience: number;
  readonly weapon?: Weapon;
  readonly forgeMaterials?: ForgeMaterials;
}

export function getFightReward(state: CombatState, fightId: string, championPrizeId?: string): FightReward | undefined {
  if (state.winner === null || !fightId.trim()) return undefined;
  const { player, enemy } = state.fighters;
  const won = state.winner === 'player';
  const prizeId = championPrizeId ?? enemy.weapon?.id;
  const weapon = won ? findChampionWeapon(prizeId) : undefined;
  return {
    fightId,
    gold: crowdGoldReward(won ? 15 + 5 * enemy.level : 0, player.crowd),
    experience: state.rewards?.experience ?? fightExperience(state.winner, player.level, enemy.level),
    weapon,
    ...(won && { forgeMaterials: forgeFightLoot(state) }),
  };
}

/** True when the weapon (plain, forged or enchanted) is already in the gladiator's hands or backpack. */
export function ownsWeapon(character: SavedCharacter, id: string): boolean {
  return [character.hands?.weapon, character.hands?.offHand, ...character.inventory]
    .some((ownedId) => readForgedItem(ownedId).baseId === id);
}

/** Puts a prize taken on the reward scroll in the backpack; a weapon already owned changes nothing. */
export function takePrizeWeapon(character: SavedCharacter, id: string): SavedCharacter {
  return ownsWeapon(character, id) ? character : { ...character, inventory: [...character.inventory, id] };
}

export function applyFightReward(character: SavedCharacter, reward: FightReward, takeWeapon: boolean): SavedCharacter {
  const rewarded = character.rewardedFightIds ?? [];
  if (rewarded.includes(reward.fightId)) return character;

  const gold = character.gold + reward.gold;
  if (!Number.isSafeInteger(gold)) throw new RangeError('Gold would exceed the save limit.');
  const progress = awardExperience(character, reward.experience);
  const id = reward.weapon?.id;
  const inventory = takeWeapon && id ? takePrizeWeapon(character, id).inventory : character.inventory;
  const forgeMaterials = reward.forgeMaterials ? { ...reward.forgeMaterials } : undefined;
  if (forgeMaterials) {
    for (const material of FORGE_MATERIALS) {
      forgeMaterials[material] += character.forgeMaterials?.[material] ?? 0;
      if (!Number.isSafeInteger(forgeMaterials[material])) throw new RangeError('Forge materials would exceed the save limit.');
    }
  }
  return {
    ...character, ...progress, gold, inventory, rewardedFightIds: [...rewarded, reward.fightId],
    ...(forgeMaterials && { forgeMaterials }),
  };
}

export function claimFightReward(character: SavedCharacter, reward: FightReward, takeWeapon: boolean): Promise<SavedCharacter> {
  return updateSavedGame((stored) => {
    if (stored) {
      const recorded = stored.rewardedFightIds ?? [];
      const expected = character.rewardedFightIds ?? [];
      if (stored.name === character.name && recorded.includes(reward.fightId)) return stored;
      if (stored.name !== character.name || recorded.length !== expected.length || recorded.some((id, index) => id !== expected[index])) {
        throw new Error('The saved career has changed. Reload it before claiming another reward.');
      }
    }
    return applyFightReward(character, reward, takeWeapon);
  });
}
