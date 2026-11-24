import { chooseAction } from '../core/ai';
import type { AiProfile } from '../core/ai';
import { getActionOptions, performAction } from '../core/combat';
import type { ActionOption, CombatAction, CombatEvent, CombatState, FighterSide } from '../core/types';

/** Decides one action for the side whose turn it is. Gets only the options the core allows right now. */
export type ActionPicker = (state: CombatState, options: readonly ActionOption[]) => Promise<CombatAction>;

export interface FightLoopOptions {
  /** who chooses for each side: the radial menu for the player (#12), the AI for the enemy */
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
    const action = await o.pickers[side](state, getActionOptions(state));
    if (o.signal?.aborted) break;
    const result = performAction(state, action);
    if (!result.ok) throw new Error(`The ${side} picked "${action}", which is not available (${result.reason}).`);
    events.push(...result.events);
    await o.present(result.events, result.state);
    state = result.state;
    if (state.winner === null && o.pause) await o.pause(state.active);
  }
  return { state, events, finished: state.winner !== null };
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
