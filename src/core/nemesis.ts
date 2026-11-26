import { chooseAction } from './ai';
import type { AiDecision } from './ai';
import { getActionOptions } from './combat';
import { generateEnemy } from './enemies';
import type { GeneratedEnemy } from './enemies';
import type { League } from './leagues';
import { MAX_LEVEL } from './progression';
import type { CombatEvent, CombatState } from './types';

export interface NemesisOrigin {
  readonly id: string;
  readonly seed: number;
  readonly level: number;
  readonly league: League;
}

export interface NemesisMemory extends NemesisOrigin {
  readonly name: string;
  readonly encounters: number;
  readonly charges: number;
  readonly heavyAttacks: number;
  readonly lastFightId: string;
}

export function rememberNemesis(
  previous: NemesisMemory | undefined, origin: NemesisOrigin, fightId: string,
  state: CombatState, events: readonly CombatEvent[], spared = false,
): NemesisMemory | undefined {
  if (state.winner === null || !fightId.trim()) return previous;
  const sameRival = previous?.id === origin.id ? previous : undefined;
  if (sameRival?.lastFightId === fightId) return previous;
  if (state.winner === 'player' && !spared) return sameRival ? undefined : previous;

  let charges = sameRival?.charges ?? 0;
  let heavyAttacks = sameRival?.heavyAttacks ?? 0;
  for (const event of events) {
    if (event.type !== 'attack' || event.actor !== 'player') continue;
    if (event.kind === 'charge') charges = Math.min(20, charges + 1);
    if (event.kind === 'power') heavyAttacks = Math.min(20, heavyAttacks + 1);
  }
  return {
    ...origin, seed: origin.seed >>> 0, name: sameRival?.name ?? state.fighters.enemy.name,
    encounters: Math.min(20, (sameRival?.encounters ?? 0) + 1), charges, heavyAttacks, lastFightId: fightId,
  };
}

export function nemesisOpponent(memory: NemesisMemory, playerLevel: number): GeneratedEnemy {
  const growth = Math.min(5, memory.encounters);
  const level = Math.min(MAX_LEVEL, Math.max(playerLevel, memory.level) + growth);
  const opponent = generateEnemy(memory.seed, level, memory.league);
  const attributes = {
    ...opponent.attributes,
    might: opponent.attributes.might + growth,
    guard: opponent.attributes.guard + growth,
    vitality: opponent.attributes.vitality + growth,
  };
  return { ...opponent, level: Math.max(level, opponent.level), name: memory.name, attributes };
}

export function chooseNemesisAction(state: CombatState, memory: NemesisMemory, rngState: number): AiDecision {
  const enemyTurn = state.active === 'enemy';
  const opposingOptions = enemyTurn ? getActionOptions({ ...state, active: 'player' }) : [];
  const chargeThreat = opposingOptions.some(({ action }) => action === 'charge') ? Math.min(4, memory.charges) : 0;
  const powerThreat = opposingOptions.some(({ action }) => action === 'power') ? 0.5 * Math.min(4, memory.heavyAttacks) : 0;
  return chooseAction(state, 'defender', rngState, chargeThreat + powerThreat);
}
