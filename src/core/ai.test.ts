import { describe, expect, it } from 'vitest';
import { BEAST_OPPONENTS } from '../data/beasts';
import { chooseAction } from './ai';
import type { AiProfile } from './ai';
import { createCombat, getActionOptions, performAction } from './combat';
import type { CombatAction, CombatState, FighterSetup } from './types';

const MAX_ACTIONS = 400;

function fight(seed: number, profiles: Record<'player' | 'enemy', AiProfile>, player: FighterSetup = {}, enemy: FighterSetup = {}) {
  let state: CombatState = createCombat(seed, player, enemy);
  let ai = seed ^ 0x5bd1e995;
  const picks: Record<'player' | 'enemy', CombatAction[]> = { player: [], enemy: [] };
  let actions = 0;
  while (state.winner === null && actions < MAX_ACTIONS) {
    const side = state.active;
    const legal = getActionOptions(state).map((o) => o.action);
    const decision = chooseAction(state, profiles[side], ai);
    expect(legal).toContain(decision.action);
    ai = decision.rngState;
    picks[side].push(decision.action);
    const result = performAction(state, decision.action);
    expect(result.ok).toBe(true);
    state = result.state;
    actions++;
  }
  return { state, actions, picks };
}

const share = (picks: readonly CombatAction[], actions: readonly CombatAction[]) =>
  picks.filter((a) => actions.includes(a)).length / picks.length;

describe('enemy AI', () => {
  it('always picks a legal action and every one of 1000 AI fights ends', () => {
    const pairs: [AiProfile, AiProfile][] = [['aggressor', 'defender'], ['defender', 'aggressor'], ['aggressor', 'aggressor'], ['defender', 'defender']];
    let longest = 0;
    for (let seed = 1; seed <= 1000; seed++) {
      const [p, e] = pairs[seed % pairs.length];
      const { state, actions } = fight(seed, { player: p, enemy: e },
        { attributes: { might: 3 + (seed % 7), guard: 3 + (seed % 5) }, equipment: { armor: seed % 4 } },
        { attributes: { agility: 3 + (seed % 6), stamina: 3 + (seed % 4) }, equipment: { helmet: seed % 3 } });
      expect(state.winner).not.toBeNull();
      longest = Math.max(longest, actions);
    }
    expect(longest).toBeLessThan(MAX_ACTIONS);
  });

  it('is deterministic for the same state and random state', () => {
    const state = createCombat(42);
    expect(chooseAction(state, 'aggressor', 7)).toEqual(chooseAction(state, 'aggressor', 7));
  });

  it('gives the profiles their own style', () => {
    const aggressor: CombatAction[] = [];
    const defender: CombatAction[] = [];
    // the profiles' own taste: on the Seventh Step (#294) a sure hit draws every profile to the heaviest blow
    const plain = { rhythm: false };
    for (let seed = 1; seed <= 200; seed++) {
      aggressor.push(...fight(seed, { player: 'aggressor', enemy: 'defender' }, plain, plain).picks.player);
      defender.push(...fight(seed, { player: 'defender', enemy: 'aggressor' }, plain, plain).picks.player);
    }
    expect(share(aggressor, ['power', 'charge'])).toBeGreaterThan(share(defender, ['power', 'charge']));
    expect(share(defender, ['block', 'rest'])).toBeGreaterThan(share(aggressor, ['block', 'rest']));
  });

  it('rests when it cannot afford any attack', () => {
    let state = createCombat(3, { position: 9 }, { position: 10 });
    state = { ...state, fighters: { ...state.fighters, player: { ...state.fighters.player, energy: 2 } } };
    expect(chooseAction(state, 'aggressor', 1).action).toBe('rest');
  });

  it('refuses to act once the fight is over', () => {
    const state = { ...createCombat(1), winner: 'player' as const };
    expect(() => chooseAction(state, 'defender', 1)).toThrow();
  });
});

describe('beast AI', () => {
  it('favours pouncing with the lion and crushing in melee with the bear', () => {
    const rollActions = (state: CombatState, profile: AiProfile) => Array.from({ length: 200 }, (_, index) =>
      chooseAction(state, profile, Math.imul(index + 1, 0x9e3779b1) >>> 0).action);
    const distant = createCombat(1);
    const charging = createCombat(1, { position: 5 }, { position: 12 });
    const close = createCombat(1, { position: 9 }, { position: 10 });
    expect(share(rollActions(distant, 'lion'), ['jump'])).toBeGreaterThan(share(rollActions(distant, 'bear'), ['jump']));
    expect(share(rollActions(charging, 'lion'), ['charge'])).toBeGreaterThan(share(rollActions(charging, 'bear'), ['charge']));
    expect(share(rollActions(close, 'bear'), ['power'])).toBeGreaterThan(share(rollActions(close, 'lion'), ['power']));
  });

  it.each(Object.entries(BEAST_OPPONENTS))('finishes seeded arena fights against %s with legal actions', (_id, beast) => {
    const player: FighterSetup = { level: 20, attributes: { might: 13, guard: 12, vitality: 13, stamina: 11 }, equipment: { weapon: 'sword6' } };
    for (let seed = 1; seed <= 40; seed++) {
      const { state, picks } = fight(seed, { player: 'aggressor', enemy: beast.profile }, player, beast.setup);
      expect(state.fighters.enemy.weapon).toBeUndefined();
      expect(state.winner).not.toBeNull();
      expect(picks.enemy).not.toContain('taunt');
    }
  });
});
