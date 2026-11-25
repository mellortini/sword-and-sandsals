import type { StatusKind } from '../core/status';
import type { Attributes, FighterStats } from '../core/types';

export type SkillRule = 'moveDiscount' | 'spellDiscount' | 'counterBonus' | 'crowdStart' | 'chargePower';

type SkillBonus =
  | { kind: 'attribute'; key: keyof Attributes; points: number }
  | { kind: 'stat'; key: keyof FighterStats; points: number }
  | { kind: 'resistance'; key: StatusKind; points: number }
  | { kind: 'rule'; key: SkillRule; points: number };

function skill<const Id extends string>(id: Id, name: string, description: string, bonus: SkillBonus) {
  return { id, name, description, bonus };
}

export const SKILL_TREES = [
  { name: 'Blademaster', skills: [
    skill('keen-edge', 'Keen Edge', '+2 attack power.', { kind: 'stat', key: 'attackPower', points: 2 }),
    skill('measured-strike', 'Measured Strike', '+5 points of attack accuracy.', { kind: 'stat', key: 'accuracyBonus', points: 5 }),
    skill('riposte', 'Riposte', '+10 points to counter chance after a successful block.', { kind: 'rule', key: 'counterBonus', points: 10 }),
    skill('deadly-edge', 'Deadly Edge', '+5 points to critical chance.', { kind: 'stat', key: 'criticalChance', points: 5 }),
  ] },
  { name: 'Bulwark', skills: [
    skill('brace', 'Brace', '+7 points to block chance.', { kind: 'stat', key: 'blockChance', points: 7 }),
    skill('layered-guard', 'Layered Guard', '+4 armour, including aimed attacks.', { kind: 'stat', key: 'armour', points: 4 }),
    skill('iron-heart', 'Iron Heart', '+10 maximum health.', { kind: 'stat', key: 'maxHealth', points: 10 }),
    skill('unshaken', 'Unshaken', 'Immune to stun.', { kind: 'resistance', key: 'stunned', points: 100 }),
  ] },
  { name: 'Acrobat', skills: [
    skill('fleet-footed', 'Fleet-Footed', '+2 Agility in battle.', { kind: 'attribute', key: 'agility', points: 2 }),
    skill('long-leap', 'Long Leap', '+0.6 jump distance.', { kind: 'stat', key: 'jumpDistance', points: 0.6 }),
    skill('economy-of-motion', 'Economy of Motion', 'Movement costs one less energy.', { kind: 'rule', key: 'moveDiscount', points: 1 }),
    skill('evasive-roll', 'Evasive Roll', '+6 points of evasion.', { kind: 'stat', key: 'evasionBonus', points: 6 }),
  ] },
  { name: 'Showman', skills: [
    skill('stage-presence', 'Stage Presence', '+3 Charm in battle.', { kind: 'attribute', key: 'charm', points: 3 }),
    skill('opening-act', 'Opening Act', 'Start with eight extra crowd favour.', { kind: 'rule', key: 'crowdStart', points: 8 }),
    skill('cutting-wit', 'Cutting Wit', 'Taunts lower enemy accuracy by four extra points.', { kind: 'stat', key: 'tauntPenalty', points: 4 }),
    skill('stage-courage', 'Stage Courage', 'Resist 60% of fear duration.', { kind: 'resistance', key: 'feared', points: 60 }),
  ] },
  { name: 'Inkmage', skills: [
    skill('ink-study', 'Ink Study', '+2 Arcana in battle.', { kind: 'attribute', key: 'arcana', points: 2 }),
    skill('deep-ink', 'Deep Ink', '+4 spell power.', { kind: 'stat', key: 'spellPower', points: 4 }),
    skill('focused-casting', 'Focused Casting', 'Spells cost one less energy.', { kind: 'rule', key: 'spellDiscount', points: 1 }),
    skill('firebreak', 'Firebreak', 'Resist 35% of burning duration.', { kind: 'resistance', key: 'burning', points: 35 }),
  ] },
  { name: 'Beastmaster', skills: [
    skill('wild-vigour', 'Wild Vigour', '+6 maximum health.', { kind: 'stat', key: 'maxHealth', points: 6 }),
    skill('den-rest', 'Den Rest', 'Recover three extra energy from Rest.', { kind: 'stat', key: 'restRecovery', points: 3 }),
    skill('predator-charge', 'Predator Charge', '+15% charge damage.', { kind: 'rule', key: 'chargePower', points: 15 }),
    skill('sure-paws', 'Sure Paws', 'Immune to slowing effects from leg hits.', { kind: 'resistance', key: 'slowed', points: 100 }),
  ] },
] as const;

export type SkillId = (typeof SKILL_TREES)[number]['skills'][number]['id'];
