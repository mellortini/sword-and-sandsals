import { describe, expect, it } from 'vitest';
import { createCombat, performAction } from './combat';
import { createCrowdStanding, crowdDamageMultiplier, crowdGoldReward, scoreCrowdAction } from './crowd';

describe('crowd favour', () => {
  it('rewards spectacular moves, critical hits, variety and charming taunts', () => {
    const start = createCrowdStanding(0);
    const jump = scoreCrowdAction(start, 'jump', 0).standing;
    const varied = scoreCrowdAction(jump, 'power', 0, true, true).standing;
    const repeated = scoreCrowdAction(jump, 'jump', 0).standing;
    expect(jump.favour).toBe(55);
    expect(varied.favour).toBe(69);
    expect(repeated.favour).toBe(57);
    expect(scoreCrowdAction(start, 'taunt', 15).standing.favour).toBeGreaterThan(scoreCrowdAction(start, 'taunt', 0).standing.favour);
  });

  it('penalizes retreat and repeated rest and keeps the meter within its bounds', () => {
    const start = createCrowdStanding(0);
    const retreat = scoreCrowdAction(start, 'step_back', 0).standing;
    expect(retreat.favour).toBe(46);
    let resting = retreat;
    for (let i = 0; i < 10; i++) resting = scoreCrowdAction(resting, 'rest', 0).standing;
    expect(resting.favour).toBe(0);
    expect(scoreCrowdAction({ ...start, favour: 96 }, 'charge', 5, true, true).standing.favour).toBe(100);
  });

  it('applies damage and prize bonuses at high favour and keeps donated coins', () => {
    const neutral = createCrowdStanding(0);
    expect(crowdDamageMultiplier(neutral)).toBe(1);
    expect(crowdGoldReward(100, neutral)).toBe(100);
    const high = { ...neutral, favour: 100, giftGold: 5 };
    expect(crowdDamageMultiplier(high)).toBeCloseTo(1.15);
    expect(crowdGoldReward(100, high)).toBe(130);
    const start = createCombat(1, { position: 4, attributes: { might: 20 } }, { position: 6 });
    const favoured = { ...start, fighters: { ...start.fighters, player: { ...start.fighters.player, crowd: high } } };
    expect(performAction(start, 'normal').events).toContainEqual(expect.objectContaining({ type: 'attack', damage: 24 }));
    expect(performAction(favoured, 'normal').events).toContainEqual(expect.objectContaining({ type: 'attack', damage: 28 }));
  });

  it('rolls both gifts on the crowd RNG, with a cooldown after a gift', () => {
    const coin = scoreCrowdAction({ ...createCrowdStanding(0), favour: 100 }, 'taunt', 5);
    expect(coin).toMatchObject({ gift: 'coin', standing: { giftGold: 5, giftCooldown: 3 } });
    const cooldown = scoreCrowdAction(coin.standing, 'jump', 5);
    expect(cooldown.gift).toBeUndefined();
    expect(cooldown.standing.giftCooldown).toBe(2);

    const initial = createCombat(5);
    const player = { ...initial.fighters.player, health: initial.fighters.player.stats.maxHealth - 5, crowd: { ...createCrowdStanding(1972), favour: 100 } };
    const start = { ...initial, fighters: { ...initial.fighters, player } };
    const result = performAction(start, 'taunt');
    expect(result.events).toContainEqual({ type: 'crowd_gift', fighter: 'player', gift: 'bouquet', amount: 5 });
    expect(result.state.fighters.player.health).toBe(player.stats.maxHealth);
    expect(result.state.rngState).toBe(start.rngState);
    expect(result.state.fighters.enemy.crowd.favour).toBe(50);
  });
});
