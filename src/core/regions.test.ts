import { expect, it } from 'vitest';
import { PULPPORT_LEGEND } from '../data/leagues';
import { KRAFTMOOR_OPPONENTS } from '../data/regions';
import { createCombat, performAction } from './combat';
import { createRegionalCombat, isRegionUnlocked } from './regions';
import { deserializeSave, serializeSave } from './save';
import type { SavedCharacter } from './save';
import { resolveAttributes } from './stats';
import { statusModifiers } from './status';

it('unlocks Kraftmoor after the Pulpport finale and preserves access after loading', () => {
  const character: SavedCharacter = {
    name: 'Decima', level: 32, experience: 0, gold: 0, attributes: resolveAttributes(), inventory: [],
    look: { skin: 0, face: 0, hair: 0, hairColor: 0, beard: 0, helmet: 0, armor: 0, shoulders: 0, greaves: 0, boots: 0, weapon: 'gladius' },
  };
  expect(isRegionUnlocked('pulpport', character)).toBe(true);
  expect(isRegionUnlocked('kraftmoor', character)).toBe(false);
  expect(isRegionUnlocked('kraftmoor', { leagueWins: PULPPORT_LEGEND.slice(0, -1).map(({ id }) => id) })).toBe(false);
  const saved = { ...character, leagueWins: [PULPPORT_LEGEND.at(-1)!.id] };
  const loaded = deserializeSave(serializeSave(saved));
  if (!loaded.ok) throw new Error('Expected a valid career save.');
  expect(isRegionUnlocked('kraftmoor', loaded.character)).toBe(true);
});

it('keeps ordinary Pulpport starts and applies the Kraftmoor damp with normal resistance', () => {
  expect(createRegionalCombat(7, 'pulpport')).toEqual(createCombat(7));
  const state = createRegionalCombat(7, 'kraftmoor');
  expect(state.fighters.player.position).toBe(6);
  expect(state.fighters.enemy.position).toBe(14);
  expect(createRegionalCombat(7, 'kraftmoor', { position: undefined }, { position: undefined })).toEqual(state);
  for (const fighter of Object.values(state.fighters)) {
    expect(fighter.statuses).toEqual([{ kind: 'soaked', turns: 2, stacks: 1 }]);
    expect(statusModifiers(fighter.statuses)).toMatchObject({ armourMultiplier: 0.8, movementMultiplier: 0.8 });
  }
  const resistant = createRegionalCombat(7, 'kraftmoor', { position: 5, statusResistances: { soaked: 100 } });
  expect(resistant.fighters.player.statuses).toEqual([]);
  expect(resistant.fighters.player.position).toBe(5);
  expect(resistant.fighters.enemy.statuses).toEqual(state.fighters.enemy.statuses);
  expect(performAction(state, 'step_forward').state.fighters.player.position).toBeLessThan(
    performAction(createCombat(7, { position: 6 }, { position: 14 }), 'step_forward').state.fighters.player.position,
  );
});

it('creates equipped heavy-armoured opponents in increasing level order', () => {
  expect(new Set(KRAFTMOOR_OPPONENTS.map(({ id }) => id)).size).toBe(KRAFTMOOR_OPPONENTS.length);
  for (const [index, rival] of KRAFTMOOR_OPPONENTS.entries()) {
    const state = createRegionalCombat(8, 'kraftmoor', {}, rival.setup);
    const { enemy } = state.fighters;
    expect(enemy).toMatchObject({ name: rival.name, level: rival.level });
    expect(enemy.weapon?.id).toBe(rival.setup.equipment?.weapon);
    expect(enemy.stats.armour).toBeGreaterThan(40);
    expect(enemy.level).toBeGreaterThan(KRAFTMOOR_OPPONENTS[index - 1]?.level ?? 32);
  }
});
