import { PULPPORT_CHAMPION_WEAPON } from '../data/leagues';
import type { Weapon } from '../data/weapons';
import { crowdGoldReward } from './crowd';
import { awardExperience, fightExperience } from './progression';
import { saveGame } from './save';
import type { SavedCharacter } from './save';
import type { CombatState } from './types';

export interface FightReward {
  readonly fightId: string;
  readonly gold: number;
  readonly experience: number;
  readonly weapon?: Weapon;
}

export function getFightReward(state: CombatState, fightId: string, championPrizeId?: string): FightReward | undefined {
  if (state.winner === null || !fightId.trim()) return undefined;
  const { player, enemy } = state.fighters;
  const won = state.winner === 'player';
  const prizeId = championPrizeId ?? enemy.weapon?.id;
  const weapon = won && prizeId === PULPPORT_CHAMPION_WEAPON.id ? PULPPORT_CHAMPION_WEAPON : undefined;
  return {
    fightId,
    gold: crowdGoldReward(won ? 15 + 5 * enemy.level : 0, player.crowd),
    experience: state.rewards?.experience ?? fightExperience(state.winner, player.level, enemy.level),
    weapon,
  };
}

export function applyFightReward(character: SavedCharacter, reward: FightReward, takeWeapon: boolean): SavedCharacter {
  const rewarded = character.rewardedFightIds ?? [];
  if (rewarded.includes(reward.fightId)) return character;

  const gold = character.gold + reward.gold;
  if (!Number.isSafeInteger(gold)) throw new RangeError('Gold would exceed the save limit.');
  const progress = awardExperience(character, reward.experience);
  const id = reward.weapon?.id;
  const hasWeapon = id !== undefined && [character.hands?.weapon, character.hands?.offHand, ...character.inventory].includes(id);
  const inventory = takeWeapon && id && !hasWeapon ? [...character.inventory, id] : character.inventory;
  return { ...character, ...progress, gold, inventory, rewardedFightIds: [...rewarded, reward.fightId] };
}

export async function claimFightReward(character: SavedCharacter, reward: FightReward, takeWeapon: boolean): Promise<SavedCharacter> {
  const updated = applyFightReward(character, reward, takeWeapon);
  if (updated !== character) await saveGame(updated);
  return updated;
}
