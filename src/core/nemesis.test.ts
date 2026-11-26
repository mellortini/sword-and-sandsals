import { expect, it } from 'vitest';
import { chooseAction } from './ai';
import { createCombat, getActionOptions, performAction } from './combat';
import { chooseNemesisAction, nemesisOpponent, rememberNemesis } from './nemesis';
import type { NemesisOrigin } from './nemesis';
import { deserializeSave, serializeSave } from './save';
import type { SavedCharacter } from './save';
import { resolveAttributes } from './stats';

const origin: NemesisOrigin = { id: 'quay-rival', seed: 42, level: 4, league: 'silver' };
const initial = createCombat(1, { position: 4 }, { position: 10, level: 4, name: 'Cassia Inkhand' });
const charge = performAction(initial, 'charge');
const loss = { ...charge.state, winner: 'enemy' as const };
const victory = { ...charge.state, winner: 'player' as const };

it('remembers a victor or a spared enemy, deduplicates replay and removes a defeated rival', () => {
  expect(rememberNemesis(undefined, origin, 'initial', initial, [])).toBeUndefined();
  const first = rememberNemesis(undefined, origin, 'loss', loss, charge.events);
  expect(first).toMatchObject({ encounters: 1, charges: 1, name: 'Cassia Inkhand' });
  expect(rememberNemesis(first, origin, 'loss', loss, charge.events)).toBe(first);
  const second = rememberNemesis(first, origin, 'spared', victory, charge.events, true);
  expect(second).toMatchObject({ encounters: 2, charges: 2 });
  expect(rememberNemesis(second, origin, 'defeated', victory, [])).toBeUndefined();
});

it('reuses the saved identity, scales the rematch, and preserves it across save serialization', () => {
  const memory = rememberNemesis(undefined, origin, 'loss', loss, charge.events)!;
  const rival = nemesisOpponent(memory, 6);
  expect(rival).toMatchObject({ name: 'Cassia Inkhand' });
  expect(rival.level).toBeGreaterThan(6);
  const character: SavedCharacter = {
    name: 'Aelia', level: 6, experience: 0, gold: 20, attributes: resolveAttributes(), inventory: [],
    look: { skin: 3, face: 0, hair: 1, hairColor: 1, beard: 2, helmet: 0, armor: 0, shoulders: 0, greaves: 0, boots: 0, weapon: 'gladius' },
    nemesis: memory,
  };
  expect(deserializeSave(serializeSave(character))).toEqual({ ok: true, character });
  expect(nemesisOpponent(memory, 60).level).toBe(60);
});

it('preserves the original features across encounters and saves while regenerating equipment', () => {
  const features = { skin: 8, face: 7, hair: 6, hairColor: 3, beard: 2 };
  const originalLook = { ...features, helmet: 10, armor: 10, shoulders: 10, greaves: 10, boots: 10, weapon: 'sword10' };
  const first = rememberNemesis(undefined, { ...origin, appearance: originalLook }, 'first', loss, [])!;
  const later = rememberNemesis(first, { ...origin, appearance: { ...features, face: 0 } }, 'later', loss, [])!;
  expect(first.appearance).toEqual(features);
  expect(later.appearance).toEqual(features);

  const character: SavedCharacter = {
    name: 'Aelia', level: 6, experience: 0, gold: 20, attributes: resolveAttributes(), inventory: [],
    look: originalLook, nemesis: later,
  };
  const loaded = deserializeSave(serializeSave(character));
  if (!loaded.ok || !loaded.character.nemesis) throw new Error('Expected to reload a saved nemesis.');
  const rival = nemesisOpponent(loaded.character.nemesis, 25);
  const generated = nemesisOpponent({ ...later, appearance: undefined }, 25);
  expect(rival.look).toEqual({ ...generated.look, ...features });
  expect(rival.equipment).toEqual(generated.equipment);
  expect(rival.level).toBe(generated.level);

  const malformed = { ...character, nemesis: { ...later, appearance: { ...features, face: 10 } } };
  expect(deserializeSave(JSON.stringify({ version: 1, character: malformed }))).toEqual({ ok: false, reason: 'invalid' });
});

it('guards against a legal charge more often and still selects legal actions', () => {
  const memory = { ...rememberNemesis(undefined, origin, 'loss', loss, charge.events)!, charges: 5 };
  const state = { ...initial, active: 'enemy' as const };
  const actions = getActionOptions(state).map(({ action }) => action);
  let learnedBlocks = 0;
  let originalBlocks = 0;
  for (let seed = 0; seed < 200; seed++) {
    const rngState = Math.imul(seed, 0x9e3779b1) >>> 0;
    const reaction = chooseNemesisAction(state, memory, rngState);
    expect(actions).toContain(reaction.action);
    if (reaction.action === 'block') learnedBlocks++;
    if (chooseAction(state, 'defender', rngState).action === 'block') originalBlocks++;
  }
  expect(learnedBlocks).toBeGreaterThan(originalBlocks * 2);
});
