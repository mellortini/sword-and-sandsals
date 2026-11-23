import { describe, expect, it } from 'vitest';
import { createCombat, getActionOptions, performAction } from '../core/combat';
import type { CombatAction, CombatEvent } from '../core/types';
import { forwardDelta, planSteps, screenX } from './combatPlan';

const layout = { left: 500, px: 38, contact: 140 };

describe('screen mapping', () => {
  it('puts the enemy one contact gap further right at the same logical position', () => {
    expect(screenX(layout, 'player', 4)).toBe(500 + 4 * 38);
    expect(screenX(layout, 'enemy', 4)).toBe(500 + 4 * 38 + 140);
  });

  it('measures moves in each fighter\'s forward direction', () => {
    expect(forwardDelta('player', 2, 3.6)).toBeCloseTo(1.6);
    expect(forwardDelta('enemy', 18, 16.4)).toBeCloseTo(1.6);
    expect(forwardDelta('enemy', 10, 12)).toBe(-2); // enemy pushed right = backwards for it
  });
});

describe('planSteps', () => {
  const attack = (over: Partial<Extract<CombatEvent, { type: 'attack' }>> = {}): CombatEvent => ({
    type: 'attack', actor: 'player', target: 'enemy', kind: 'normal', hitChance: 70, hit: true, crit: false, blocked: false, damage: 7, ...over,
  });

  it('skips energy and turn events', () => {
    const steps = planSteps([
      { type: 'energy', fighter: 'player', from: 40, to: 35 },
      attack(),
      { type: 'turn', fighter: 'enemy' },
    ]);
    expect(steps).toEqual([{ kind: 'attack', attack: attack(), fatal: false }]);
  });

  it('merges a charge move with its charge attack so the hit lands on the charge clip', () => {
    const strike = attack({ kind: 'charge' });
    const steps = planSteps([
      { type: 'move', fighter: 'player', kind: 'charge', from: 2, to: 9 },
      strike,
      { type: 'move', fighter: 'enemy', kind: 'knockback', from: 10, to: 12 },
    ]);
    expect(steps).toEqual([
      { kind: 'move', side: 'player', move: 'charge', from: 2, to: 9, strike, fatal: false },
      { kind: 'move', side: 'enemy', move: 'knockback', from: 10, to: 12 },
    ]);
  });

  it('marks the killing blow as fatal and ends with the death step', () => {
    const steps = planSteps([attack({ damage: 30 }), { type: 'death', fighter: 'enemy', winner: 'player' }]);
    expect(steps[0]).toMatchObject({ kind: 'attack', fatal: true });
    expect(steps[1]).toEqual({ kind: 'death', side: 'enemy', winner: 'player' });
  });

  it('turns every action of a whole seeded fight into steps with known clips', () => {
    let state = createCombat(7);
    const clips = new Set<string>();
    for (let turn = 0; turn < 400 && state.winner === null; turn++) {
      const options = getActionOptions(state);
      const pick = (['power', 'normal', 'quick', 'charge', 'step_forward', 'rest'] as CombatAction[])
        .find((a) => options.some((o) => o.action === a))!;
      const result = performAction(state, pick);
      expect(result.ok).toBe(true);
      for (const s of planSteps(result.events)) {
        clips.add(s.kind === 'move' ? s.move : s.kind === 'attack' ? `attack_${s.attack.kind}` : s.kind === 'pose' ? s.clip : 'death');
      }
      state = result.state;
    }
    expect(state.winner).not.toBeNull();
    expect(clips.has('death')).toBe(true);
  });
});
