import { describe, expect, it } from 'vitest';
import { resolveAttributes, deriveStats } from '../core/stats';
import { comparisonRows } from './statRows';
import type { ComparedFighter } from './statRows';

const fighter = (level: number, attributes = {}, equipment = {}): ComparedFighter => {
  const a = resolveAttributes(attributes);
  return { name: 'x', level, attributes: a, stats: deriveStats(a, equipment) };
};

describe('comparisonRows', () => {
  it('lists level, derived stats and all eight attributes', () => {
    const rows = comparisonRows(fighter(1), fighter(1));
    expect(rows.map((r) => r.label)).toEqual([
      'Level', 'Health', 'Energy', 'Armour', 'Weight',
      'Might', 'Agility', 'Precision', 'Guard', 'Vitality', 'Stamina', 'Charm', 'Arcana',
    ]);
    expect(rows.every((r) => r.edge === 'even')).toBe(true);
  });

  it('marks the higher value as better', () => {
    const rows = comparisonRows(fighter(3, { might: 9 }), fighter(5, { might: 4 }));
    const row = (label: string) => rows.find((r) => r.label === label)!;
    expect(row('Level')).toMatchObject({ player: '3', enemy: '5', edge: 'enemy' });
    expect(row('Might')).toMatchObject({ player: '9', enemy: '4', edge: 'player' });
  });

  it('treats lower weight as better and shows armour from equipment', () => {
    const rows = comparisonRows(fighter(1, {}, { armor: 8 }), fighter(1));
    const row = (label: string) => rows.find((r) => r.label === label)!;
    expect(row('Armour').edge).toBe('player');
    expect(row('Weight')).toMatchObject({ enemy: '0.0', edge: 'enemy' });
  });

  it('shows a wounded gladiator as health left / max and compares the health left', () => {
    const full = fighter(1);
    const wounded = { ...fighter(1), health: 30 };
    const row = comparisonRows(wounded, full).find((r) => r.label === 'Health')!;
    expect(row).toEqual({ label: 'Health', player: `30 / ${full.stats.maxHealth}`, enemy: String(full.stats.maxHealth), edge: 'enemy' });
  });
});
