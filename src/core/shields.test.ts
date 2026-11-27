import { describe, expect, it } from 'vitest';
import { SHIELDS, findShield } from '../data/shields';
import { createCombat, performAction } from './combat';
import { equipItem, equipmentTotals } from './inventory';
import { getShopStock } from './shop';
import { shieldDamage } from './stats';
import type { CombatEvent, CombatState, FighterSetup } from './types';

type AttackEvent = Extract<CombatEvent, { type: 'attack' }>;

const atContact = (seed: number, player: FighterSetup = {}, enemy: FighterSetup = {}) =>
  createCombat(seed, { ...player, position: 4 }, { ...enemy, position: 6 });

/** the player blocks and the enemy answers with a normal blow; the first seed whose blow is blocked */
function blockedBlow(player: FighterSetup, patch?: (state: CombatState) => CombatState) {
  for (let seed = 1; seed < 200; seed++) {
    let state = atContact(seed, player);
    if (patch) state = patch(state);
    const guarded = performAction(state, 'block');
    if (!guarded.ok) throw new Error('block rejected');
    const blow = performAction(guarded.state, 'normal');
    if (!blow.ok) throw new Error('blow rejected');
    const attack = blow.events.find((e): e is AttackEvent => e.type === 'attack')!;
    if (attack.blocked) return { before: guarded.state, after: blow.state, attack };
  }
  throw new Error('no blocked blow in 200 seeds');
}

describe('shield catalogue (#273)', () => {
  it('has ten tiers that grow in health, price and level', () => {
    expect(SHIELDS.map((s) => s.id)).toEqual(Array.from({ length: 10 }, (_, i) => `shield${i + 1}`));
    for (let i = 1; i < SHIELDS.length; i++) {
      expect(SHIELDS[i].health).toBeGreaterThan(SHIELDS[i - 1].health);
      expect(SHIELDS[i].price).toBeGreaterThan(SHIELDS[i - 1].price);
      expect(SHIELDS[i].minLevel).toBeGreaterThanOrEqual(SHIELDS[i - 1].minLevel);
    }
  });

  it('is sold by the armourer, by league', () => {
    expect(getShopStock('armourer', 'bronze').map((i) => i.id)).toContain('shield1');
    expect(getShopStock('armourer', 'bronze').map((i) => i.id)).not.toContain('shield10');
    expect(getShopStock('weaponsmith', 'legend').map((i) => i.id)).not.toContain('shield1');
  });
});

describe('shield in the inventory (#273)', () => {
  it('always goes on the off hand and adds its weight', () => {
    const result = equipItem({ backpack: ['shield2'], equipped: { weapon: 'sword2' } }, 'shield2', { level: 30, might: 0 });
    expect(result).toMatchObject({ ok: true, inventory: { backpack: [], equipped: { weapon: 'sword2', offHand: 'shield2' } } });
    const bare = equipmentTotals({ weapon: 'sword2' });
    expect(equipmentTotals({ weapon: 'sword2', offHand: 'shield2' }).weight).toBe(bare.weight + findShield('shield2')!.weight);
  });

  it('waits for the level of its tier', () => {
    expect(equipItem({ backpack: ['shield10'], equipped: {} }, 'shield10', { level: 1, might: 0 }))
      .toMatchObject({ ok: false, reason: 'level' });
  });
});

describe('shield in combat (#273)', () => {
  it('comes to the bout whole, but not with a two-handed weapon', () => {
    const state = createCombat(1, { equipment: { offHand: 'shield3' } });
    expect(state.fighters.player.shield).toEqual({ id: 'shield3', tier: 3, health: 42, maxHealth: 42 });
    expect(createCombat(1, { equipment: { weapon: 'sword3', offHand: 'shield3' } }).fighters.player.shield).toBeDefined();
    expect(createCombat(1, { equipment: { weapon: 'spear3', offHand: 'shield3' } }).fighters.player.shield).toBeUndefined();
    expect(createCombat(1, { equipment: { weapon: 'hammer3', offHand: 'shield3' } }).fighters.player.shield).toBeUndefined();
    // a dagger is one-handed: the shield goes in the other hand
    expect(createCombat(1, { weapon: 'daggers', equipment: { offHand: 'shield3' } }).fighters.player.shield).toBeDefined();
    expect(createCombat(1, { equipment: { offHand: 'sword1' } }).fighters.player.shield).toBeUndefined();
  });

  it('takes the blocked blow off its own health, not the fighter', () => {
    const { before, after, attack } = blockedBlow({ equipment: { offHand: 'shield1' } });
    const lost = shieldDamage('normal', before.fighters.enemy.stats);
    expect(attack).toMatchObject({ damage: 0, shield: { from: 24, to: 24 - lost } });
    expect(after.fighters.player.health).toBe(before.fighters.player.health);
    expect(after.fighters.player.shield?.health).toBe(24 - lost);
    // the state that went in is not changed
    expect(before.fighters.player.shield?.health).toBe(24);
  });

  it('grows with the attacker\'s strength', () => {
    const weak = shieldDamage('normal', { attackPower: 6 } as never);
    expect(shieldDamage('normal', { attackPower: 20 } as never)).toBeGreaterThan(weak);
    expect(shieldDamage('power', { attackPower: 6 } as never)).toBeGreaterThan(weak);
    expect(shieldDamage('quick', { attackPower: 1 } as never)).toBe(1);
  });

  it('breaks at 0 and then blocks no more for the rest of the bout', () => {
    const nearlyBroken = (state: CombatState): CombatState => {
      const player = state.fighters.player;
      return { ...state, fighters: { ...state.fighters, player: { ...player, shield: { ...player.shield!, health: 1 } } } };
    };
    const breaking = blockedBlow({ equipment: { offHand: 'shield1' } }, nearlyBroken);
    expect(breaking.attack.shield).toEqual({ from: 1, to: 0 });
    expect(breaking.attack.damage).toBe(0);
    expect(breaking.after.fighters.player.shield?.health).toBe(0);

    const broken = (state: CombatState): CombatState => {
      const player = state.fighters.player;
      return { ...state, fighters: { ...state.fighters, player: { ...player, shield: { ...player.shield!, health: 0 } } } };
    };
    const later = blockedBlow({ equipment: { offHand: 'shield1' } }, broken);
    expect(later.attack.blocked).toBe(true);
    expect(later.attack.shield).toBeUndefined();
    expect(later.after.fighters.player.shield?.health).toBe(0);
  });

  it('leaves a bout without a shield exactly as before', () => {
    const { attack } = blockedBlow({});
    expect(attack.shield).toBeUndefined();
    expect(attack.damage).toBe(0);
  });
});
