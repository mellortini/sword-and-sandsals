import { chooseAction } from '../core/ai';
import type { AiProfile } from '../core/ai';
import { chooseNemesisAction } from '../core/nemesis';
import type { NemesisMemory } from '../core/nemesis';
import { getActionOptions, getCombatSlotOptions, performAction } from '../core/combat';
import type { TargetedAttack } from '../core/hitZones';
import type { CombatSlotAction, CombatSlotOption } from '../core/spells';
import type { ActionOption, CombatAction, CombatEvent, CombatState, FighterSide } from '../core/types';

/**
 * Decides one action for the side whose turn it is. Gets only the options the core allows right now, and the items in
 * the fighter's combat slots (potions, spells; some may be `unavailable`). Answers with an action or a slot to use.
 */
export type ActionPicker = (
  state: CombatState, options: readonly ActionOption[], slots: readonly CombatSlotOption[],
) => Promise<CombatAction | CombatSlotAction | TargetedAttack>;

export interface FightLoopOptions {
  /** who chooses for each side: the action bar for the player (#147), the AI for the enemy */
  readonly pickers: Readonly<Record<FighterSide, ActionPicker>>;
  /** plays one action's events (CombatPresenter.present); the next choice waits until it resolves */
  readonly present: (events: readonly CombatEvent[], after: CombatState) => Promise<void>;
  /** breath between turns, e.g. ~0.5 s before the AI answers; gets the side that acts next */
  readonly pause?: (next: FighterSide) => Promise<void>;
  /** stops the fight after the current action (leaving the scene) */
  readonly signal?: AbortSignal;
}

export interface FightOutcome {
  readonly state: CombatState;
  /** every event of the fight in order, for summarizeFight */
  readonly events: readonly CombatEvent[];
  /** false when the fight was stopped by `signal` before anyone fell */
  readonly finished: boolean;
}

/**
 * Runs a fight turn by turn until someone falls: options → picker → performAction → present.
 * Choices are never asked for while an action is still being shown.
 */
export async function runFight(start: CombatState, o: FightLoopOptions): Promise<FightOutcome> {
  let state = start;
  const events: CombatEvent[] = [];
  while (state.winner === null && !o.signal?.aborted) {
    const side = state.active;
    const action = await o.pickers[side](state, getActionOptions(state), getCombatSlotOptions(state));
    if (o.signal?.aborted) break;
    const result = performAction(state, action);
    if (!result.ok) throw new Error(`The ${side} picked ${JSON.stringify(action)}, which is not available (${result.reason}).`);
    events.push(...result.events);
    await o.present(result.events, result.state);
    state = result.state;
    if (state.winner === null && o.pause) await o.pause(state.active);
  }
  return { state, events, finished: state.winner !== null };
}

/** The nemesis's AI (#209): a defender that guards more against the attacks it remembers. */
export function nemesisPicker(memory: NemesisMemory, seed: number): ActionPicker {
  let rng = seed >>> 0;
  return async (state) => {
    const decision = chooseNemesisAction(state, memory, rng);
    rng = decision.rngState;
    return decision.action;
  };
}

/** An ActionPicker backed by the enemy AI (#6) with its own random seed. */
export function aiPicker(profile: AiProfile, seed: number): ActionPicker {
  let rng = seed >>> 0;
  return async (state) => {
    const decision = chooseAction(state, profile, rng);
    rng = decision.rngState;
    return decision.action;
  };
}
