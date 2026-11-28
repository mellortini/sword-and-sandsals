/**
 * The career's economy league by league (#163): how many wins it takes to level through a league, and after how many
 * of them the league's key gear (the full armour set of its top tier and a weapon of that tier) is paid for.
 *
 * Counted: the starting gold, the victory pay with the crowd's bonus (`victoryGold`, `crowdGoldReward`), healing at
 * the temple after every bout (`templeHealingQuote`'s price), selling the last league's key gear and its champion's
 * prize weapon at the shop's 30%, and that a loss pays nothing. The game has no entry fee (counted as 0).
 * Win rate, crowd bonus and wounds come from real bouts of the combat core and AI at each league's level and gear.
 */
import { chooseAction } from '../src/core/ai';
import { createCombat, performAction } from '../src/core/combat';
import { crowdGoldReward } from '../src/core/crowd';
import { LEAGUE_MAX_TIER } from '../src/core/leagues';
import type { League } from '../src/core/leagues';
import { experienceForLevel, fightExperience } from '../src/core/progression';
import { victoryGold } from '../src/core/rewards';
import { shopPrices } from '../src/core/shop';
import { ITEMS } from '../src/data/equipment';
import { PULPPORT_LEAGUES } from '../src/data/leagues';
import { weapon } from '../src/data/weapons';
import type { FighterSetup } from '../src/core/types';

export const STARTING_GOLD = 50;
export const ENTRY_FEE = 0;
const CHARM = 5;
const LEAGUES = Object.keys(LEAGUE_MAX_TIER) as League[];

/** what the temple charges to mend `missing` health (core/temple.ts) */
const healingPrice = (missing: number) => (missing > 0 ? 2 + Math.ceil(missing / 5) : 0);

/** the league's key gear at the shop: five armour pieces of its top tier and a sword of that tier */
export function keyGear(league: League): { tier: number; buy: number; resale: number } {
  const tier = LEAGUE_MAX_TIER[league];
  const pieces = ITEMS.filter((i) => i.tier === tier);
  const blade = weapon('sword', tier)!;
  const buy = [...pieces, blade].reduce((sum, item) => sum + shopPrices(item, CHARM).buy, 0);
  const resale = [...pieces, blade].reduce((sum, item) => sum + shopPrices(item, CHARM).sell, 0);
  return { tier, buy, resale };
}

/** a gladiator of `level` as the balance tools build one: attributes grow with the level, full gear of `tier` */
function gladiator(level: number, tier: number): FighterSetup {
  const growth = Math.floor((level - 1) / 4);
  const attributes = { might: 5 + growth, guard: 5 + growth, precision: 5 + growth, vitality: 5 + growth, stamina: 5 + growth };
  return { level, attributes, equipment: { helmet: tier, armor: tier, shoulders: tier, greaves: tier, boots: tier, weapon: `sword${tier}` } };
}

/** bouts of the gladiator (an aggressor) against equals of both profiles: wins, gold per win, healing per bout */
export function boutEconomy(level: number, tier: number, bouts = 200, gold = victoryGold) {
  let wins = 0, earned = 0, healing = 0;
  for (let i = 0; i < bouts; i++) {
    const seed = (Math.imul(i + 1, 0x9e3779b1) + level) >>> 0;
    let state = createCombat(seed, gladiator(level, tier), gladiator(level, tier));
    const profile = { player: 'aggressor', enemy: i % 2 ? 'aggressor' : 'defender' } as const;
    let rng = seed ^ 0x5bd1e995;
    for (let n = 0; n < 300 && state.winner === null; n++) {
      const choice = chooseAction(state, profile[state.active], rng);
      rng = choice.rngState;
      state = performAction(state, choice.action).state;
    }
    const me = state.fighters.player;
    if (state.winner === 'player') {
      wins++;
      earned += crowdGoldReward(gold(level), me.crowd);
    }
    healing += healingPrice(me.stats.maxHealth - me.health);
  }
  return { winRate: wins / bouts, goldPerWin: wins ? earned / wins : 0, healingPerBout: healing / bouts };
}

/** wins against opponents of the gladiator's own level that take it from `from` to `to` */
export function winsToLevel(from: number, to: number): number[] {
  const out: number[] = [];
  for (let level = from; level < to; level++) {
    const need = experienceForLevel(level + 1) - experienceForLevel(level);
    out.push(Math.ceil(need / fightExperience('player', level, level)));
  }
  return out;
}

export interface LeagueEconomy {
  league: League;
  levels: readonly [number, number];
  tier: number;
  keyGear: number;
  /** wins it takes to level from the league's first to its champion's level */
  leagueWins: number;
  /** wins after which the key gear is paid for (Infinity = not within the league) */
  winsToBuy: number;
  /** bouts (wins and losses) to the same point */
  boutsToBuy: number;
  goldPerWin: number;
  healingPerBout: number;
  winRate: number;
}

/**
 * The career league by league: gold carried over, earned at each level along the league and spent on its key gear
 * as soon as it is paid for. `gold` is the victory pay formula to try (the game's by default).
 */
export function careerEconomy(gold: (level: number) => number = victoryGold, bouts = 200): LeagueEconomy[] {
  let purse = STARTING_GOLD;
  let level = 1;
  let owned: League | undefined;
  const rows: LeagueEconomy[] = [];
  LEAGUES.forEach((league, index) => {
    const lineup = PULPPORT_LEAGUES[league];
    const top = Math.max(...lineup.map((b) => b.level));
    const gear = keyGear(league);
    if (index > 0) {
      // the last league's gear goes back to the shop (if it was bought), with its champion's prize
      const previous = LEAGUES[index - 1];
      if (owned === previous) purse += keyGear(previous).resale;
      const prize = PULPPORT_LEAGUES[previous].find((b) => b.champion)?.champion?.weapon;
      if (prize) purse += shopPrices(prize, CHARM).sell;
    }
    const steps = winsToLevel(level, top);
    const leagueWins = steps.reduce((s, n) => s + n, 0);
    let wins = 0, boutsSoFar = 0, winsToBuy = Infinity, boutsToBuy = Infinity;
    let sample = { winRate: 0, goldPerWin: 0, healingPerBout: 0 };
    for (let i = 0; i < Math.max(1, steps.length); i++) {
      const at = level + i;
      const b = boutEconomy(at, gear.tier, bouts, gold);
      sample = b;
      for (let w = 0; w < (steps[i] ?? 0); w++) {
        const tries = 1 / Math.max(0.05, b.winRate);
        purse += b.goldPerWin - tries * (b.healingPerBout + ENTRY_FEE);
        wins++;
        boutsSoFar += tries;
        if (winsToBuy === Infinity && purse >= gear.buy) {
          winsToBuy = wins;
          boutsToBuy = Math.round(boutsSoFar);
          purse -= gear.buy;
          owned = league;
        }
      }
    }
    if (winsToBuy === Infinity && purse >= gear.buy) { winsToBuy = wins; boutsToBuy = Math.round(boutsSoFar); purse -= gear.buy; owned = league; }
    rows.push({
      league, levels: [level, top], tier: gear.tier, keyGear: gear.buy, leagueWins, winsToBuy, boutsToBuy,
      goldPerWin: sample.goldPerWin, healingPerBout: sample.healingPerBout, winRate: sample.winRate,
    });
    level = top;
  });
  return rows;
}

/** What the starting purse buys at the first shops (#163): the tier-1 armour set, a tier-1 sword, both, a full heal. */
export function starterCheck() {
  const set = ITEMS.filter((i) => i.tier === 1).reduce((sum, item) => sum + shopPrices(item, CHARM).buy, 0);
  const sword = shopPrices(weapon('sword', 1)!, CHARM).buy;
  return { gold: STARTING_GOLD, set, sword, both: set + sword, affordsSet: STARTING_GOLD >= set, affordsBoth: STARTING_GOLD >= set + sword };
}
