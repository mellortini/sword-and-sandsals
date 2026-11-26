import { expect, it } from 'vitest';
import { simulateArmourBalance } from '../../tools/armourBalance';

it('isolates the armour set bonus and records every mirrored matchup', () => {
  const report = simulateArmourBalance(4);
  expect(simulateArmourBalance(4)).toEqual(report);
  expect(report).toHaveLength(6);
  for (const row of report) {
    expect(row.protection.higher.armour).toBeGreaterThan(row.protection.baseArmour);
    expect(row.protection.mixed.fullSet).toBe(false);
    for (const data of [row.adjacent, row.mixed, row.setBonus, row.weightOnly]) {
      expect(data.wins + data.losses + data.timeouts).toBe(data.fights);
      expect(data.fights).toBe(8);
    }
    expect(row.weightOnly.wins).toBe(row.weightOnly.losses);
  }
});

it('prints the full 12,000-bout report for adjacent and mixed armour', () => {
  const report = simulateArmourBalance();
  console.log(JSON.stringify(report, null, 2));
  expect(report.reduce((sum, row) => sum + row.adjacent.fights + row.mixed.fights + row.setBonus.fights + row.weightOnly.fights, 0)).toBe(12_000);
});
