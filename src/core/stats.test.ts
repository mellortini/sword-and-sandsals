import { describe, expect, it } from 'vitest';
import { createCombat, getActionOptions, performAction } from './combat';
import { attackDamage, attackHitChance, deriveStats, resolveAttributes } from './stats';

const stats = (overrides: Parameters<typeof resolveAttributes>[0] = {}) => deriveStats(resolveAttributes(overrides));

describe('derived stats', () => {
  it('preserves the baseline for a new fighter', () => {
    const defaults = stats();
    expect(defaults).toMatchObject({
      maxHealth: 70, maxEnergy: 40, attackPower: 9, blockChance: 45, criticalChance: 10,
      jumpDistance: 4, restRecovery: 13, tauntPenalty: 10, shopDiscount: 5, spellPower: 9,
    });
    expect(attackHitChance('normal', defaults, defaults, 0)).toBe(70);
  });

  it('derives fighter stats from all eight attributes', () => {
    const fighter = stats({ might: 8, agility: 8, precision: 9, guard: 7, vitality: 9, stamina: 10, charm: 12, arcana: 11 });
    expect(fighter).toMatchObject({
      maxHealth: 94, maxEnergy: 60, attackPower: 12, accuracyBonus: 37, evasionBonus: 37,
      blockChance: 53, criticalChance: 14, jumpDistance: 5.2, restRecovery: 18,
      tauntPenalty: 17, shopDiscount: 12, spellPower: 15,
    });
  });

  it('caps jump reach, block, crit, taunt and shop discount', () => {
    const boosted = stats({ agility: 100, precision: 100, guard: 100, charm: 100 });
    expect(boosted).toMatchObject({ jumpDistance: 6, blockChance: 80, criticalChance: 40, tauntPenalty: 20, shopDiscount: 25 });
    expect(attackHitChance('normal', boosted, stats(), 0)).toBe(95);
    expect(attackHitChance('normal', stats(), boosted, 0)).toBe(5);
  });

  it('uses the same damage formula with or without a critical hit', () => {
    const attacker = stats({ might: 20 });
    const defender = { ...stats(), armour: 30 };
    expect(attackDamage('normal', attacker, defender)).toBe(12);
    expect(attackDamage('normal', attacker, defender, true)).toBe(18);
    expect(attackDamage('quick', stats(), { ...defender, armour: 10_000 })).toBe(1);
  });

  it('applies agility to the chance shown and resolved by combat', () => {
    const state = createCombat(1, { position: 4 }, { position: 6, attributes: { agility: 10 } });
    const option = getActionOptions(state).find(({ action }) => action === 'normal');
    const result = performAction(state, 'normal');
    expect(option?.hitChance).toBe(60);
    expect(result.events).toContainEqual(expect.objectContaining({ type: 'attack', hitChance: 60 }));
  });
});
