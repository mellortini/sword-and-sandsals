import { describe, expect, it } from 'vitest';
import { ALL_CLIPS } from '../anim/clips';
import { EVENT_SOUNDS, RECIPES, playFoley } from './foley';
import { DEFAULT_VOLUMES, parseVolumes } from './volume';

describe('volume settings (#18)', () => {
  it('falls back to quiet defaults for missing or broken saves', () => {
    expect(parseVolumes(null)).toEqual(DEFAULT_VOLUMES);
    expect(parseVolumes('not json')).toEqual(DEFAULT_VOLUMES);
    expect(parseVolumes('[1,2]')).toEqual(DEFAULT_VOLUMES);
    for (const v of Object.values(DEFAULT_VOLUMES)) expect(v).toBeLessThanOrEqual(0.8);
  });

  it('keeps saved channels and clamps them to 0..1', () => {
    expect(parseVolumes('{"master":0.3,"foley":7,"crowd":-1}')).toEqual({ ...DEFAULT_VOLUMES, master: 0.3, foley: 1, crowd: 0 });
    expect(parseVolumes('{"master":"loud"}').master).toBe(DEFAULT_VOLUMES.master);
  });
});

describe('paper foley (#18)', () => {
  it('stays quiet and short: no layer louder than 0.6 or longer than 0.4 s', () => {
    for (const [sound, layers] of Object.entries(RECIPES)) {
      expect(layers.length, sound).toBeGreaterThan(0);
      for (const l of layers) {
        expect(l.gain, sound).toBeLessThanOrEqual(0.6);
        expect(l.dur + (l.delay ?? 0), sound).toBeLessThanOrEqual(0.4);
      }
    }
  });

  it('footsteps are the quietest sound, a body hitting the sand the heaviest', () => {
    const peak = (s: keyof typeof RECIPES) => Math.max(...RECIPES[s].map((l) => l.gain));
    for (const s of Object.keys(RECIPES) as (keyof typeof RECIPES)[]) expect(peak('step')).toBeLessThanOrEqual(peak(s));
    expect(peak('impact')).toBeGreaterThan(peak('hit'));
  });

  it('every event that makes a sound is fired by some clip, and the walks have footsteps', () => {
    const fired = new Set(ALL_CLIPS.flatMap((c) => c.events ?? []).map((e) => e.type));
    for (const type of Object.keys(EVENT_SOUNDS)) expect(fired).toContain(type);
    for (const name of ['walk_fwd', 'walk_back']) {
      expect(ALL_CLIPS.find((c) => c.name === name)!.events?.filter((e) => e.type === 'step')).toHaveLength(2);
    }
  });

  it('is silent without Web Audio (tests, old browsers) instead of throwing', () => {
    expect(() => playFoley('hit')).not.toThrow();
  });
});
