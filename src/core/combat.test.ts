import { describe, expect, it } from 'vitest';
import { ARENA_LENGTH, createCombat, getActionOptions, getDistance, performAction } from './combat';
import type { CombatAction, CombatState, FighterSetup } from './types';

const atContact = (seed = 1, player: FighterSetup = {}, enemy: FighterSetup = {}) =>
  createCombat(seed, { ...player, position: 4 }, { ...enemy, position: 6 });

function play(state: CombatState, action: CombatAction) {
  const result = performAction(state, action);
  if (!result.ok) throw new Error(`Action ${action} was rejected: ${result.reason}`);
  return result;
}

describe('combat turns', () => {
  it('replays identical states and events for the same seed and actions', () => {
    const actions: CombatAction[] = ['normal', 'quick', 'block', 'power', 'taunt', 'normal', 'rest'];
    const fight = () => actions.reduce((rounds, action) => {
      rounds.push(play(rounds.at(-1)?.state ?? atContact(), action));
      return rounds;
    }, [] as ReturnType<typeof play>[]);

    const first = fight();
    expect(first).toEqual(fight());
    expect(first[0].state.rngState).not.toBe(1);
    expect(first[0].state.active).toBe('enemy');
    expect(first[1].state.active).toBe('player');
  });

  it('preserves the input state when applying a valid or invalid action', () => {
    const start = createCombat(1);
    expect(performAction(start, 'power')).toEqual({ ok: false, state: start, events: [], reason: 'unavailable' });

    const result = play(start, 'step_forward');
    expect(result.state.fighters.player.position).toBe(3.6);
    expect(result.state.fighters.player.energy).toBe(start.fighters.player.energy - 1);
    expect(result.state.rngState).toBe(start.rngState);
    expect(start.fighters.player.position).toBe(2);
    expect(start.fighters.player.energy).toBe(start.fighters.player.stats.maxEnergy);
  });

  it('caps health at zero and ends the fight on a lethal hit', () => {
    const start = atContact(1, { attributes: { might: 1_000, precision: 20 } });
    const result = play(start, 'power');
    expect(result.state.fighters.enemy.health).toBe(0);
    expect(result.state.winner).toBe('player');
    expect(result.events).toContainEqual(expect.objectContaining({ type: 'attack', damage: start.fighters.enemy.health }));
    expect(result.events.at(-1)).toEqual({ type: 'death', fighter: 'enemy', winner: 'player' });
    expect(getActionOptions(result.state)).toEqual([]);
    expect(performAction(result.state, 'rest')).toMatchObject({ ok: false, reason: 'finished', events: [] });
  });
});

describe('combat options', () => {
  it('respects the arena edges, action ranges, and contact', () => {
    const start = createCombat(1, { position: 0, attributes: { agility: 30 } }, { position: 3 });
    expect(getActionOptions(start).map(({ action }) => action)).toEqual([
      'step_forward', 'jump', 'charge', 'block', 'rest', 'taunt',
    ]);

    const landed = play(start, 'jump').state;
    expect(getDistance(landed)).toBe(0);
    expect(landed.fighters.player.position).toBe(3);
    expect(getActionOptions(landed).map(({ action }) => action)).not.toContain('step_forward');
    expect(getActionOptions(landed).map(({ action }) => action)).toContain('quick');

    const far = createCombat(1, { position: 0 }, { position: ARENA_LENGTH });
    expect(performAction(far, 'charge').ok).toBe(false);
    const enemyTurn = play(far, 'rest').state;
    expect(performAction(enemyTurn, 'step_back').ok).toBe(false);
  });

  it('charges into melee before dealing damage and caps knockback at the boundary', () => {
    const start = createCombat(1, { position: 13 }, { position: 19 });
    const result = play(start, 'charge');
    expect(result.events.map(({ type }) => type)).toEqual(['energy', 'move', 'attack', 'move', 'turn']);
    expect(result.events).toContainEqual({ type: 'move', fighter: 'player', kind: 'charge', from: 13, to: 18 });
    expect(result.events).toContainEqual({ type: 'move', fighter: 'enemy', kind: 'knockback', from: 19, to: 20 });
    expect(getDistance(result.state)).toBe(2);
  });

  it('limits attack chances to 5–95 percent and reports the rolled chance', () => {
    const boosted = atContact(1, { attributes: { precision: 100 } }, { attributes: { guard: 0 } });
    const reduced = atContact(1, { attributes: { precision: 0 } }, { attributes: { guard: 100 } });

    const chances = (state: CombatState) => getActionOptions(state).flatMap(({ hitChance }) =>
      hitChance === undefined ? [] : [hitChance],
    );
    expect(chances(boosted)).toEqual([95, 95, 95]);
    expect(chances(reduced)).toEqual([5, 5, 5]);
    expect(play(reduced, 'power').events).toContainEqual(expect.objectContaining({
      type: 'attack', kind: 'power', hitChance: 5, hit: false, damage: 0,
    }));
  });

  it('rejects actions without enough energy and restores energy without exceeding the cap', () => {
    let state = atContact(1, { attributes: { stamina: 0 } }, { attributes: { vitality: 50 } });
    for (const action of ['power', 'power', 'quick'] as const) {
      state = play(play(state, action).state, 'rest').state;
    }

    expect(state.fighters.player.energy).toBe(1);
    expect(performAction(state, 'block')).toMatchObject({ ok: false, reason: 'unavailable' });
    const recovered = play(state, 'rest');
    expect(recovered.state.fighters.player.energy).toBe(9);
    expect(recovered.events).toContainEqual({ type: 'rest', fighter: 'player', restored: 8 });

    const capped = play(atContact(), 'rest');
    expect(capped.state.fighters.player.energy).toBe(capped.state.fighters.player.stats.maxEnergy);
    expect(capped.events).toContainEqual({ type: 'rest', fighter: 'player', restored: 0 });
  });
});

describe('combat modifiers', () => {
  it('blocks a hit without damage and clears the stance before the defender acts', () => {
    const defended = play(atContact(), 'block').state;
    const result = play(defended, 'normal');
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'attack', hit: true, blocked: true, crit: false, damage: 0,
    }));
    expect(result.state.fighters.player.health).toBe(defended.fighters.player.health);
    expect(result.state.fighters.player.guarding).toBe(false);
  });

  it('applies the taunt penalty to the target for one turn', () => {
    const taunted = play(atContact(), 'taunt').state;
    const normal = getActionOptions(taunted).find(({ action }) => action === 'normal');
    expect(normal?.hitChance).toBe(60);
    expect(play(taunted, 'rest').state.fighters.enemy.tauntPenalty).toBe(0);
  });

  it('uses the item catalogue, set bonus, and armour mitigation', () => {
    const equipment = { helmet: 10, armor: 10, shoulders: 10, greaves: 10, boots: 10 };
    const player = { attributes: { might: 20 } };
    const unarmoured = atContact(1, player);
    const armoured = atContact(1, player, { equipment });

    expect(armoured.fighters.enemy.stats.armour).toBe(73);
    expect(play(unarmoured, 'normal').events).toContainEqual(expect.objectContaining({ type: 'attack', damage: 24 }));
    expect(play(armoured, 'normal').events).toContainEqual(expect.objectContaining({ type: 'attack', damage: 7 }));
  });

  it('increases damage on a critical hit', () => {
    const critical = play(atContact(8, { attributes: { precision: 35 } }), 'normal');
    expect(critical.events).toContainEqual(expect.objectContaining({ type: 'attack', crit: true, damage: 14 }));
  });
});
