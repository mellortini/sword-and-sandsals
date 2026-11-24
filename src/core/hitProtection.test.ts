import { expect, it } from 'vitest';
import { applyCombatStatus, createCombat, getActionOptions, performAction } from './combat';
import { protectedHitChance } from './hitProtection';

it('keeps the rate within three points of 55% and limits the dry streak in 10,000 actual attacks', () => {
  let state = createCombat(11, { position: 4 }, { position: 5, attributes: { vitality: 100_000 } });
  let hits = 0;
  let misses = 0;
  let longest = 0;
  for (let i = 0; i < 10_000; i++) {
    const fighters = { ...state.fighters, player: { ...state.fighters.player, energy: 40 } };
    const action = performAction({ ...state, active: 'player', fighters }, 'power');
    const strike = action.events.find((event) => event.type === 'attack');
    if (strike?.type !== 'attack') throw new Error('Expected a Power attack.');
    if (strike.hit) { hits++; misses = 0; }
    else { misses++; longest = Math.max(longest, misses); }
    state = action.state;
  }

  expect(hits / 100).toBeGreaterThanOrEqual(52);
  expect(hits / 100).toBeLessThanOrEqual(58);
  expect(longest).toBe(3);
});

it('uses one streak per fighter, shows the actual chance, and resets on a block', () => {
  const initial = createCombat(1, { position: 4 }, { position: 5 });
  const player = { ...initial.fighters.player, consecutiveMisses: 3 };
  const enemy = { ...initial.fighters.enemy, guarding: true, consecutiveMisses: 1 };
  const ready = { ...initial, fighters: { player, enemy } };
  expect(getActionOptions(ready).find(({ action }) => action === 'normal')?.hitChance).toBe(100);
  const result = performAction(ready, 'normal');
  expect(result.events).toContainEqual(expect.objectContaining({ type: 'attack', blocked: true, hitChance: 100 }));
  expect(result.state.fighters.player.consecutiveMisses).toBe(0);
  expect(result.state.fighters.enemy.consecutiveMisses).toBe(1);

  const afraid = applyCombatStatus(initial, 'player', 'feared');
  expect(getActionOptions(afraid).find(({ action }) => action === 'normal')?.hitChance).toBe(protectedHitChance(60, 0));
});
