import { expect, it, vi } from 'vitest';
import { recordAchievements } from './achievements';
import { deserializeSave, importGame, loadGame, serializeSave } from './save';
import type { SavedCharacter } from './save';
import { resolveAttributes } from './stats';

const character: SavedCharacter = {
  name: 'Varro', level: 3, experience: 125, gold: 90,
  attributes: resolveAttributes({ might: 8 }),
  look: {
    skin: 3, face: 0, hair: 1, hairColor: 1, beard: 2,
    helmet: 1, armor: 3, shoulders: 0, greaves: 2, boots: 4, weapon: 'gladius',
  },
  inventory: ['sword1', 'armor3'],
};

it('round-trips a versioned character with independent armour slots', () => {
  const json = serializeSave(character);
  expect(JSON.parse(json).version).toBe(1);
  expect(deserializeSave(json)).toEqual({ ok: true, character });
});

it('round-trips gameplay hand items and unspent advancement points', () => {
  const equipped = { ...character, hands: { weapon: 'sword1', offHand: 'axe2' }, attributePoints: 5, skillPoints: 1 };
  expect(deserializeSave(serializeSave(equipped))).toEqual({ ok: true, character: equipped });
});

it('round-trips achievement progress and keeps old saves readable', () => {
  const unlocked = { ...character, achievements: recordAchievements({ type: 'finisher' }).progress };
  expect(deserializeSave(serializeSave(unlocked))).toEqual({ ok: true, character: unlocked });
  expect(deserializeSave(serializeSave(character))).toEqual({ ok: true, character });
  const counters = { ...unlocked.achievements.counters, wins: -1 };
  expect(() => serializeSave({ ...unlocked, achievements: { ...unlocked.achievements, counters } })).toThrow(TypeError);
});

it('rejects malformed or incomplete data and unsupported versions', () => {
  expect(deserializeSave('{')).toEqual({ ok: false, reason: 'invalid' });
  expect(deserializeSave('{"version":0}')).toEqual({ ok: false, reason: 'unsupported' });
  expect(deserializeSave('{"version":2}')).toEqual({ ok: false, reason: 'unsupported' });
  expect(deserializeSave('{"version":1,"character":{}}')).toEqual({ ok: false, reason: 'invalid' });
});

it('rejects invalid gold, attributes and equipped indices', () => {
  for (const broken of [
    { ...character, gold: -1 },
    { ...character, skillPoints: -1 },
    { ...character, hands: { offHand: ' ' } },
    { ...character, attributes: { ...character.attributes, might: 2.5 } },
    { ...character, look: { ...character.look, helmet: 11 } },
  ]) {
    expect(deserializeSave(JSON.stringify({ version: 1, character: broken }))).toEqual({ ok: false, reason: 'invalid' });
    expect(() => serializeSave(broken)).toThrow(TypeError);
  }
});

it('rejects an unsupported import before opening storage', async () => {
  const open = vi.fn();
  vi.stubGlobal('indexedDB', { open });
  try {
    await expect(importGame('{"version":2}')).resolves.toEqual({ ok: false, reason: 'unsupported' });
    expect(open).not.toHaveBeenCalled();
  } finally {
    vi.unstubAllGlobals();
  }
});

it('supplies a fresh character and a message when IndexedDB is unavailable', async () => {
  vi.stubGlobal('indexedDB', undefined);
  try {
    await expect(loadGame(() => character)).resolves.toMatchObject({
      status: 'recovered', reason: 'storage', character, message: expect.any(String),
    });
  } finally {
    vi.unstubAllGlobals();
  }
});
