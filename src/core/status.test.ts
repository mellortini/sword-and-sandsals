import { describe, expect, it } from 'vitest';
import { applyCombatStatus, createCombat, getActionOptions, performAction } from './combat';
import { applyStatus, statusModifiers, tickStatuses } from './status';
import type { StatusEffect } from './status';

describe('combat statuses', () => {
  it('stacks to a cap, refreshes duration and applies resistance to new effects', () => {
    const worn: StatusEffect[] = [{ kind: 'torn', turns: 1, stacks: 2 }];
    const refreshed = applyStatus(worn, 'torn');
    expect(refreshed).toEqual([{ kind: 'torn', turns: 3, stacks: 3 }]);
    expect(applyStatus(refreshed, 'torn')).toEqual(refreshed);
    expect(worn[0]).toEqual({ kind: 'torn', turns: 1, stacks: 2 });
    expect(applyStatus([], 'burning', { burning: 60 })).toEqual([{ kind: 'burning', turns: 1, stacks: 1 }]);
    expect(applyStatus(worn, 'stunned', { stunned: 100 })).toBe(worn);
  });

  it('applies burning and torn before tape, and soaked dampens fire', () => {
    const burning = applyStatus([], 'burning');
    const torn = applyStatus(burning, 'torn');
    const bandaged = applyStatus(torn, 'taped');
    const soaked = applyStatus(bandaged, 'soaked');
    expect(tickStatuses(bandaged, 10, 20).health).toBe(7);
    expect(tickStatuses(soaked, 10, 20).health).toBe(9);
    expect(tickStatuses(bandaged, 3, 20).health).toBe(0);
    expect(tickStatuses(applyStatus([], 'taped'), 19, 20).health).toBe(20);
    expect(statusModifiers(applyStatus(soaked, 'feared'))).toEqual({
      armourMultiplier: 0.8, movementMultiplier: 0.8, accuracyPenalty: 10,
    });
  });

  it('ticks damage exactly three recipient turns and emits health changes before turn changes', () => {
    let state = applyCombatStatus(createCombat(11), 'enemy', 'burning');
    const health = state.fighters.enemy.health;
    const changes: number[] = [];
    for (let i = 0; i < 7; i++) {
      const result = performAction(state, 'rest');
      expect(result.ok).toBe(true);
      for (const event of result.events) {
        if (event.type === 'status') {
          changes.push(event.healthDelta);
          expect(result.events.at(-1)).toEqual({ type: 'turn', fighter: 'enemy' });
        }
      }
      state = result.state;
    }
    expect(changes).toEqual([-4, -4, -4]);
    expect(state.fighters.enemy.health).toBe(health - 12);
    expect(state.fighters.enemy.statuses).toEqual([]);
  });

  it('skips one upcoming turn and does not spend energy or RNG for a stunned fighter', () => {
    const initial = createCombat(13);
    const stunned = applyCombatStatus(initial, 'player', 'stunned');
    const opponentTurn = performAction(stunned, 'rest').state;
    expect(opponentTurn.active).toBe('enemy');
    const result = performAction(opponentTurn, 'rest');
    expect(result.state.active).toBe('enemy');
    expect(result.state.rngState).toBe(initial.rngState);
    expect(result.state.fighters.player.energy).toBe(initial.fighters.player.energy);
    expect(result.events).toEqual([
      { type: 'rest', fighter: 'enemy', restored: 0 },
      { type: 'status', fighter: 'player', kind: 'stunned', healthDelta: 0, turnsRemaining: 0, skipped: true },
      { type: 'turn', fighter: 'enemy' },
    ]);
    expect(performAction(result.state, 'rest').state.active).toBe('player');
  });

  it('signals a status defeat before an action or tape could revive the recipient', () => {
    let state = createCombat(12, {}, { statusResistances: { feared: 100 } });
    expect(applyCombatStatus(state, 'enemy', 'feared')).toBe(state);
    state = applyCombatStatus(state, 'enemy', 'taped');
    state = applyCombatStatus(state, 'enemy', 'burning');
    state = { ...state, fighters: { ...state.fighters, enemy: { ...state.fighters.enemy, health: 3 } } };
    const result = performAction(state, 'rest');
    expect(result.state.winner).toBe('player');
    expect(result.state.fighters.enemy.health).toBe(0);
    expect(result.events.at(-1)).toEqual({ type: 'death', fighter: 'enemy', winner: 'player' });
  });

  it('keeps fear active during its final action, including in the displayed hit chance', () => {
    const initial = createCombat(11, { position: 9 }, { position: 10, statusResistances: { feared: 50 } });
    const threatened = applyCombatStatus(initial, 'enemy', 'feared');
    const enemy = performAction(threatened, 'rest').state;
    const chance = getActionOptions(enemy).find((option) => option.action === 'normal')?.hitChance;
    expect(chance).toBe(54);
    const attack = performAction(enemy, 'normal');
    expect(attack.events.find((event) => event.type === 'attack')).toMatchObject({ hitChance: chance });
    expect(attack.state.fighters.enemy.statuses).toEqual([]);
  });
});
