import { describe, expect, it } from 'vitest';
import { firstEnabled, moveSelection } from './menuNav';

const menu = (...enabled: boolean[]) => enabled.map((e, i) => ({ label: `item ${i}`, enabled: e }));

describe('menu navigation', () => {
  it('starts on the first enabled entry', () => {
    expect(firstEnabled(menu(false, false, true, true))).toBe(2);
    expect(firstEnabled(menu(false, false))).toBe(-1);
  });

  it('skips disabled entries and wraps around', () => {
    const m = menu(false, false, true, true);
    expect(moveSelection(m, 2, 1)).toBe(3);
    expect(moveSelection(m, 3, 1)).toBe(2);
    expect(moveSelection(m, 2, -1)).toBe(3);
  });

  it('stays put when nothing else can be chosen', () => {
    expect(moveSelection(menu(false, true, false), 1, 1)).toBe(1);
    expect(moveSelection(menu(true), 0, -1)).toBe(0);
  });
});
