import { describe, expect, it } from 'vitest';
import { newCharacter, randomSpread } from './creatorRules';
import { titleEntries } from './titleRules';

const fresh = () => newCharacter('Varro', { skin: 0, face: 0, hair: 0, hairColor: 0, beard: 0, build: 0 }, randomSpread(() => 0.5));

describe('titleEntries', () => {
  it('has no Continue without a saved gladiator', () => {
    expect(titleEntries(null).map((e) => e.id)).toEqual(['new', 'settings', 'credits']);
  });

  it('puts Continue first and names the gladiator', () => {
    const entries = titleEntries(fresh());
    expect(entries.map((e) => e.id)).toEqual(['continue', 'new', 'settings', 'credits']);
    expect(entries[0].note).toBe('Varro · level 1');
  });

  it('sends a fresh gladiator to the first bout and a seasoned one to town', () => {
    expect(titleEntries(fresh())[0].view).toBe('prefight');
    expect(titleEntries({ ...fresh(), experience: 10 })[0].view).toBe('town');
  });

  it('sends a gladiator with a waiting nemesis to the feud', () => {
    const nemesis = {} as NonNullable<ReturnType<typeof fresh>['nemesis']>;
    expect(titleEntries({ ...fresh(), experience: 10, nemesis })[0].view).toBe('prefight');
  });
});
