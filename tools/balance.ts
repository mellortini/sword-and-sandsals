import { chooseAction } from '../src/core/ai';
import type { AiProfile } from '../src/core/ai';
import { createCombat, performAction } from '../src/core/combat';
import { crowdGoldReward } from '../src/core/crowd';
import type { League } from '../src/core/leagues';
import { getShopStock, shopPrices } from '../src/core/shop';
import type { Fighter, FighterSetup, FighterStats } from '../src/core/types';

const SCENARIOS: ReadonlyArray<{ level: number; tier: number; league: League; victoryGold: number }> = [
  { level: 1, tier: 1, league: 'bronze', victoryGold: 20 },
  { level: 5, tier: 3, league: 'silver', victoryGold: 40 },
  { level: 12, tier: 6, league: 'gold', victoryGold: 75 },
  { level: 25, tier: 9, league: 'legend', victoryGold: 140 },
];

const MAX_ACTIONS = 300;
const SIDES = ['player', 'enemy'] as const;

export interface Contender {
  readonly setup: FighterSetup;
  readonly profile: AiProfile;
  readonly statsOverride?: Partial<Pick<FighterStats, 'armour' | 'weight'>>;
}

function withControlledStats(fighter: Readonly<Fighter>, contender: Contender): Readonly<Fighter> {
  return contender.statsOverride ? { ...fighter, stats: { ...fighter.stats, ...contender.statsOverride } } : fighter;
}

function duel(seed: number, player: Contender, enemy: Contender) {
  let state = createCombat(seed, player.setup, enemy.setup);
  if (player.statsOverride || enemy.statsOverride) {
    state = { ...state, fighters: {
      player: withControlledStats(state.fighters.player, player),
      enemy: withControlledStats(state.fighters.enemy, enemy),
    } };
  }
  const ai = { player: (seed ^ 0x41835a0d) >>> 0, enemy: (seed ^ 0x2c73ab8a) >>> 0 };
  let actions = 0;
  while (state.winner === null && actions < MAX_ACTIONS) {
    const side = state.active;
    const choice = chooseAction(state, side === 'player' ? player.profile : enemy.profile, ai[side]);
    ai[side] = choice.rngState;
    const result = performAction(state, choice.action);
    if (!result.ok) throw new Error(`AI chose unavailable action ${choice.action}`);
    state = result.state;
    actions++;
  }
  return { state, actions };
}

export function compareContenders(a: Contender, b: Contender, pairs: number, victoryGold = 0) {
  let wins = 0;
  let losses = 0;
  let timeouts = 0;
  let actions = 0;
  let gold = 0;
  let winningGold = 0;

  for (let run = 0; run < pairs; run++) {
    const seed = (Math.imul(run + 1, 0x9e3779b1) + 152) >>> 0;
    for (const seat of SIDES) {
      const { state, actions: duration } = seat === 'player' ? duel(seed, a, b) : duel(seed, b, a);
      actions += duration;
      const won = state.winner === seat;
      const payout = crowdGoldReward(won ? victoryGold : 0, state.fighters[seat].crowd);
      gold += payout;
      if (state.winner === null) timeouts++;
      else if (won) { wins++; winningGold += payout; }
      else losses++;
    }
  }

  const fights = 2 * pairs;
  return { fights, wins, losses, timeouts, actionsPerFight: actions / fights, goldPerFight: gold / fights, goldPerWin: wins ? winningGold / wins : 0 };
}

export function simulateBalance(pairs = 250) {
  if (!Number.isSafeInteger(pairs) || pairs < 1) throw new RangeError('Expected at least one mirrored pair.');
  return SCENARIOS.map(({ level, tier, league, victoryGold }) => {
    const growth = Math.floor((level - 1) / 4);
    const attributes = { might: 5 + growth, guard: 5 + growth, precision: 5 + growth, vitality: 5 + growth, stamina: 5 + growth };
    const equipment = { helmet: tier, armor: tier, shoulders: tier, greaves: tier, boots: tier, weapon: `sword${tier}` };
    const setup = { level, attributes, equipment };
    const light = { level, attributes, equipment: { weapon: equipment.weapon } };
    const cost = getShopStock('armourer', league).filter((item) => item.tier === tier)
      .reduce((total, item) => total + shopPrices(item, 5).buy, 0);
    const sword = getShopStock('weaponsmith', league).find((item) => item.id === equipment.weapon);
    if (!sword) throw new Error(`Missing ${equipment.weapon} in ${league} stock`);
    const kitPrice = cost + shopPrices(sword, 5).buy;

    return {
      level, tier, league, victoryGold, kitPrice,
      profiles: compareContenders({ setup, profile: 'aggressor' }, { setup, profile: 'defender' }, pairs, victoryGold),
      armour: compareContenders({ setup, profile: 'aggressor' }, { setup: light, profile: 'aggressor' }, pairs, victoryGold),
    };
  });
}
