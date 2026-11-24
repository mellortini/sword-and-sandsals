import { describe, expect, it } from 'vitest';
import { item } from '../data/equipment';
import { createCombat, getAttackZoneOptions, performAction } from './combat';
import { armourByZone } from './hitZones';

describe('targeted attacks', () => {
  it('shows the chance for each target and applies the same value to the attack roll', () => {
    const close = createCombat(1, { position: 4 }, { position: 6 });
    const options = getAttackZoneOptions(close, 'normal');
    expect(options.map(({ zone, hitChance }) => [zone, hitChance])).toEqual([['head', 50], ['torso', 70], ['legs', 60]]);
    const aimed = performAction(close, options[0]);
    expect(aimed.events).toContainEqual(expect.objectContaining({ type: 'attack', zone: 'head', hitChance: 50 }));
    const far = createCombat(1);
    expect(getAttackZoneOptions(far, 'normal')).toEqual([]);
    expect(performAction(far, { action: 'normal', zone: 'head' })).toEqual({ ok: false, state: far, events: [], reason: 'unavailable' });
  });

  it('applies each piece to its zone and keeps the full set bonus', () => {
    const armour = (slot: Parameters<typeof item>[0]) => item(slot, 10)!.armor;
    expect(armourByZone({ helmet: 10, shoulders: 10, boots: 10 })).toEqual({
      head: armour('helmet'), torso: armour('shoulders'), legs: armour('boots'),
    });
    expect(armourByZone({ helmet: 10, armor: 10, shoulders: 10, greaves: 10, boots: 10 })).toEqual({
      head: Math.round(armour('helmet') * 1.1),
      torso: Math.round((armour('armor') + armour('shoulders')) * 1.1),
      legs: Math.round((armour('greaves') + armour('boots')) * 1.1),
    });
  });

  it('a helmet cushions a landed head hit without protecting the legs', () => {
    const state = createCombat(1, { position: 4, attributes: { might: 20 } }, { position: 5, equipment: { helmet: 10 } });
    const head = performAction(state, { action: 'normal', zone: 'head' });
    const legs = performAction(state, { action: 'normal', zone: 'legs' });
    expect(head.events).toContainEqual(expect.objectContaining({ type: 'attack', hit: true, damage: 17 }));
    expect(legs.events).toContainEqual(expect.objectContaining({ type: 'attack', hit: true, damage: 24 }));
  });

  it('stuns on a critical head hit and reduces movement after a landed leg hit', () => {
    const critical = createCombat(8, { position: 4, attributes: { precision: 35 } }, { position: 5 });
    const head = performAction(critical, { action: 'normal', zone: 'head' });
    expect(head.events).toContainEqual(expect.objectContaining({ type: 'status', kind: 'stunned', skipped: true }));
    expect(head.state.active).toBe('player');

    const close = createCombat(1, { position: 4 }, { position: 5 });
    const legs = performAction(close, { action: 'normal', zone: 'legs' });
    expect(legs.events).toContainEqual(expect.objectContaining({ type: 'status', kind: 'slowed', fighter: 'enemy' }));
    const backward = performAction(legs.state, 'step_back');
    expect(backward.state.fighters.enemy.position).toBe(6.2);
  });
});
