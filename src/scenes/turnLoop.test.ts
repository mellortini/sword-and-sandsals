import { describe, expect, it } from 'vitest';
import { createCombat } from '../core/combat';
import type { CombatAction, FighterSide } from '../core/types';
import { aiPicker, runFight } from './turnLoop';
import type { ActionPicker } from './turnLoop';

const nextTick = () => new Promise<void>((r) => setTimeout(r, 0));

describe('runFight', () => {
  it('alternates turns and ends when someone falls', async () => {
    const order: FighterSide[] = [];
    const tracked = (side: FighterSide, inner: ActionPicker): ActionPicker => async (state, options) => {
      order.push(side);
      expect(state.active).toBe(side);
      return inner(state, options);
    };
    const outcome = await runFight(createCombat(11), {
      pickers: { player: tracked('player', aiPicker('aggressor', 1)), enemy: tracked('enemy', aiPicker('defender', 2)) },
      present: async () => {},
    });
    expect(outcome.finished).toBe(true);
    expect(outcome.state.winner).not.toBeNull();
    expect(outcome.events.at(-1)).toMatchObject({ type: 'death', winner: outcome.state.winner });
    order.forEach((side, i) => expect(side).toBe(i % 2 === 0 ? 'player' : 'enemy'));
  });

  it('never asks for a choice while an action is still being shown', async () => {
    let presenting = false;
    let picks = 0;
    const picker = (inner: ActionPicker): ActionPicker => async (state, options) => {
      expect(presenting).toBe(false);
      picks++;
      return inner(state, options);
    };
    await runFight(createCombat(5), {
      pickers: { player: picker(aiPicker('aggressor', 3)), enemy: picker(aiPicker('aggressor', 4)) },
      present: async () => {
        presenting = true;
        await nextTick();
        presenting = false;
      },
    });
    expect(picks).toBeGreaterThan(2);
  });

  it('pauses between turns with the side that acts next', async () => {
    const pauses: FighterSide[] = [];
    const outcome = await runFight(createCombat(8), {
      pickers: { player: aiPicker('aggressor', 5), enemy: aiPicker('aggressor', 6) },
      present: async () => {},
      pause: async (next) => { pauses.push(next); },
    });
    const actions = outcome.events.filter((e) => e.type === 'turn').length + 1;
    expect(pauses).toHaveLength(actions - 1);
    expect(pauses[0]).toBe('enemy');
  });

  it('stops after the current action when aborted', async () => {
    const stop = new AbortController();
    let actions = 0;
    const outcome = await runFight(createCombat(9), {
      pickers: { player: aiPicker('defender', 7), enemy: aiPicker('defender', 8) },
      present: async () => { if (++actions === 3) stop.abort(); },
      signal: stop.signal,
    });
    expect(outcome.finished).toBe(false);
    expect(actions).toBe(3);
  });

  it('rejects an action the core does not allow', async () => {
    const wrong: ActionPicker = async () => 'power' as CombatAction;
    await expect(runFight(createCombat(1), {
      pickers: { player: wrong, enemy: wrong },
      present: async () => {},
    })).rejects.toThrow(/not available/);
  });
});
