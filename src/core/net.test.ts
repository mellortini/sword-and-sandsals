import { describe, expect, it } from 'vitest';
import { chooseAction } from './ai';
import { NET_RANGE, createCombat, getActionOptions, netHitChance, performAction } from './combat';
import { leavesHandForShield, combatWeapon } from './weapons';
import type { CombatState, FighterSetup } from './types';

const retiarius: FighterSetup = { weapon: 'trident3' };
const at = (gap: number, player: FighterSetup = retiarius, enemy: FighterSetup = {}, seed = 1) =>
  createCombat(seed, { ...player, position: 4 }, { ...enemy, position: 4 + gap });

const netOption = (state: CombatState) => getActionOptions(state).find((o) => o.action === 'net');

/** first seed whose throw lands (or misses) */
function throwWith(hit: boolean, player: FighterSetup = retiarius) {
  for (let seed = 1; seed < 200; seed++) {
    const result = performAction(at(2, player, {}, seed * 2654435761 % 2 ** 31), 'net');
    if (!result.ok) throw new Error('net rejected');
    if (result.events.some((e) => e.type === 'net' && e.hit === hit)) return result;
  }
  throw new Error('no such seed');
}

describe('trident and net (#258)', () => {
  it('a trident comes with one net; other weapons have none', () => {
    expect(at(2).fighters.player.net).toBe(true);
    expect(at(2, { weapon: 'spear3' }).fighters.player.net).toBeUndefined();
    expect(netOption(at(2, { weapon: 'sword3' }))).toBeUndefined();
    expect(leavesHandForShield(combatWeapon('trident3'))).toBe(false);
  });

  it('flies up to NET_RANGE and its chance grows with Agility over the target', () => {
    expect(netOption(at(NET_RANGE))).toMatchObject({ action: 'net', energyCost: 6, hitChance: 60 });
    expect(netOption(at(NET_RANGE + 1))).toBeUndefined();
    const nimble = at(2, { ...retiarius, attributes: { agility: 8 } }, { attributes: { agility: 5 } });
    expect(netHitChance(nimble.fighters.player, nimble.fighters.enemy)).toBe(72);
    expect(netOption(nimble)?.hitChance).toBe(72);
  });

  it('a caught opponent loses the next turn; the net is gone either way', () => {
    const caught = throwWith(true);
    const kinds = caught.events.map((e) => e.type);
    expect(kinds).toContain('net');
    expect(caught.events).toContainEqual(expect.objectContaining({ type: 'status', fighter: 'enemy', kind: 'netted', skipped: true }));
    // the enemy's turn was spent getting out: the player acts again, the net is gone and so is the status
    expect(caught.state.active).toBe('player');
    expect(caught.state.fighters.player.net).toBe(false);
    expect(caught.state.fighters.enemy.statuses).toEqual([]);
    expect(netOption(caught.state)).toBeUndefined();

    const missed = throwWith(false);
    expect(missed.state.active).toBe('enemy');
    expect(missed.state.fighters.player.net).toBe(false);
  });

  it('the AI throws the net now and then', () => {
    let state = at(2, {}, retiarius);
    state = performAction(state, 'rest').state;   // the enemy (the retiarius) is to move
    const picks = new Set<string>();
    for (let r = 1; r < 400; r++) picks.add(chooseAction(state, 'defender', r * 2654435761 % 2 ** 31).action);
    expect(picks.has('net')).toBe(true);
  });
});
