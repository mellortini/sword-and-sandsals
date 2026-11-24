import { describe, expect, it } from 'vitest';
import { MAX_LEVEL, experienceForLevel } from '../core/progression';
import { serializeSave } from '../core/save';
import type { SavedCharacter } from '../core/save';
import { resolveAttributes } from '../core/stats';
import { DEFAULT_LOOK } from '../rig/PaperRig';
import {
  addPoint, applyFightExperience, canTakeBack, commitPoints, levelsGained, placedPoints, startDraft, takeBackPoint, xpStanding, xpSweeps,
} from './levelUpRules';

const hero = (patch: Partial<SavedCharacter> = {}): SavedCharacter => ({
  name: 'Hero', level: 1, experience: 0, gold: 50, attributes: resolveAttributes(), look: { ...DEFAULT_LOOK }, inventory: [], ...patch,
});

describe('xpStanding', () => {
  it('measures the way through the current level', () => {
    const span = experienceForLevel(2) - experienceForLevel(1);
    expect(xpStanding(1, 0)).toEqual({ level: 1, into: 0, span, fraction: 0 });
    expect(xpStanding(1, span / 2).fraction).toBeCloseTo(0.5);
    const l5 = experienceForLevel(5);
    expect(xpStanding(5, l5).into).toBe(0);
  });

  it('shows a full bar at the top level', () => {
    expect(xpStanding(MAX_LEVEL, experienceForLevel(MAX_LEVEL))).toMatchObject({ level: MAX_LEVEL, fraction: 1 });
  });
});

describe('xpSweeps', () => {
  it('is one sweep without a level-up', () => {
    expect(xpSweeps({ level: 1, experience: 10 }, { level: 1, experience: 60 })).toEqual([
      { level: 1, from: 0.1, to: 0.6, levelUp: false },
    ]);
  });

  it('fills the bar once per level crossed, then the remainder', () => {
    const at = (level: number, extra: number) => ({ level, experience: experienceForLevel(level) + extra });
    const sweeps = xpSweeps(at(1, 50), at(3, 0));
    expect(sweeps.map((s) => [s.level, s.levelUp])).toEqual([[1, true], [2, true]]);
    expect(sweeps[0].from).toBeCloseTo(0.5);
    expect(sweeps[1].from).toBe(0);
    const more = xpSweeps(at(1, 0), at(2, 20));
    expect(more).toHaveLength(2);
    expect(more[1]).toMatchObject({ level: 2, from: 0, levelUp: false });
  });
});

describe('applyFightExperience', () => {
  it('levels up through the core and grants points that can be saved', () => {
    const p = applyFightExperience(hero(), 120);
    expect(levelsGained(p)).toBe(1);
    expect(p.after).toMatchObject({ level: 2, experience: 120, attributePoints: 5 });
    expect(p.before.level).toBe(1);
    expect(() => serializeSave(p.after)).not.toThrow();
  });

  it('keeps the level after a small win', () => {
    const p = applyFightExperience(hero(), 30);
    expect(levelsGained(p)).toBe(0);
    expect(p.after.experience).toBe(30);
  });
});

describe('point draft', () => {
  it('spends and takes back only this visit\'s points', () => {
    const character = hero({ level: 2, experience: 120, attributePoints: 2 });
    let d = startDraft(character);
    expect(canTakeBack(d, 'might')).toBe(false);
    d = addPoint(addPoint(addPoint(d, 'might'), 'might'), 'agility');
    expect(d.attributes.might).toBe(7);
    expect(d.attributes.agility).toBe(5);
    expect(d.free).toBe(0);
    d = takeBackPoint(d, 'might');
    d = takeBackPoint(takeBackPoint(d, 'might'), 'might');
    expect(d.attributes.might).toBe(5);
    expect(placedPoints(d)).toBe(0);
  });

  it('keeps unplaced points for later', () => {
    const character = hero({ level: 2, experience: 120, attributePoints: 5 });
    const saved = commitPoints(character, addPoint(startDraft(character), 'vitality'));
    expect(saved.attributes.vitality).toBe(6);
    expect(saved.attributePoints).toBe(4);
    expect(() => serializeSave(saved)).not.toThrow();
  });
});
