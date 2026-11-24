import { describe, expect, it } from 'vitest';
import { ITEMS } from '../data/equipment';
import { equipmentLoadout, equipmentTotals, equipItem, unequipItem } from './inventory';
import type { Inventory } from './inventory';
import { deriveStats, resolveAttributes } from './stats';

const hero = { level: 10, might: 6 };

describe('inventory', () => {
  it('equips armour independently and swaps the old piece into the backpack', () => {
    const original: Inventory = { backpack: ['helmet2', 'armor3'], equipped: { helmet: 'helmet1' } };
    const first = equipItem(original, 'helmet2', hero);
    expect(first).toEqual({ ok: true, inventory: { backpack: ['helmet1', 'armor3'], equipped: { helmet: 'helmet2' } } });
    const second = equipItem(first.inventory, 'armor3', hero);
    expect(second.inventory).toEqual({ backpack: ['helmet1'], equipped: { helmet: 'helmet2', armor: 'armor3' } });
    expect(original).toEqual({ backpack: ['helmet2', 'armor3'], equipped: { helmet: 'helmet1' } });
  });

  it('requires an owned, known item and checks level and Might before changing anything', () => {
    const inventory: Inventory = { backpack: ['armor5', 'axe5', 'unknown'], equipped: {} };
    expect(equipItem(inventory, 'helmet2', hero)).toEqual({ ok: false, inventory, reason: 'not-owned' });
    expect(equipItem(inventory, 'unknown', hero)).toEqual({ ok: false, inventory, reason: 'unknown-item' });
    expect(equipItem(inventory, 'armor5', { ...hero, level: 8 })).toEqual({ ok: false, inventory, reason: 'level' });
    expect(equipItem(inventory, 'axe5', hero, 'offHand')).toEqual({ ok: false, inventory, reason: 'might' });
    expect(equipItem(inventory, 'axe5', { ...hero, level: 9, might: 7 }, 'offHand').ok).toBe(true);
  });

  it('supports both hands and returns one copy to the backpack on unequip', () => {
    const inventory: Inventory = { backpack: ['sword1', 'sword1'], equipped: {} };
    const main = equipItem(inventory, 'sword1', hero);
    const both = equipItem(main.inventory, 'sword1', hero, 'offHand');
    expect(both.inventory).toEqual({ backpack: [], equipped: { weapon: 'sword1', offHand: 'sword1' } });
    const removed = unequipItem(both.inventory, 'offHand');
    expect(removed.inventory).toEqual({ backpack: ['sword1'], equipped: { weapon: 'sword1' } });
    expect(unequipItem(removed.inventory, 'offHand')).toEqual({ ok: false, inventory: removed.inventory, reason: 'empty-slot' });
  });

  it('adds the full-set bonus only to matching five-piece armour and includes both hands in combat weight', () => {
    const pieces = ITEMS.filter((item) => item.tier === 5);
    const equipped = Object.fromEntries(pieces.map((item) => [item.slot, item.id]));
    const baseArmour = pieces.reduce((sum, item) => sum + item.armor, 0);
    const armourWeight = pieces.reduce((sum, item) => sum + item.weight, 0);
    const loadout = equipmentLoadout({ ...equipped, weapon: 'sword1', offHand: 'hammer1' });
    const expected = { fullSet: true, armour: Math.round(baseArmour * 1.1), weight: armourWeight + 3 };

    expect(equipmentTotals(loadout)).toEqual(expected);
    expect(deriveStats(resolveAttributes(), loadout)).toMatchObject({ armour: expected.armour, weight: expected.weight });
    expect(equipmentTotals({ ...loadout, helmet: 4 }).fullSet).toBe(false);
    expect(equipmentTotals({ ...loadout, helmet: 0 }).fullSet).toBe(false);
    expect(equipmentTotals({})).toEqual({ armour: 0, weight: 0, fullSet: false });
  });
});
