import { describe, expect, it } from 'vitest';
import { applyCombatStatus, counterChance, createCombat, getActionOptions, performAction } from './combat';
import type { CombatState } from './types';

function afterBlock(seed: number, guard: number, energy = 40): CombatState {
  const initial = createCombat(seed, { position: 4, attributes: { guard } }, { position: 6 });
  const start = { ...initial, fighters: { ...initial.fighters, player: { ...initial.fighters.player, energy } } };
  const defending = performAction(start, 'block').state;
  const blocked = performAction(defending, 'normal');
  expect(blocked.events).toContainEqual(expect.objectContaining({ type: 'attack', blocked: true }));
  return blocked.state;
}

describe('block counters', () => {
  it('starts at Guard 8, scales up and caps the chance after a successful block', () => {
    expect([7, 8, 12, 30].map(counterChance)).toEqual([0, 20, 40, 60]);
    expect(afterBlock(2, 7).fighters.player.counterReady).toBe(false);
    expect(afterBlock(1, 12).fighters.player.counterReady).toBe(false);
    expect(afterBlock(2, 12).fighters.player.counterReady).toBe(true);
  });

  it('offers a free Quick action in range even with no energy, and reports the counter', () => {
    const state = afterBlock(2, 12, 2);
    expect(state.fighters.player.energy).toBe(0);
    expect(getActionOptions(state)).toContainEqual(expect.objectContaining({ action: 'quick', energyCost: 0, counter: true }));
    const countered = performAction(state, 'quick');
    expect(countered.events).toContainEqual(expect.objectContaining({ type: 'attack', kind: 'quick', counter: true }));
    expect(countered.state.fighters.player.energy).toBe(0);
    expect(countered.state.fighters.player.counterReady).toBe(false);
    expect(state.fighters.player.counterReady).toBe(true);
  });

  it('expires when its owner takes a different action', () => {
    const state = afterBlock(2, 12);
    const rested = performAction(state, 'rest');
    expect(rested.state.fighters.player.counterReady).toBe(false);
    const next = performAction(rested.state, 'rest').state;
    expect(getActionOptions(next).find(({ action }) => action === 'quick')).toMatchObject({ energyCost: 3 });
  });
  it('expires if the opponent was blocked but a stun skips the opportunity', () => {
    const start = createCombat(2, { position: 4, attributes: { guard: 12 } }, { position: 6 });
    const defending = performAction(start, 'block').state;
    const stunned = applyCombatStatus(defending, 'player', 'stunned');
    const blocked = performAction(stunned, 'normal');
    expect(blocked.events).toContainEqual(expect.objectContaining({ type: 'attack', blocked: true }));
    expect(blocked.state.active).toBe('enemy');
    expect(blocked.state.fighters.player.counterReady).toBe(false);
  });
});
