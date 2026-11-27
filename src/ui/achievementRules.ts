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

/** the Hall of Fame's columns, in reading order; each runs from the first step to the hardest */
const GROUPS: readonly { name: string; ids: readonly string[] }[] = [
  { name: 'Victories', ids: ['first-win', 'ten-wins', 'fifty-wins', 'hundred-wins'] },
  { name: 'Strikes', ids: ['first-critical', 'twenty-criticals', 'first-charge', 'ten-charges'] },
  { name: 'Guard', ids: ['first-block', 'twenty-blocks', 'win-without-block', 'perfect-win'] },
  { name: 'The Crowd', ids: ['first-gift', 'taunting-win', 'high-favour', 'max-favour'] },
  { name: 'Feats', ids: ['win-without-rest', 'close-win', 'first-finisher', 'full-set'] },
  { name: 'Career', ids: ['first-loss', 'ten-fights', 'fifty-fights', 'level-thirty', 'level-sixty'] },
];

/** every badge sorted into its column; a badge no column names yet is listed under "More", never lost */
export function trophyGroups(character: SavedCharacter): { name: string; ids: string[] }[] {
  const all = trophyList(character).map(({ badge }) => badge.id);
  const groups = GROUPS.map((g) => ({ name: g.name, ids: g.ids.filter((id) => all.includes(id)) }));
  const grouped = new Set(groups.flatMap((g) => g.ids));
  const rest = all.filter((id) => !grouped.has(id));
  return [...groups, { name: 'More', ids: rest }].filter((g) => g.ids.length);
}

export const trophyCount = (character: SavedCharacter) => `${character.achievements?.unlocked.length ?? 0} / ${ACHIEVEMENTS.length}`;
