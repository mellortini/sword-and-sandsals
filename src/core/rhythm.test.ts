import { describe, expect, it } from 'vitest';
import { createCombat, getActionOptions, getAttackZoneOptions, performAction } from './combat';
import { RHYTHM_GAIN, RHYTHM_MAX, RHYTHM_STEPS, actorRhythm, defenderRhythm, onSeventhStep, rhythmSteps } from './rhythm';
import type { CombatState, FighterSide } from './types';

const at = (gap: number, seed = 1) => createCombat(seed, { position: 4 }, { position: 4 + gap });
const withRhythm = (state: CombatState, side: FighterSide, rhythm: number): CombatState =>
  ({ ...state, fighters: { ...state.fighters, [side]: { ...state.fighters[side], rhythm } } });

describe('Rhythm rules (#294)', () => {
  it('rewards variety, counters, footwork and blood; punishes repetition', () => {
    const turn = { action: 'quick' as const, counter: false, moved: false, hit: false };
    expect(actorRhythm(turn)).toBe(0);
    expect(actorRhythm({ ...turn, previous: 'normal' })).toBe(RHYTHM_GAIN.variety);
    expect(actorRhythm({ ...turn, previous: 'quick' })).toBe(RHYTHM_GAIN.repeat);
    expect(actorRhythm({ ...turn, previous: 'rest', counter: true, hit: true })).toBe(RHYTHM_GAIN.variety + RHYTHM_GAIN.counter + RHYTHM_GAIN.hit);
    expect(actorRhythm({ action: 'step_forward', previous: 'rest', counter: false, moved: true, hit: false })).toBe(RHYTHM_GAIN.variety + RHYTHM_GAIN.distance);
  });

  it('a dodged blow raises the defender, a critical one lowers it', () => {
    expect(defenderRhythm({ hit: false, crit: false })).toBe(RHYTHM_GAIN.dodge);
    expect(defenderRhythm({ hit: true, crit: true })).toBe(RHYTHM_GAIN.critTaken);
    expect(defenderRhythm({ hit: true, crit: false })).toBe(0);
  });

  it('shows seven footprints, the last one only when full', () => {
    expect(rhythmSteps(0)).toBe(0);
    expect(rhythmSteps(99)).toBe(RHYTHM_STEPS - 1);
    expect(rhythmSteps(RHYTHM_MAX)).toBe(RHYTHM_STEPS);
    expect(onSeventhStep(RHYTHM_MAX)).toBe(true);
    expect(onSeventhStep(undefined)).toBe(false);
  });
});

describe('Rhythm in a bout (#294)', () => {
  it('starts at 0 and can be left out', () => {
    expect(at(1).fighters.player.rhythm).toBe(0);
    expect(createCombat(1, { rhythm: false }).fighters.player.rhythm).toBeUndefined();
  });

  it('moves with the actions and is reported', () => {
    let state = at(4);
    const first = performAction(state, 'step_forward');
    expect(first.events).toContainEqual({ type: 'rhythm', fighter: 'player', from: 0, to: RHYTHM_GAIN.distance });
    state = performAction(first.state, 'rest').state;
    // the same step again: repetition costs, the footwork still counts
    const again = performAction(state, 'step_forward');
    expect(again.state.fighters.player.rhythm).toBe(Math.max(0, RHYTHM_GAIN.distance + RHYTHM_GAIN.repeat + RHYTHM_GAIN.distance));
  });

  it('on the Seventh Step every attack is sure, and the attack spends it', () => {
    const state = withRhythm(at(1), 'player', RHYTHM_MAX);
    for (const option of getActionOptions(state)) if (option.hitChance !== undefined) expect(option.hitChance).toBe(100);
    for (const option of getAttackZoneOptions(state, 'power')) expect(option.hitChance).toBe(100);
    for (let seed = 1; seed < 30; seed++) {
      const result = performAction(withRhythm(at(1, seed), 'player', RHYTHM_MAX), { action: 'power', zone: 'head' });
      const attack = result.events.find((e) => e.type === 'attack');
      expect(attack).toMatchObject({ hit: true, hitChance: 100 });
      expect(result.state.fighters.player.rhythm).toBe(0);
    }
  });

  it('is kept through a turn without an attack', () => {
    const rested = performAction(withRhythm(at(1), 'player', RHYTHM_MAX), 'rest');
    expect(rested.state.fighters.player.rhythm).toBe(RHYTHM_MAX);
  });
});
