import type { CombatEvent, FighterSide } from '../core/types';
import type { Edge, StatRow } from './statRows';

/** What one side did during a fight, counted from the core's events. */
export interface SideTotals {
  /** actions taken (attacks, moves, blocks, rests, taunts) */
  actions: number;
  attacks: number;
  hits: number;
  misses: number;
  crits: number;
  /** this side's hits that the opponent's guard stopped */
  blocked: number;
  damage: number;
  bestHit: number;
  /** bouquets and coins the crowd threw to this side (#51) */
  gifts: number;
}

export interface FightSummary {
  winner: FighterSide | null;
  /** a round is one action of each side; the side that opens the fight starts every round */
  rounds: number;
  sides: Record<FighterSide, SideTotals>;
}

const empty = (): SideTotals => ({ actions: 0, attacks: 0, hits: 0, misses: 0, crits: 0, blocked: 0, damage: 0, bestHit: 0, gifts: 0 });

/**
 * Totals for the result screen from every event `performAction` returned, in order.
 * `first` is the side that acted first (`createCombat` starts with the player).
 */
export function summarizeFight(events: readonly CombatEvent[], first: FighterSide = 'player'): FightSummary {
  const sides: Record<FighterSide, SideTotals> = { player: empty(), enemy: empty() };
  let winner: FighterSide | null = null;
  let active = first;
  let acted = false;

  for (const e of events) {
    if (!acted && e.type !== 'turn') {
      sides[active].actions++;
      acted = true;
    }
    switch (e.type) {
      case 'turn':
        active = e.fighter;
        acted = false;
        break;
      case 'attack': {
        const s = sides[e.actor];
        s.attacks++;
        if (!e.hit) s.misses++;
        else if (e.blocked) s.blocked++;
        else s.hits++;
        if (e.crit) s.crits++;
        s.damage += e.damage;
        s.bestHit = Math.max(s.bestHit, e.damage);
        break;
      }
      case 'crowd_gift':
        sides[e.fighter].gifts++;
        break;
      case 'death':
        winner = e.winner;
        break;
    }
  }

  return { winner, rounds: sides[first].actions, sides };
}

interface RowSpec {
  label: string;
  value: (s: SideTotals) => number;
  lowerIsBetter?: boolean;
}

const ROWS: RowSpec[] = [
  { label: 'Damage dealt', value: (s) => s.damage },
  { label: 'Best hit', value: (s) => s.bestHit },
  { label: 'Hits', value: (s) => s.hits },
  { label: 'Misses', value: (s) => s.misses, lowerIsBetter: true },
  { label: 'Critical hits', value: (s) => s.crits },
  { label: 'Blocked by foe', value: (s) => s.blocked, lowerIsBetter: true },
  { label: 'Crowd gifts', value: (s) => s.gifts },
];

/** Rows for `StatPanel`: player on the left, enemy on the right, the better number in gold. */
export function summaryRows(summary: FightSummary): StatRow[] {
  return ROWS.map(({ label, value, lowerIsBetter }) => {
    const a = value(summary.sides.player);
    const b = value(summary.sides.enemy);
    const edge: Edge = a === b ? 'even' : (lowerIsBetter ? a < b : a > b) ? 'player' : 'enemy';
    return { label, player: String(a), enemy: String(b), edge };
  });
}
