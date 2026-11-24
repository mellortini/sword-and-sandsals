import { describe, expect, it } from 'vitest';
import { createCombat, getActionOptions, performAction } from '../core/combat';
import type { CombatEvent } from '../core/types';
import { summarizeFight, summaryRows } from './fightSummary';

const attack = (actor: 'player' | 'enemy', o: Partial<Extract<CombatEvent, { type: 'attack' }>>): CombatEvent => ({
  type: 'attack', actor, target: actor === 'player' ? 'enemy' : 'player', kind: 'normal',
  hitChance: 70, hit: true, crit: false, blocked: false, damage: 0, ...o,
});

describe('summarizeFight', () => {
  it('counts hits, misses, crits, blocks and damage per side', () => {
    const events: CombatEvent[] = [
      { type: 'energy', fighter: 'player', from: 40, to: 34 },
      attack('player', { damage: 9 }),
      { type: 'turn', fighter: 'enemy' },
      attack('enemy', { hit: false }),
      { type: 'turn', fighter: 'player' },
      { type: 'block', fighter: 'player' },
      { type: 'turn', fighter: 'enemy' },
      attack('enemy', { blocked: true }),
      { type: 'turn', fighter: 'player' },
      attack('player', { crit: true, damage: 14 }),
      { type: 'crowd_gift', fighter: 'player', gift: 'coin', amount: 5 },
      { type: 'death', fighter: 'enemy', winner: 'player' },
    ];
    const s = summarizeFight(events);
    expect(s.winner).toBe('player');
    expect(s.rounds).toBe(3);
    expect(s.sides.player).toEqual({ actions: 3, attacks: 2, hits: 2, misses: 0, crits: 1, blocked: 0, damage: 23, bestHit: 14, gifts: 1 });
    expect(s.sides.enemy).toEqual({ actions: 2, attacks: 2, hits: 0, misses: 1, crits: 0, blocked: 1, damage: 0, bestHit: 0, gifts: 0 });
  });

  it('marks the better side of each row; fewer misses is better', () => {
    const rows = summaryRows(summarizeFight([
      attack('player', { damage: 5 }),
      { type: 'turn', fighter: 'enemy' },
      attack('enemy', { hit: false }),
    ]));
    const byLabel = Object.fromEntries(rows.map((r) => [r.label, r]));
    expect(byLabel['Damage dealt']).toMatchObject({ player: '5', enemy: '0', edge: 'player' });
    expect(byLabel['Misses']).toMatchObject({ player: '0', enemy: '1', edge: 'player' });
    expect(byLabel['Critical hits'].edge).toBe('even');
  });

  it('adds up to the health lost in a real core fight', () => {
    let state = createCombat(1234);
    const events: CombatEvent[] = [];
    for (let i = 0; i < 400 && state.winner === null; i++) {
      const options = getActionOptions(state);
      const pick = options.find((o) => o.hitChance !== undefined) ?? options[0];
      const result = performAction(state, pick.action);
      state = result.state;
      events.push(...result.events);
    }
    const s = summarizeFight(events);
    expect(s.winner).toBe(state.winner);
    expect(s.sides.player.damage).toBe(state.fighters.enemy.stats.maxHealth - state.fighters.enemy.health);
    expect(s.sides.enemy.damage).toBe(state.fighters.player.stats.maxHealth - state.fighters.player.health);
  });
});
