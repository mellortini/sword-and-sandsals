import { describe, expect, it } from 'vitest';
import { createCombat, getCombatSlotOptions, performAction } from './combat';
import type { CombatSlots } from './spells';

const slots: CombatSlots = [
  { id: 'ember' },
  { id: 'drench' },
  { id: 'glue-tonic', quantity: 2 },
  { id: 'repair-tape', quantity: 1 },
];

describe('combat slots', () => {
  it('shows four items with their costs and legal targets', () => {
    const start = createCombat(2, { slots });
    expect(getCombatSlotOptions(start).map(({ slot, energyCost, target }) => [slot, energyCost, target])).toEqual([
      [0, 8, 'enemy'], [1, 5, 'enemy'], [2, 2, 'player'], [3, 2, 'player'],
    ]);
    expect(getCombatSlotOptions(createCombat(2))).toEqual([]);
  });

  it('rejects wrong targets, empty slots and insufficient Arcana or energy without changing the turn', () => {
    const start = createCombat(2, { slots, attributes: { arcana: 3 } });
    expect(getCombatSlotOptions(start)[0]).toMatchObject({ unavailable: 'arcana' });
    expect(performAction(start, { slot: 0, target: 'enemy' })).toEqual({ ok: false, state: start, events: [], reason: 'unavailable' });
    expect(performAction(start, { slot: 1, target: 'player' }).ok).toBe(false);
    expect(performAction(start, { slot: 4, target: 'enemy' }).ok).toBe(false);
    const player = { ...start.fighters.player, energy: 0 };
    const tired = { ...start, fighters: { ...start.fighters, player } };
    expect(getCombatSlotOptions(tired)[2]).toMatchObject({ unavailable: 'energy' });
    expect(performAction(tired, { slot: 2, target: 'player' }).ok).toBe(false);
  });

  it('spends energy for a spell, applies its power and a status, and keeps the spell slotted', () => {
    const start = createCombat(2, { slots, attributes: { arcana: 4 } });
    const cast = performAction(start, { slot: 0, target: 'enemy' });
    expect(cast.events).toContainEqual({ type: 'slot', actor: 'player', target: 'enemy', slot: 0, item: 'ember', healthDelta: -8 });
    expect(cast.events).toContainEqual(expect.objectContaining({ type: 'status', kind: 'burning', healthDelta: -4 }));
    expect(cast.state.fighters.player.energy).toBe(start.fighters.player.energy - 8);
    expect(cast.state.fighters.player.attributes.arcana).toBe(4);
    expect(cast.state.fighters.player.slots[0]).toEqual({ id: 'ember' });
    expect(cast.state.active).toBe('enemy');
    expect(cast.state.rngState).toBe(start.rngState);
  });

  it('consumes one potion per use, caps healing and removes an empty stack', () => {
    const initial = createCombat(2, { slots });
    const player = { ...initial.fighters.player, health: initial.fighters.player.stats.maxHealth - 5 };
    const start = { ...initial, fighters: { ...initial.fighters, player } };
    const first = performAction(start, { slot: 2, target: 'player' });
    expect(first.events).toContainEqual({ type: 'slot', actor: 'player', target: 'player', slot: 2, item: 'glue-tonic', healthDelta: 5 });
    expect(first.state.fighters.player.slots[2]).toEqual({ id: 'glue-tonic', quantity: 1 });
    const again = performAction(first.state, 'rest').state;
    const second = performAction(again, { slot: 2, target: 'player' });
    expect(second.state.fighters.player.slots[2]).toBeNull();
    expect(start.fighters.player.slots[2]).toEqual({ id: 'glue-tonic', quantity: 2 });
    const gotTurn = performAction(second.state, 'rest').state;
    expect(performAction(gotTurn, { slot: 2, target: 'player' }).ok).toBe(false);
  });

  it('applies tape on the caster’s next turn and ends the fight if a slot effect is lethal', () => {
    const initial = createCombat(2, { slots });
    const player = { ...initial.fighters.player, health: 30 };
    const enemy = { ...initial.fighters.enemy, health: 1 };
    const start = { ...initial, fighters: { player, enemy } };
    const taped = performAction(start, { slot: 3, target: 'player' });
    expect(taped.state.fighters.player.health).toBe(30);
    const ticked = performAction(taped.state, 'rest');
    expect(ticked.state.fighters.player.health).toBe(33);
    const lethal = performAction(ticked.state, { slot: 0, target: 'enemy' });
    expect(lethal.state.winner).toBe('player');
    expect(lethal.events.at(-1)).toEqual({ type: 'death', fighter: 'enemy', winner: 'player' });
    expect(getCombatSlotOptions(lethal.state)).toEqual([]);
  });
});
