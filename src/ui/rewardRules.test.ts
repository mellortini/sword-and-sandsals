import { expect, it } from 'vitest';
import { takePrizeWeapon } from '../core/rewards';
import type { FightReward } from '../core/rewards';
import type { SavedCharacter } from '../core/save';
import { resolveAttributes } from '../core/stats';
import { PULPPORT_CHAMPION_WEAPON } from '../data/leagues';
import { championPrizeId, materialsLine, payFightReward } from './rewardRules';

const character: SavedCharacter = {
  name: 'Aelia', level: 1, experience: 0, gold: 50, attributes: resolveAttributes(), inventory: [],
  look: { skin: 3, face: 0, hair: 1, hairColor: 1, beard: 2, helmet: 0, armor: 0, shoulders: 0, greaves: 0, boots: 0, weapon: 'gladius' },
};
const reward: FightReward = { fightId: 'f1', gold: 40, experience: 25, weapon: PULPPORT_CHAMPION_WEAPON };

it('names the prize only for a champion bout', () => {
  expect(championPrizeId('bronze-champion')).toBe(PULPPORT_CHAMPION_WEAPON.id);
  expect(championPrizeId('quay-rookie')).toBeUndefined();
  expect(championPrizeId()).toBeUndefined();
});

it('pays gold and XP at once and leaves the weapon for the scroll', () => {
  const { progress, offer } = payFightReward(character, reward);
  expect(progress).toMatchObject({ earned: 25, before: character, after: { gold: 90, inventory: [] } });
  expect(offer).toBe(PULPPORT_CHAMPION_WEAPON);
  const taken = takePrizeWeapon(progress.after, PULPPORT_CHAMPION_WEAPON.id);
  expect(taken.inventory).toEqual([PULPPORT_CHAMPION_WEAPON.id]);
  expect(takePrizeWeapon(taken, PULPPORT_CHAMPION_WEAPON.id)).toBe(taken);
});

it('does not offer a prize the gladiator already owns', () => {
  expect(payFightReward({ ...character, inventory: [PULPPORT_CHAMPION_WEAPON.id] }, reward).offer).toBeUndefined();
});

it('lists only the materials that dropped', () => {
  expect(materialsLine({ scraps: 2, glue: 0, ink: 1, threads: 0 })).toBe('2 Scraps · 1 Ink');
  expect(materialsLine(undefined)).toBe('');
});
