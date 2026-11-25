import type { SavedCharacter } from '../core/save';
import { unlockSkill } from '../core/skills';
import { SKILL_TREES } from '../data/skills';
import type { SkillId } from '../data/skills';

/** learned: saved; picked: chosen on this screen, not saved yet; open: can be picked now; locked: needs the skill above */
export type SkillState = 'learned' | 'picked' | 'open' | 'locked';

/** Skills chosen on the skill screen (#54); nothing is kept until `commitSkills`. */
export interface SkillDraft {
  readonly learned: readonly SkillId[];
  readonly picked: readonly SkillId[];
  readonly points: number;
}

export function startSkillDraft(character: SavedCharacter): SkillDraft {
  return { learned: character.skills ?? [], picked: [], points: character.skillPoints ?? 0 };
}

export const skillsLeft = (d: SkillDraft) => d.points - d.picked.length;

/** State of one skill: each tree is a chain, a skill opens once the one above it is learned or picked. */
export function skillState(d: SkillDraft, id: SkillId): SkillState {
  if (d.learned.includes(id)) return 'learned';
  if (d.picked.includes(id)) return 'picked';
  const tree = SKILL_TREES.find((t) => t.skills.some((s) => s.id === id))!;
  const index = tree.skills.findIndex((s) => s.id === id);
  const above = index > 0 ? tree.skills[index - 1].id : null;
  return above === null || d.learned.includes(above) || d.picked.includes(above) ? 'open' : 'locked';
}

/**
 * Click on a skill: an open one is picked when a point is left; a picked one is put back, with the picked skills below
 * it in the same tree (they needed it). Anything else does nothing.
 */
export function toggleSkill(d: SkillDraft, id: SkillId): SkillDraft {
  const state = skillState(d, id);
  if (state === 'open') return skillsLeft(d) > 0 ? { ...d, picked: [...d.picked, id] } : d;
  if (state !== 'picked') return d;
  const tree = SKILL_TREES.find((t) => t.skills.some((s) => s.id === id))!;
  const below = new Set<string>(tree.skills.slice(tree.skills.findIndex((s) => s.id === id)).map((s) => s.id));
  return { ...d, picked: d.picked.filter((p) => !below.has(p)) };
}

/** The character with the picked skills learned, through the core's rules (prerequisites, points). */
export function commitSkills(character: SavedCharacter, d: SkillDraft): SavedCharacter {
  let c = character;
  for (const id of d.picked) {
    const result = unlockSkill(c, id);
    if (!result.ok) throw new Error(`Cannot learn ${id}: ${result.reason}`);
    c = result.character;
  }
  return c;
}
