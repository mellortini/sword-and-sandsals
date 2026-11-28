import { describe, expect, it } from 'vitest';
import { chooseAction } from './ai';
import { createCombat, getActionOptions, performAction } from './combat';
import { BLINDED_ACCURACY_PENALTY } from './status';
import {
  SAND_VEIL_EVASION, TECHNIQUES, TECHNIQUE_RULES, isTechnique, learnedTechniques, parseTechniques, techniqueFlag,
} from './techniques';
import type { CombatAction, CombatEvent, CombatState, Fighter, FighterSetup, FighterSide } from './types';
import { CORVIN_LACH, MASTERS, masterOf } from '../data/masters';

const all = { techniques: TECHNIQUES };
/** small consecutive seeds start the LCG on nearly the same first roll: spread them over the whole range */
const spread = (n: number) => Math.imul(n, 0x9e3779b1) >>> 0;
const at = (gap: number, seed = 1, player: FighterSetup = all, enemy: FighterSetup = {}) =>
  createCombat(spread(seed), { position: 4, ...player }, { position: 4 + gap, ...enemy });
const patch = (state: CombatState, side: FighterSide, change: Partial<Fighter>): CombatState =>
  ({ ...state, fighters: { ...state.fighters, [side]: { ...state.fighters[side], ...change } } });
const actions = (state: CombatState) => getActionOptions(state).map((o) => o.action);
const attackOf = (events: readonly CombatEvent[]) => events.find((e): e is Extract<CombatEvent, { type: 'attack' }> => e.type === 'attack');

describe('the Masters’ techniques (#295)', () => {
  it('come from the story flags, the dev links and the Masters', () => {
    expect(learnedTechniques({ flags: { [techniqueFlag('sand_veil')]: true, [techniqueFlag('feint_step')]: true } })).toEqual(['feint_step', 'sand_veil']);
    expect(learnedTechniques({ flags: {} })).toEqual([]);
    expect(parseTechniques('all')).toEqual([...TECHNIQUES]);
    expect(parseTechniques('burning_edge,nope')).toEqual(['burning_edge']);
    expect(parseTechniques(null)).toEqual([]);
    expect(isTechnique('stone_guard')).toBe(true);
    expect(isTechnique('block')).toBe(false);
    expect(MASTERS.map((m) => m.technique).sort()).toEqual([...TECHNIQUES].sort());
    expect(masterOf('stone_guard').name).toBe('Brann the Anvil');
  });

  it('need Rhythm: none at the start, all of them once it is paid for', () => {
    const start = at(1);
    expect(actions(start).some(isTechnique)).toBe(false);
    const ready = patch(start, 'player', { rhythm: 60 });
    expect(actions(ready).filter(isTechnique)).toEqual([...TECHNIQUES]);
    for (const option of getActionOptions(ready).filter((o) => isTechnique(o.action))) {
      const rule = TECHNIQUE_RULES[option.action as (typeof TECHNIQUES)[number]];
      expect(option).toMatchObject({ energyCost: rule.energy, rhythmCost: rule.rhythm });
      if (rule.strike) expect(option.hitChance).toBeGreaterThan(0);
    }
  });

  it('only for a fighter who knows them, and never without Rhythm', () => {
    expect(actions(patch(at(1, 1, {}), 'player', { rhythm: 100 })).some(isTechnique)).toBe(false);
    expect(createCombat(1, { rhythm: false, techniques: TECHNIQUES }).fighters.player.techniques).toBeUndefined();
    expect(actions(patch(at(1, 1, { techniques: ['sand_veil'] }), 'player', { rhythm: 100 })).filter(isTechnique)).toEqual(['sand_veil']);
  });

  it('spend their Rhythm, so a technique never rides the Seventh Step', () => {
    const state = patch(at(1), 'player', { rhythm: 100 });
    const option = getActionOptions(state).find((o) => o.action === 'burning_edge')!;
    expect(option.hitChance).toBeLessThan(100);
    const result = performAction(state, 'burning_edge');
    expect(result.events[1]).toEqual({ type: 'technique', fighter: 'player', technique: 'burning_edge', rhythm: 35 });
    const rhythm = result.events.find((e) => e.type === 'rhythm' && e.fighter === 'player');
    expect(rhythm).toMatchObject({ from: 100 });
    expect(result.state.fighters.player.rhythm).toBeLessThan(100 - 35 + 20);
  });

  it('Feint Step closes in and strikes a blow the guard cannot stop', () => {
    const reach = 2;
    expect(actions(patch(at(reach + 1.6), 'player', { rhythm: 50 }))).toContain('feint_step');
    expect(actions(patch(at(reach + 1.7), 'player', { rhythm: 50 }))).not.toContain('feint_step');
    let blocked = 0;
    for (let seed = 1; seed < 60; seed++) {
      const state = patch(patch(at(reach + 1, seed), 'player', { rhythm: 50 }), 'enemy', { guarding: true, stoneGuard: true });
      const result = performAction(state, 'feint_step');
      expect(result.events.find((e) => e.type === 'move')).toMatchObject({ fighter: 'player', kind: 'step_forward' });
      const attack = attackOf(result.events)!;
      expect(attack).toMatchObject({ technique: 'feint_step', kind: 'normal' });
      if (attack.blocked) blocked++;
      expect(result.state.fighters.enemy.counterReady).toBe(false);
    }
    expect(blocked).toBe(0);
  });

  it('Stone Guard raises the guard, and a block in it always earns the counter', () => {
    let blocks = 0;
    for (let seed = 1; seed < 80; seed++) {
      const guard = performAction(patch(at(1, seed, all, { attributes: { guard: 5 } }), 'player', { rhythm: 40 }), 'stone_guard');
      expect(guard.events).toContainEqual({ type: 'block', fighter: 'player' });
      expect(guard.state.fighters.player).toMatchObject({ guarding: true, stoneGuard: true });
      const blow = performAction(guard.state, 'quick');
      if (attackOf(blow.events)?.blocked) {
        blocks++;
        // Guard 5 earns no counter from a plain block (counterChance needs 8)
        expect(blow.state.fighters.player.counterReady).toBe(true);
      }
      expect(blow.state.fighters.player.stoneGuard).toBe(false);
    }
    expect(blocks).toBeGreaterThan(5);
  });

  it('Sand Veil steps back, makes blows miss more often and blinds the one who missed', () => {
    const state = patch(at(0.5), 'player', { rhythm: 40 });
    const veil = performAction(state, 'sand_veil');
    expect(veil.events.find((e) => e.type === 'move')).toMatchObject({ fighter: 'player', kind: 'step_back' });
    expect(veil.state.fighters.player.veiled).toBe(true);
    const plain = performAction(patch(state, 'player', { rhythm: 0 }), 'rest').state;
    const chance = (s: CombatState) => getActionOptions(s).find((o) => o.action === 'normal')!.hitChance!;
    // the shown chance goes through the miss protection's schedule (hitProtection.ts), so it is not exactly 25 lower
    expect(chance(plain) - chance(veil.state)).toBeGreaterThanOrEqual(SAND_VEIL_EVASION - 5);

    let blinded = 0;
    for (let seed = 1; seed < 60; seed++) {
      const veiled = performAction(patch(at(0.5, seed), 'player', { rhythm: 40 }), 'sand_veil').state;
      const blow = performAction(veiled, 'normal');
      if (attackOf(blow.events)!.hit) continue;
      blinded++;
      // blinded through the enemy's next turn: its blows go wide
      const back = performAction(blow.state, 'rest');
      expect(back.state.fighters.enemy.statuses.some((s) => s.kind === 'blinded')).toBe(true);
      const blind = getActionOptions(back.state).find((o) => o.action === 'quick')!.hitChance!;
      const clear = getActionOptions(patch(back.state, 'enemy', { statuses: [] })).find((o) => o.action === 'quick')!.hitChance!;
      expect(clear - blind).toBeGreaterThanOrEqual(Math.min(BLINDED_ACCURACY_PENALTY - 10, clear - 10));
    }
    expect(blinded).toBeGreaterThan(5);
  });

  it('Burning Edge sets a wounded opponent on fire', () => {
    let burned = 0;
    for (let seed = 1; seed < 40; seed++) {
      const result = performAction(patch(at(1, seed), 'player', { rhythm: 40 }), 'burning_edge');
      const attack = attackOf(result.events)!;
      expect(attack.technique).toBe('burning_edge');
      const burning = result.state.fighters.enemy.statuses.some((s) => s.kind === 'burning');
      expect(burning).toBe(attack.damage > 0 && result.state.fighters.enemy.health > 0);
      if (burning) burned++;
    }
    expect(burned).toBeGreaterThan(10);
  });

  it('Ser Corvin Lach’s AI uses all of them', () => {
    const used = new Set<CombatAction>();
    for (let seed = 1; seed < 40; seed++) {
      let state = createCombat(spread(seed), { level: 20, attributes: { might: 12, guard: 12 } }, {
        level: CORVIN_LACH.level, attributes: CORVIN_LACH.attributes, techniques: CORVIN_LACH.techniques,
      });
      let rng = seed;
      for (let turn = 0; turn < 80 && state.winner === null; turn++) {
        const decision = chooseAction(state, state.active === 'enemy' ? CORVIN_LACH.profile : 'defender', rng);
        rng = decision.rngState;
        if (state.active === 'enemy' && isTechnique(decision.action)) used.add(decision.action);
        state = performAction(state, decision.action).state;
      }
    }
    expect([...used].sort().join()).toBe([...TECHNIQUES].sort().join());
  });
});
