import { nemesisOpponent, rememberNemesis } from '../core/nemesis';
import type { NemesisMemory, NemesisOrigin } from '../core/nemesis';
import type { SavedCharacter } from '../core/save';
import type { CombatEvent, CombatState } from '../core/types';
import { shopLeague } from './shopRules';

/** What the arena needs to know about the opponent for the nemesis (#209): its memory when it is the nemesis. */
export interface RivalInfo {
  readonly name: string;
  readonly level?: number;
  readonly nemesis?: NemesisMemory;
}

export interface BoutNotice { readonly kicker: string; readonly title: string; readonly text: string }

/**
 * The career after a bout, as far as the nemesis goes: an opponent who beat the gladiator becomes (or stays) the
 * nemesis and comes back stronger; beating the nemesis ends the feud. `seed` makes a new nemesis's rematch look and
 * stats stable. Returns a notice for the player when something changed.
 */
export function afterBout(
  career: SavedCharacter, rival: RivalInfo, seed: number, fightId: string, state: CombatState, events: readonly CombatEvent[],
): { character: SavedCharacter; notice?: BoutNotice } {
  const origin: NemesisOrigin = rival.nemesis ?? {
    id: `rival-${rival.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    seed: seed >>> 0, level: Math.max(1, rival.level ?? career.level), league: shopLeague(career.level),
  };
  const before = career.nemesis;
  const after = rememberNemesis(before, origin, fightId, state, events);
  if (after === before) return { character: career };
  const character = { ...career };
  if (after) character.nemesis = after;
  else delete character.nemesis;
  if (!after && before) {
    return { character, notice: { kicker: 'Nemesis', title: `${before.name} is beaten`, text: 'The feud is over. The arena will remember it.' } };
  }
  if (after && after.id !== before?.id) {
    return { character, notice: { kicker: 'Nemesis', title: `${after.name} will be back`, text: 'Your new nemesis remembers how you fight.' } };
  }
  return { character, notice: after ? { kicker: 'Nemesis', title: `${after.name} grows stronger`, text: `Your feud: ${after.encounters} fights.` } : undefined };
}

/** The nemesis as an opponent for the pre-fight screen and the arena. */
export function nemesisRival(memory: NemesisMemory, playerLevel: number) {
  const enemy = nemesisOpponent(memory, playerLevel);
  return { ...enemy, nemesis: memory };
}

/** "Fought you twice · watches for your charges" */
export function nemesisLine(memory: NemesisMemory): string {
  const habit = memory.charges >= memory.heavyAttacks && memory.charges > 0 ? ' · watches for your charges'
    : memory.heavyAttacks > 0 ? ' · watches for your power attacks' : '';
  return `${memory.encounters === 1 ? 'Beat you once' : `Fought you ${memory.encounters} times`}${habit}`;
}
