import { equipmentTotals } from './inventory';
import type { CombatEvent, CombatState, EquipmentLoadout } from './types';

export const ACHIEVEMENT_COUNTERS = ['wins', 'losses', 'criticals', 'blocks', 'charges', 'gifts'] as const;
type AchievementCounter = (typeof ACHIEVEMENT_COUNTERS)[number];

export interface AchievementProgress {
  readonly unlocked: readonly string[];
  readonly completedFightIds: readonly string[];
  readonly counters: Readonly<Record<AchievementCounter, number>>;
}

export interface Achievement {
  readonly id: string;
  readonly title: string;
  readonly description: string;
}

type Signal =
  | { type: 'fight'; id: string; state: CombatState; events: readonly CombatEvent[] }
  | { type: 'equipment'; equipment: EquipmentLoadout }
  | { type: 'level'; level: number }
  | { type: 'finisher' };

interface FightTally {
  won: boolean;
  usedBlock: boolean;
  usedRest: boolean;
  damageTaken: number;
  taunts: number;
  health: number;
  favour: number;
}

type AchievementTest = (context: {
  progress: AchievementProgress;
  signal: Signal;
  fight?: FightTally;
}) => boolean;

function define(id: string, title: string, description: string, earned: AchievementTest) {
  return { badge: { id, title, description }, earned };
}

const RULES = [
  define('first-win', 'First Victory', 'Win a fight.', ({ progress }) => progress.counters.wins >= 1),
  define('ten-wins', 'Arena Regular', 'Win ten fights.', ({ progress }) => progress.counters.wins >= 10),
  define('fifty-wins', 'Seasoned Gladiator', 'Win fifty fights.', ({ progress }) => progress.counters.wins >= 50),
  define('hundred-wins', 'Arena Legend', 'Win one hundred fights.', ({ progress }) => progress.counters.wins >= 100),
  define('first-loss', 'Back to the Sand', 'Finish a fight in defeat.', ({ progress }) => progress.counters.losses >= 1),
  define('ten-fights', 'Frequent Contender', 'Finish ten fights.', ({ progress }) => progress.completedFightIds.length >= 10),
  define('fifty-fights', 'Arena Veteran', 'Finish fifty fights.', ({ progress }) => progress.completedFightIds.length >= 50),
  define('win-without-block', 'Open Guard', 'Win a fight without using Block.', ({ fight }) => !!fight?.won && !fight.usedBlock),
  define('perfect-win', 'Untouched', 'Win a fight without taking damage.', ({ fight }) => !!fight?.won && fight.damageTaken === 0),
  define('first-critical', 'Clean Strike', 'Land a critical hit.', ({ progress }) => progress.counters.criticals >= 1),
  define('twenty-criticals', 'Precision Fighter', 'Land twenty critical hits.', ({ progress }) => progress.counters.criticals >= 20),
  define('first-block', 'Stand Your Ground', 'Successfully block a hit.', ({ progress }) => progress.counters.blocks >= 1),
  define('twenty-blocks', 'Steady Guard', 'Successfully block twenty hits.', ({ progress }) => progress.counters.blocks >= 20),
  define('first-charge', 'Forward!', 'Land a charge attack.', ({ progress }) => progress.counters.charges >= 1),
  define('ten-charges', 'Charging Veteran', 'Land ten charge attacks.', ({ progress }) => progress.counters.charges >= 10),
  define('high-favour', 'Crowd Favourite', 'Finish a fight with at least 80 crowd favour.', ({ fight }) => (fight?.favour ?? 0) >= 80),
  define('max-favour', 'Standing Ovation', 'Finish a fight with 100 crowd favour.', ({ fight }) => fight?.favour === 100),
  define('first-gift', 'From the Stands', 'Receive a crowd gift.', ({ progress }) => progress.counters.gifts >= 1),
  define('taunting-win', 'Show Fighter', 'Win a fight after taunting at least three times.', ({ fight }) => !!fight?.won && fight.taunts >= 3),
  define('close-win', 'Still Standing', 'Win a fight with five or fewer HP.', ({ fight }) => !!fight?.won && fight.health <= 5),
  define('first-finisher', 'Final Blow', 'Perform a finishing move.', ({ signal }) => signal.type === 'finisher'),
  define('full-set', 'Complete Set', 'Wear all five pieces of one armour set.', ({ signal }) =>
    signal.type === 'equipment' && equipmentTotals(signal.equipment).fullSet),
  define('level-thirty', 'Arena Journeyman', 'Reach level 30.', ({ signal }) => signal.type === 'level' && signal.level >= 30),
  define('level-sixty', 'Master Gladiator', 'Reach level 60.', ({ signal }) => signal.type === 'level' && signal.level >= 60),
  define('win-without-rest', 'No Breaks', 'Win a fight without resting.', ({ fight }) => !!fight?.won && !fight.usedRest),
];

export const ACHIEVEMENTS: readonly Achievement[] = RULES.map(({ badge }) => badge);

export function createAchievementProgress(): AchievementProgress {
  return { unlocked: [], completedFightIds: [], counters: { wins: 0, losses: 0, criticals: 0, blocks: 0, charges: 0, gifts: 0 } };
}

export function recordAchievements(signal: Signal, progress = createAchievementProgress()): {
  progress: AchievementProgress; newlyUnlocked: readonly Achievement[];
} {
  let next = progress;
  let fight: FightTally | undefined;
  if (signal.type === 'fight') {
    if (signal.state.winner === null || !signal.id.trim() || progress.completedFightIds.includes(signal.id)) {
      return { progress, newlyUnlocked: [] };
    }
    const { player } = signal.state.fighters;
    const won = signal.state.winner === 'player';
    fight = { won, usedBlock: false, usedRest: false, damageTaken: 0, taunts: 0, health: player.health, favour: player.crowd.favour };
    const counters = { ...progress.counters };
    const increment = (key: AchievementCounter) => {
      counters[key] = Math.min(Number.MAX_SAFE_INTEGER, counters[key] + 1);
    };
    increment(won ? 'wins' : 'losses');

    for (const event of signal.events) {
      switch (event.type) {
        case 'attack':
          if (event.actor === 'player') {
            if (event.crit) increment('criticals');
            if (event.kind === 'charge' && event.damage > 0) increment('charges');
          } else {
            if (event.blocked) increment('blocks');
            fight.damageTaken += event.damage;
          }
          break;
        case 'status':
          if (event.fighter === 'player' && event.healthDelta < 0) fight.damageTaken -= event.healthDelta;
          break;
        case 'block':
          if (event.fighter === 'player') fight.usedBlock = true;
          break;
        case 'rest':
          if (event.fighter === 'player') fight.usedRest = true;
          break;
        case 'taunt':
          if (event.actor === 'player') fight.taunts++;
          break;
        case 'crowd_gift':
          if (event.fighter === 'player') increment('gifts');
          break;
      }
    }
    next = { ...progress, counters, completedFightIds: [...progress.completedFightIds, signal.id] };
  }

  const unlocked = new Set(progress.unlocked);
  const newlyUnlocked = RULES.filter(({ badge, earned }) => !unlocked.has(badge.id) && earned({ progress: next, signal, fight }))
    .map(({ badge }) => badge);
  if (!newlyUnlocked.length) return { progress: next, newlyUnlocked };
  return { progress: { ...next, unlocked: [...progress.unlocked, ...newlyUnlocked.map(({ id }) => id)] }, newlyUnlocked };
}
