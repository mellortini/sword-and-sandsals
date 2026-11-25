import { describe, expect, it } from 'vitest';
import type { SavedCharacter } from '../core/save';
import { resolveAttributes } from '../core/stats';
import { commitSkills, skillState, skillsLeft, startSkillDraft, toggleSkill } from './skillTreeRules';

const varro: SavedCharacter = {
  name: 'Varro', level: 6, experience: 0, gold: 10, skillPoints: 2, skills: ['brace'], attributes: resolveAttributes(), inventory: [],
  look: { skin: 3, face: 0, hair: 1, hairColor: 1, beard: 2, helmet: 0, armor: 0, shoulders: 0, greaves: 0, boots: 0, weapon: 'gladius' },
};

describe('skill tree draft', () => {
  it('opens the first skill of each tree and the one under a learned skill', () => {
    const d = startSkillDraft(varro);
    expect(skillState(d, 'brace')).toBe('learned');
    expect(skillState(d, 'layered-guard')).toBe('open');
    expect(skillState(d, 'iron-heart')).toBe('locked');
    expect(skillState(d, 'keen-edge')).toBe('open');
    expect(skillState(d, 'riposte')).toBe('locked');
  });

  it('picks down a chain while points last and puts back a skill with the ones below it', () => {
    let d = startSkillDraft(varro);
    d = toggleSkill(d, 'keen-edge');
    expect(skillState(d, 'measured-strike')).toBe('open');
    d = toggleSkill(d, 'measured-strike');
    expect(skillsLeft(d)).toBe(0);
    expect(toggleSkill(d, 'layered-guard')).toBe(d);
    expect(toggleSkill(d, 'iron-heart')).toBe(d);
    d = toggleSkill(d, 'keen-edge');
    expect(d.picked).toEqual([]);
    expect(skillsLeft(d)).toBe(2);
  });

  it('learns the picked skills through the core and spends the points', () => {
    let d = startSkillDraft(varro);
    d = toggleSkill(toggleSkill(d, 'layered-guard'), 'iron-heart');
    expect(commitSkills(varro, d)).toMatchObject({ skills: ['brace', 'layered-guard', 'iron-heart'], skillPoints: 0 });
    expect(startSkillDraft({ ...varro, skills: undefined, skillPoints: undefined })).toEqual({ learned: [], picked: [], points: 0 });
  });
});
