import { describe, expect, it } from 'vitest';
import { SLEEP_RECOVERY, sleepAtHome, sleepQuote } from './home';
import { deserializeSave, serializeSave } from './save';
import type { SavedCharacter } from './save';
import { resolveAttributes } from './stats';
import { recoverFromDefeat } from './temple';

const broke: SavedCharacter = {
  name: 'Aelia', level: 1, experience: 0, gold: 0, health: 0, attributes: resolveAttributes(), inventory: [],
  look: { skin: 0, face: 0, hair: 0, hairColor: 0, beard: 0, helmet: 0, armor: 0, shoulders: 0, greaves: 0, boots: 0, weapon: 'gladius' },
};

describe('sleeping at home', () => {
  it('restores a quarter of full health for free and takes a day', () => {
    expect(SLEEP_RECOVERY).toBe(0.25);
    expect(sleepQuote(broke)).toEqual({ day: 1, health: 0, maxHealth: 70, after: 18 });
    const slept = sleepAtHome(broke);
    expect(slept).toMatchObject({ health: 18, gold: 0, story: { day: 2 } });
    expect(deserializeSave(serializeSave(slept))).toEqual({ ok: true, character: slept });
  });

  it('gets a beaten gladiator without gold back to full in two nights', () => {
    const slept = sleepAtHome(sleepAtHome(recoverFromDefeat(broke)));
    expect(slept).toMatchObject({ health: 70, story: { day: 3 } });
  });

  it('does nothing for a gladiator without wounds', () => {
    const rested = { ...broke, health: 70 };
    expect(sleepAtHome(rested)).toBe(rested);
    const unhurt = { ...broke, health: undefined };
    expect(sleepAtHome(unhurt)).toBe(unhurt);
  });
});
