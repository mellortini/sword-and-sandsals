import { ACHIEVEMENTS, createAchievementProgress, recordAchievements } from '../core/achievements';
import type { Achievement } from '../core/achievements';
import type { SavedCharacter } from '../core/save';
import type { EquipmentLoadout } from '../core/types';

type Signal = Parameters<typeof recordAchievements>[0];

/** The character after one or more achievement signals, and every badge they unlocked (#203). */
export function recordForCareer(character: SavedCharacter, ...signals: Signal[]): { character: SavedCharacter; unlocked: Achievement[] } {
  const start = character.achievements ?? createAchievementProgress();
  let progress = start;
  const unlocked: Achievement[] = [];
  for (const signal of signals) {
    const result = recordAchievements(signal, progress);
    progress = result.progress;
    unlocked.push(...result.newlyUnlocked);
  }
  return { character: progress === start ? character : { ...character, achievements: progress }, unlocked };
}

export const equipmentSignal = (equipment: EquipmentLoadout): Signal => ({ type: 'equipment', equipment });

/** Every badge in catalogue order with whether it is earned, for the Hall of Fame. */
export function trophyList(character: SavedCharacter): { badge: Achievement; earned: boolean }[] {
  const earned = new Set(character.achievements?.unlocked ?? []);
  return ACHIEVEMENTS.map((badge) => ({ badge, earned: earned.has(badge.id) }));
}

export const trophyCount = (character: SavedCharacter) => `${character.achievements?.unlocked.length ?? 0} / ${ACHIEVEMENTS.length}`;
