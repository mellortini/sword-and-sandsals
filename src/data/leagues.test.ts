import { expect, it } from 'vitest';
import { chooseAction } from '../core/ai';
import { createCombat, performAction } from '../core/combat';
import { nextPulpportBronzeBout, PULPPORT_BRONZE, PULPPORT_CHAMPION_WEAPON, PULPPORT_LEAGUES } from './leagues';
import type { PulpportBout } from './leagues';
import { WEAPONS } from './weapons';

it('orders five challengers before the champion and completes the league after all six victories', () => {
  const defeated: string[] = [];
  expect(PULPPORT_BRONZE).toHaveLength(6);
  expect(new Set(PULPPORT_BRONZE.map(({ id }) => id)).size).toBe(6);
  for (const bout of PULPPORT_BRONZE) {
    expect(nextPulpportBronzeBout(defeated)).toBe(bout);
    expect(!!bout.champion).toBe(defeated.length === 5);
    const state = createCombat(1, {}, bout.setup);
    expect(state.fighters.enemy).toMatchObject({ name: bout.name, level: bout.level });
    defeated.push(bout.id);
  }
  expect(nextPulpportBronzeBout(defeated)).toBeUndefined();
});

it('gives the champion a line and a prize outside the regular weapon stock', () => {
  const champion = PULPPORT_BRONZE.at(-1)?.champion;
  expect(champion?.line).toBeTruthy();
  expect(champion?.weapon).toBe(PULPPORT_CHAMPION_WEAPON);
  expect(WEAPONS.some(({ id }) => id === champion?.weapon.id)).toBe(false);
});

function playBout(seed: number, player: PulpportBout, enemy: PulpportBout) {
  let state = createCombat(seed, player.setup, enemy.setup);
  const rng = { player: seed ^ 0x41835a0d, enemy: seed ^ 0x2c73ab8a };
  for (let actions = 0; actions < 300 && state.winner === null; actions++) {
    const side = state.active;
    const choice = chooseAction(state, side === 'player' ? player.profile : enemy.profile, rng[side]);
    rng[side] = choice.rngState;
    const result = performAction(state, choice.action);
    if (!result.ok) throw new Error('The simulator selected an unavailable action.');
    state = result.state;
  }
  return state.winner;
}

function winsOver(stronger: PulpportBout, challenger: PulpportBout): number {
  let wins = 0;
  for (let i = 0; i < 60; i++) {
    const seed = Math.imul(i + 1, 0x9e3779b1) >>> 0;
    const home = playBout(seed, stronger, challenger);
    const away = playBout(seed, challenger, stronger);
    expect(home).not.toBeNull();
    expect(away).not.toBeNull();
    wins += Number(home === 'player') + Number(away === 'enemy');
  }
  return wins;
}

it('provides five ordered rosters with distinct IDs, both profiles and unique champion rewards', () => {
  const leagues = Object.values(PULPPORT_LEAGUES);
  const bouts = leagues.flat();
  const champions = leagues.map((league) => league.at(-1)!);
  expect(leagues).toHaveLength(5);
  expect(bouts).toHaveLength(30);
  expect(new Set(bouts.map(({ id }) => id)).size).toBe(30);
  expect(new Set(bouts.map(({ name }) => name)).size).toBe(30);
  expect(new Set(champions.map((bout) => bout.champion?.weapon.id)).size).toBe(5);
  for (const league of leagues) {
    expect(new Set(league.map(({ profile }) => profile))).toEqual(new Set(['aggressor', 'defender']));
    expect(league.slice(0, -1).every(({ champion }) => !champion)).toBe(true);
    expect(league.at(-1)?.champion?.line).toBeTruthy();
    expect(league.every((bout, index) => !index || bout.level >= league[index - 1].level)).toBe(true);
  }
});

it('checks each new champion against a contender and the champion of the preceding league', () => {
  const rows = Object.entries(PULPPORT_LEAGUES);
  for (let i = 1; i < rows.length; i++) {
    const [league, bouts] = rows[i];
    const champion = bouts.at(-1)!;
    const contender = winsOver(champion, bouts.at(-2)!);
    const previousChampion = winsOver(champion, rows[i - 1][1].at(-1)!);
    expect(contender, `${league} champion against its last contender`).toBeGreaterThan(60);
    expect(previousChampion, `${league} champion against the previous champion`).toBeGreaterThan(60);
  }
});
