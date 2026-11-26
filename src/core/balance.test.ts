import { expect, it } from 'vitest';
import { simulateBalance } from '../../tools/balance';

it('replays seeded mirrored scenarios and accounts for every bout', () => {
  const replay = simulateBalance(3);
  expect(simulateBalance(3)).toEqual(replay);
  for (const row of replay) {
    expect(row.kitPrice).toBeGreaterThan(0);
    for (const data of [row.profiles, row.armour]) {
      expect(data.wins + data.losses + data.timeouts).toBe(data.fights);
      expect(data.fights).toBe(6);
      expect(data.actionsPerFight).toBeGreaterThan(0);
    }
  }
});

it('prints the full 4,000-bout balance report', () => {
  const report = simulateBalance();
  console.log(JSON.stringify(report, null, 2));
  expect(report.reduce((sum, row) => sum + row.profiles.fights + row.armour.fights, 0)).toBe(4_000);
});
