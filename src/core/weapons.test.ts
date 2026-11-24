import { describe, expect, it } from 'vitest';
import { createCombat, getActionOptions, getDistance, performAction } from './combat';
import type { CombatEvent, FighterSetup } from './types';

const equipped = (weapon: string, gap = 1, enemy: FighterSetup = {}) =>
  createCombat(1, { position: 6, weapon }, { ...enemy, position: 6 + gap });

function attacks(events: CombatEvent[]) {
  return events.filter((event) => event.type === 'attack');
}

describe('weapon moves', () => {
  it('uses the equipped weapon from an inventory loadout', () => {
    const state = createCombat(1, { equipment: { weapon: 'spear3' }, position: 4 }, { position: 7 });
    expect(state.fighters.player.weapon?.id).toBe('spear3');
    expect(state.fighters.player.stats.attackPower).toBe(13);
    expect(getActionOptions(state).some((option) => option.action === 'normal')).toBe(true);
  });
  it('tears on a landed heavy axe attack and ticks immediately on the next turn', () => {
    const start = equipped('axe1');
    const result = performAction(start, 'power');
    const [attack] = attacks(result.events);
    expect(attack).toMatchObject({ hit: true });
    expect(result.events).toContainEqual(expect.objectContaining({ type: 'status', fighter: 'enemy', kind: 'torn', healthDelta: -2 }));
    expect(result.state.fighters.enemy.health).toBe(start.fighters.enemy.health - attack.damage - 2);
    expect(performAction(start, 'quick').state.fighters.enemy.statuses).toEqual([]);
  });

  it('crushes through armour and stuns with a heavy hammer blow', () => {
    const enemy = { equipment: { helmet: 8, armor: 8, shoulders: 8, greaves: 8, boots: 8 } };
    const hammer = performAction(equipped('hammer1', 1, enemy), 'power');
    const [attack] = attacks(hammer.events);
    const [samePower] = attacks(performAction(equipped('sword3', 1, enemy), 'power').events);
    expect(attack.damage).toBeGreaterThan(samePower.damage);
    expect(hammer.events).toContainEqual(expect.objectContaining({ type: 'status', kind: 'stunned', skipped: true }));
    expect(hammer.state.active).toBe('player');

    const resistant = performAction(equipped('hammer1', 1, { statusResistances: { stunned: 100 } }), 'power');
    expect(resistant.state.active).toBe('enemy');
  });

  it('uses spear reach and pushes the opponent away with Power', () => {
    const spear = equipped('spear1', 3);
    const sword = equipped('sword1', 3);
    expect(getActionOptions(spear).map((option) => option.action)).toContain('power');
    expect(performAction(sword, 'power').ok).toBe(false);
    const hit = performAction(spear, 'power');
    expect(hit.events).toContainEqual({ type: 'move', fighter: 'enemy', kind: 'knockback', from: 9, to: 10.6 });
    expect(getDistance(hit.state)).toBe(4.6);
  });

  it('rolls both dagger strikes for a single action and stops after a lethal first strike', () => {
    const start = equipped('daggers');
    const result = performAction(start, 'normal');
    const [attack] = attacks(result.events);
    expect(attack.strikes).toHaveLength(2);
    expect(attack.damage).toBe(attack.strikes?.reduce((total, strike) => total + strike.damage, 0));
    expect(result.state.fighters.player.energy).toBe(start.fighters.player.energy - 5);
    expect(result.state.active).toBe('enemy');
    const low = { ...start, fighters: { ...start.fighters, enemy: { ...start.fighters.enemy, health: 1 } } };
    const finished = performAction(low, 'normal');
    expect(finished.state.winner).toBe('player');
    expect(attacks(finished.events)[0].strikes).toHaveLength(1);
  });
});
