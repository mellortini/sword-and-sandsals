import { expect, it } from 'vitest';
import { careerEconomy, starterCheck } from '../../tools/economy';

// #163: the target curve. A league's key gear (its top armour set and a sword of that tier) is paid for within the wins
// it takes to level through the league: about half to two thirds of them, the short Bronze league by its end.
it('keeps every league’s key gear within reach of its own wins', () => {
  const rows = careerEconomy(undefined, 60);
  expect(rows.map((r) => r.league)).toEqual(['bronze', 'silver', 'gold', 'champion', 'legend']);
  for (const r of rows) {
    const share = r.winsToBuy / r.leagueWins;
    expect(share, r.league).toBeLessThanOrEqual(1);
    if (r.league !== 'bronze') expect(share, r.league).toBeGreaterThanOrEqual(0.3);
  }
}, 120_000);

it('lets a new gladiator buy the first armour set with the starting gold', () => {
  expect(starterCheck().affordsSet).toBe(true);
});
