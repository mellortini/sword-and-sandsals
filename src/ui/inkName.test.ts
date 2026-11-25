import { describe, expect, it } from 'vitest';
import { inkDiff, isSmudge } from './inkName';
import { cleanName, nameProblem } from './creatorRules';

describe('ink name', () => {
  it('finds the letters just written', () => {
    expect(inkDiff('', 'V')).toEqual({ prefix: 0, suffix: 0, fresh: 1 });
    expect(inkDiff('Varr', 'Varro')).toEqual({ prefix: 4, suffix: 0, fresh: 1 });
    expect(inkDiff('Vro', 'Varro')).toEqual({ prefix: 1, suffix: 2, fresh: 2 });
    expect(inkDiff('Varro', 'Varo')).toEqual({ prefix: 3, suffix: 1, fresh: 0 });
    expect(inkDiff('Varro', 'Fold')).toEqual({ prefix: 0, suffix: 0, fresh: 4 });
  });

  it('counts Polish letters as one letter each', () => {
    expect(inkDiff('Łu', 'Łucja Zgięta')).toEqual({ prefix: 2, suffix: 0, fresh: 10 });
    expect(inkDiff('Zgita', 'Zgięta')).toEqual({ prefix: 3, suffix: 2, fresh: 1 });
  });

  it('smudges what a name cannot hold', () => {
    for (const l of ['ą', 'Ł', 'ż', "'", '-', ' ']) expect(isSmudge(l)).toBe(false);
    for (const l of ['2', '!', '@']) expect(isSmudge(l)).toBe(true);
  });

  it('accepts decomposed Polish letters', () => {
    const decomposed = 'Zgięta';
    expect(cleanName(decomposed)).toBe('Zgięta');
    expect(nameProblem(decomposed)).toBeNull();
  });
});
