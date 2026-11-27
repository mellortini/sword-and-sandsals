import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

const storage = (initial: Record<string, string> = {}) => {
  const data = { ...initial };
  vi.stubGlobal('localStorage', { getItem: (k: string) => data[k] ?? null, setItem: (k: string, v: string) => { data[k] = v; } });
  return data;
};

describe('gore setting (#20)', () => {
  it('defaults to paper shreds and ignores a broken saved value', async () => {
    storage({ 'folded-glory.gore': 'buckets' });
    const { goreMode } = await import('./gore');
    expect(goreMode()).toBe('shreds');
  });

  it('cycles through the modes, saves them and picks the matching clip', async () => {
    const data = storage();
    const { cycleGore, finisherClip, goreMode } = await import('./gore');
    expect([cycleGore(), cycleGore(), cycleGore()]).toEqual(['ink', 'off', 'shreds']);
    expect(cycleGore(-1)).toBe('off');
    expect(data['folded-glory.gore']).toBe('off');
    expect(finisherClip(goreMode())).toBe('finish_fold');
    expect(finisherClip('ink')).toBe('finish_decap');
  });

  it('works when storage is blocked', async () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } });
    const { goreMode, setGoreMode } = await import('./gore');
    expect(goreMode()).toBe('shreds');
    setGoreMode('off');
    expect(goreMode()).toBe('off');
  });
});
