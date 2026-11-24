import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('text size', () => {
  beforeEach(() => {
    vi.resetModules();
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => { store.set(k, v); },
    });
  });

  it('starts at Normal and cycles through the sizes, remembering the choice', async () => {
    const t = await import('./textSize');
    expect(t.textSizeIndex()).toBe(0);
    expect(t.textScale()).toBe(1);
    expect(t.cycleTextSize()).toBe(1);
    expect(t.cycleTextSize()).toBe(2);
    expect(t.cycleTextSize()).toBe(0);
    expect(t.cycleTextSize(-1)).toBe(2);
    vi.resetModules();
    expect((await import('./textSize')).textScale()).toBe(1.3);
  });

  it('ignores a broken saved value', async () => {
    localStorage.setItem('folded-glory.text-size', '7');
    expect((await import('./textSize')).textSizeIndex()).toBe(0);
  });
});
