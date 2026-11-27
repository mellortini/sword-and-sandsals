import { describe, expect, it } from 'vitest';
import { chooseAction } from '../core/ai';
import { createCombat, getActionOptions, performAction } from '../core/combat';
import { nextRandom } from '../core/rng';
import { newCharacter, randomSpread, startSpread } from './creatorRules';
import { ROOKIE_ATTRIBUTES, isFirstBout } from './rookieRules';

const seeded = (seed: number) => {
  let state = seed;
  return () => {
    const next = nextRandom(state);
    state = next.state;
    return next.value;
  };
};

const hero = () => newCharacter('Varro', { skin: 0, face: 0, hair: 0, hairColor: 0, beard: 0, build: 0 }, randomSpread(seeded(1)));

describe('isFirstBout', () => {
  it('is true for a gladiator fresh from the creator', () => {
    expect(startSpread().free).toBeGreaterThan(0);
    expect(isFirstBout(hero())).toBe(true);
  });

  it('is false after any finished bout, a lost one included', () => {
    const achievements = {
      unlocked: [], completedFightIds: ['one'],
      counters: { wins: 0, losses: 1, criticals: 0, blocks: 0, charges: 0, gifts: 0 },
    };
    expect(isFirstBout({ ...hero(), achievements })).toBe(false);
    expect(isFirstBout({ ...hero(), experience: 10 })).toBe(false);
    expect(isFirstBout({ ...hero(), level: 2 })).toBe(false);
  });
});

describe('the rookie opponent', () => {
  /** share of bouts a new gladiator wins against the rookie */
  const winRate = (clicksAtRandom: boolean) => {
    const bouts = 500;
    let wins = 0;
    for (let n = 0; n < bouts; n++) {
      const random = seeded(n + 1);
      let state = createCombat(n * 7919 + 3,
        { level: 1, attributes: randomSpread(random).attributes },
        { level: 1, attributes: ROOKIE_ATTRIBUTES });
      const rng = { player: n + 11, enemy: n + 99 };
      for (let action = 0; action < 400 && state.winner === null; action++) {
        const side = state.active;
        let pick;
        if (side === 'player' && clicksAtRandom) {
          const options = getActionOptions(state);
          pick = options[Math.floor(random() * options.length)].action;
        } else {
          const decision = chooseAction(state, side === 'player' ? 'aggressor' : 'defender', rng[side]);
          rng[side] = decision.rngState;
          pick = decision.action;
        }
        const result = performAction(state, pick);
        if (!result.ok) throw new Error(`unavailable action ${pick}`);
        state = result.state;
      }
      if (state.winner === 'player') wins++;
    }
    return wins / bouts;
  };

  it('loses to sensible play practically always', () => {
    expect(winRate(false)).toBeGreaterThan(0.97);
  });

  it('usually loses even to random clicking', () => {
    expect(winRate(true)).toBeGreaterThan(0.8);
  });
});
