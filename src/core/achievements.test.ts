import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS, createAchievementProgress, recordAchievements } from './achievements';
import { createCombat, performAction } from './combat';
import type { CombatEvent } from './types';

describe('achievements', () => {
  it('has 25 uniquely identified achievements and tracks a completed fight once', () => {
    expect(ACHIEVEMENTS).toHaveLength(25);
    expect(new Set(ACHIEVEMENTS.map(({ id }) => id)).size).toBe(25);

    const initial = createCombat(1, { position: 4, attributes: { might: 1_000 } }, { position: 5 });
    const finish = performAction(initial, 'normal');
    expect(finish.state.winner).toBe('player');
    const progress = createAchievementProgress();
    const incomplete = recordAchievements({ type: 'fight', id: 'duel-1', state: initial, events: [] }, progress);
    expect(incomplete).toEqual({ progress, newlyUnlocked: [] });
    const signal = { type: 'fight' as const, id: 'duel-1', state: finish.state, events: finish.events };
    const recorded = recordAchievements(signal, progress);
    expect(recorded.newlyUnlocked.map(({ id }) => id)).toEqual(['first-win', 'win-without-block', 'perfect-win', 'win-without-rest']);
    expect(recorded.progress.counters.wins).toBe(1);
    expect(recordAchievements(signal, recorded.progress)).toEqual({ progress: recorded.progress, newlyUnlocked: [] });
  });

  it('counts combat events and does not reward a victory as untouched after bleeding damage', () => {
    const initial = createCombat(1, { position: 4, attributes: { might: 1_000 } }, { position: 5 });
    const finish = performAction(initial, 'normal');
    const events: CombatEvent[] = [
      { type: 'block', fighter: 'player' },
      { type: 'status', fighter: 'player', kind: 'torn', healthDelta: -2, turnsRemaining: 0, skipped: false },
      { type: 'crowd_gift', fighter: 'player', gift: 'bouquet', amount: 2 },
      ...finish.events,
    ];
    const result = recordAchievements({ type: 'fight', id: 'duel-2', state: finish.state, events });
    expect(result.progress.counters.gifts).toBe(1);
    expect(result.progress.unlocked).toContain('first-gift');
    expect(result.progress.unlocked).not.toContain('perfect-win');
    expect(result.progress.unlocked).not.toContain('win-without-block');
  });

  it('returns new notification data for a finisher, a complete set and level milestones', () => {
    const finish = recordAchievements({ type: 'finisher' });
    expect(finish.newlyUnlocked.map(({ id }) => id)).toEqual(['first-finisher']);
    const outfit = { helmet: 5, armor: 5, shoulders: 5, greaves: 5, boots: 5 };
    const equipped = recordAchievements({ type: 'equipment', equipment: outfit }, finish.progress);
    expect(equipped.newlyUnlocked.map(({ id }) => id)).toEqual(['full-set']);
    const level = recordAchievements({ type: 'level', level: 60 }, equipped.progress);
    expect(level.newlyUnlocked.map(({ id }) => id)).toEqual(['level-thirty', 'level-sixty']);
    expect(recordAchievements({ type: 'finisher' }, level.progress).newlyUnlocked).toEqual([]);
  });
});
