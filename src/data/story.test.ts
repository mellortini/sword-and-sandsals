import { describe, expect, it } from 'vitest';
import { PULPPORT_LEAGUES } from './leagues';
import { ACT1, PROLOGUE, readingTime, sceneAfter } from './story';

// the pictures in the repo (vite resolves the pattern at build time; only the file names matter here)
const pictures = Object.keys(import.meta.glob('../../assets/story/*.jpg')).map((p) => p.replace('../../assets/', ''));

describe('act 1 story scenes (#64)', () => {
  it('has five scenes, one after each league champion of Pulpport', () => {
    expect(ACT1).toHaveLength(5);
    const champions = Object.values(PULPPORT_LEAGUES).flatMap((bouts) => bouts.filter((b) => b.champion).map((b) => b.id));
    expect(ACT1.map((s) => s.after).sort()).toEqual([...champions].sort());
    for (const id of champions) expect(sceneAfter(id)?.after).toBe(id);
    expect(sceneAfter('not-a-bout')).toBeUndefined();
  });

  it('shows pictures that exist, with lines to read', () => {
    for (const scene of ACT1) {
      expect(scene.shots.length, scene.id).toBeGreaterThanOrEqual(2);
      for (const shot of scene.shots) {
        expect(pictures, shot.image).toContain(shot.image);
        expect(shot.lines.length).toBeGreaterThan(0);
        expect((shot.voice ?? []).length).toBeLessThanOrEqual(shot.lines.length);
        for (const l of shot.lines) expect(l.length).toBeLessThan(140);   // one subtitle strip
      }
    }
  });

  it('has a new-game intro with pictures and a recording for every line (#322)', () => {
    const voices = Object.keys(import.meta.glob('../../assets/story/voice/*.mp3')).map((p) => p.replace('../../assets/', ''));
    expect(PROLOGUE.shots).toHaveLength(5);
    for (const shot of PROLOGUE.shots) {
      expect(pictures, shot.image).toContain(shot.image);
      expect(shot.voice).toHaveLength(shot.lines.length);
      for (const v of shot.voice ?? []) expect(voices, v).toContain(v);
      for (const l of shot.lines) expect(l.length).toBeLessThan(140);
    }
    expect(PROLOGUE.shots.at(-1)?.lines.at(-1)).toMatch(/Name/);   // hands over to the creator
  });

  it('keeps a subtitle long enough to read, never forever', () => {
    expect(readingTime('Fire.')).toBeGreaterThanOrEqual(2.4);
    expect(readingTime('a '.repeat(60))).toBeLessThanOrEqual(7);
    expect(readingTime('one two three four five six seven eight')).toBeGreaterThan(readingTime('one two'));
  });
});
