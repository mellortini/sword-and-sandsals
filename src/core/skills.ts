import { SKILL_TREES } from '../data/skills';
import type { SkillId, SkillRule } from '../data/skills';
import type { SavedCharacter } from './save';
import type { StatusKind } from './status';
import type { Attributes, FighterStats } from './types';

type Skill = (typeof SKILL_TREES)[number]['skills'][number];
export type SkillRules = Readonly<Record<SkillRule, number>>;

const SKILLS = new Map<string, { skill: Skill; prerequisite?: SkillId }>();
for (const tree of SKILL_TREES) {
  tree.skills.forEach((skill, index) => SKILLS.set(skill.id, { skill, prerequisite: tree.skills[index - 1]?.id }));
}

export function isSkillId(id: unknown): id is SkillId {
  return typeof id === 'string' && SKILLS.has(id);
}

type SkillUnlock =
  | { ok: true; character: SavedCharacter }
  | { ok: false; character: SavedCharacter; reason: 'unknown-skill' | 'already-learned' | 'prerequisite' | 'insufficient-points' };

export function unlockSkill(character: SavedCharacter, id: SkillId): SkillUnlock {
  const entry = SKILLS.get(id);
  if (!entry) return { ok: false, character, reason: 'unknown-skill' };
  const skills = character.skills ?? [];
  if (skills.includes(id)) return { ok: false, character, reason: 'already-learned' };
  if (entry.prerequisite && !skills.includes(entry.prerequisite)) return { ok: false, character, reason: 'prerequisite' };
  const points = character.skillPoints ?? 0;
  if (points < 1) return { ok: false, character, reason: 'insufficient-points' };
  return { ok: true, character: { ...character, skills: [...skills, id], skillPoints: points - 1 } };
}

export function skillBonuses(skills: readonly SkillId[] = []) {
  const attributes: Partial<Attributes> = {};
  const stats: Partial<FighterStats> = {};
  const resistance: Partial<Record<StatusKind, number>> = {};
  const rules = { moveDiscount: 0, spellDiscount: 0, counterBonus: 0, crowdStart: 0, chargePower: 0 };
  for (const id of new Set(skills)) {
    const bonus = SKILLS.get(id)?.skill.bonus;
    if (!bonus) continue;
    switch (bonus.kind) {
      case 'attribute': attributes[bonus.key] = (attributes[bonus.key] ?? 0) + bonus.points; break;
      case 'stat': stats[bonus.key] = (stats[bonus.key] ?? 0) + bonus.points; break;
      case 'resistance': resistance[bonus.key] = (resistance[bonus.key] ?? 0) + bonus.points; break;
      case 'rule': rules[bonus.key] += bonus.points; break;
    }
  }
  return { attributes, stats, resistance, rules };
}
