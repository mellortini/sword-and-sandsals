import { afterEach, describe, expect, it, vi } from 'vitest';
import { SAMPLES, blowSound } from './foley';
import { SEVER_FILES, SEVER_GAIN, pickVariant, playSever } from './sever';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

/** a Web Audio stand-in that remembers which recording was started and where it was plugged in */
async function fakeAudio() {
  const started: { file: string; bus: unknown; gain: number }[] = [];
  const clock = { currentTime: 0 };
  const foley = {};
  vi.doMock('./mixer', () => ({
    getMixer: () => ({
      foley,
      ctx: {
        state: 'running',
        get currentTime() { return clock.currentTime; },
        decodeAudioData: async (data: ArrayBuffer) => new TextDecoder().decode(data),
        createBufferSource() {
          type Gain = { gain: { value: number }; bus: unknown };
          const src: { buffer: string; playbackRate: { value: number }; out: Gain | null; connect(node: Gain): object; start(): void } = {
            buffer: '', playbackRate: { value: 1 }, out: null,
            connect(node) { src.out = node; return { connect: (bus: unknown) => { node.bus = bus; } }; },
            start() { started.push({ file: src.buffer, bus: src.out!.bus, gain: src.out!.gain.value }); },
          };
          return src;
        },
        createGain: () => ({ gain: { value: 1 }, bus: null }),
      },
    }),
  }));
  vi.stubGlobal('fetch', async (url: string) => ({ ok: true, arrayBuffer: async () => new TextEncoder().encode(url).buffer }));
  const { playSever: play } = await import('./sever');
  const settle = () => new Promise((r) => setTimeout(r, 0));
  return { play, started, clock, foley, settle };
}

describe('weapon on a shield', () => {
  it('has its recording among the assets, played quietly', () => {
    const onDisk = Object.keys(import.meta.glob('../../assets/sfx/combat/*.wav'));
    const { file, gain } = SAMPLES.block!;
    expect(onDisk).toContain(`../../assets/${file}`);
    expect(gain).toBeLessThanOrEqual(0.4);
  });

  it('is heard only when a shield took the blow: the blade alone parries with another sound', () => {
    const blocked = { hit: true, blocked: true, crit: false };
    expect(blowSound({ ...blocked, shield: { from: 40, to: 31 } }, 'sword')).toBe('block');
    expect(blowSound({ ...blocked, shield: { from: 6, to: 0 } }, 'axe')).toBe('block');
    expect(blowSound(blocked, 'sword')).toBe('parry');
    expect(SAMPLES.parry).toBeUndefined();
  });
});

describe('sword blow', () => {
  const landed = { hit: true, blocked: false, crit: false };

  it('plays the recording only when a sword lands on the fighter', () => {
    expect(blowSound(landed, 'sword')).toBe('sword_hit');
    expect(blowSound({ ...landed, crit: true }, 'sword')).toBe('sword_crit');
    expect(blowSound({ ...landed, blocked: true }, 'sword')).toBe('parry');
    expect(blowSound({ ...landed, hit: false }, 'sword')).toBe('miss');
    for (const family of ['axe', 'spear', 'hammer', 'daggers', undefined]) expect(blowSound(landed, family)).toBe('hit');
  });

  it('has its recording among the assets', () => {
    const onDisk = Object.keys(import.meta.glob('../../assets/sfx/combat/*.wav'));
    expect(onDisk).toContain(`../../assets/${SAMPLES.sword_hit!.file}`);
  });
});

describe('sever sounds', () => {
  it('has three recordings among the assets', () => {
    expect(new Set(SEVER_FILES).size).toBe(3);
    // only the names are read: CI checks out without Git LFS
    const onDisk = Object.keys(import.meta.glob('../../assets/sfx/gore/*.wav'));
    for (const f of SEVER_FILES) expect(onDisk).toContain(`../../assets/${f}`);
  });

  it('never repeats the previous variant and reaches all of them', () => {
    for (let previous = 0; previous < 3; previous++) {
      const picked = new Set([0, 0.49, 0.5, 0.999].map((r) => pickVariant(3, previous, () => r)));
      expect(picked.has(previous)).toBe(false);
      expect(picked.size).toBe(2);
    }
    expect([0, 0.4, 0.999].map((r) => pickVariant(3, -1, () => r))).toEqual([0, 1, 2]);
  });

  it('plays quietly on the foley bus (so the saved volumes apply), a different recording each cut', async () => {
    const { play, started, clock, foley, settle } = await fakeAudio();
    for (let i = 0; i < 6; i++) {
      clock.currentTime = i;
      play('shreds');
      await settle();
    }
    expect(started).toHaveLength(6);
    for (let i = 1; i < 6; i++) expect(started[i].file).not.toBe(started[i - 1].file);
    for (const s of started) {
      expect(s.bus).toBe(foley);
      expect(s.gain).toBe(SEVER_GAIN);
    }
    expect(SEVER_GAIN).toBeLessThanOrEqual(0.4);
  });

  it('is silent with gore off, also when that is the saved setting', async () => {
    vi.stubGlobal('localStorage', { getItem: () => 'off', setItem: () => {} });
    const { play, started, settle } = await fakeAudio();
    play();
    play('off');
    await settle();
    expect(started).toHaveLength(0);
    play('ink');
    await settle();
    expect(started).toHaveLength(1);
  });

  it('two cuts on one frame make one sound', async () => {
    const { play, started, settle } = await fakeAudio();
    play('shreds');
    play('shreds');
    await settle();
    expect(started).toHaveLength(1);
  });

  it('is silent without Web Audio instead of throwing', () => {
    expect(() => playSever('shreds')).not.toThrow();
  });
});
