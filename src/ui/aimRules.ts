import type { AttackZoneOption, HitZone, TargetedAttack, ZonedArmour } from '../core/hitZones';
import type { ActionOption, AttackKind, CombatAction } from '../core/types';

/** Where the player aims (#195): `body` is an ordinary, unaimed attack. */
export type Aim = HitZone | 'body';
export const AIMS: readonly Aim[] = ['body', 'head', 'torso', 'legs'];

/** What the action bar needs to aim: the core's zone options for this turn and the opponent's armour per zone. */
export interface AimInfo {
  readonly zones: readonly AttackZoneOption[];
  readonly armour: ZonedArmour;
}

const AIMED: readonly CombatAction[] = ['quick', 'normal', 'power'];

export const AIM_INFO: Readonly<Record<Aim, { label: string; key: string; effect: string }>> = {
  body: { label: 'Body', key: 'B', effect: 'An ordinary blow that meets all of the armour.' },
  head: { label: 'Head', key: 'H', effect: 'Hard to hit. A critical hit stuns.' },
  torso: { label: 'Torso', key: 'T', effect: 'Meets only the chest and shoulder armour.' },
  legs: { label: 'Legs', key: 'L', effect: 'A hit slows the opponent down.' },
};

/** The command an attack card sends: aimed at a zone when one is chosen and the core offers it, plain otherwise. */
export function aimedCommand(action: CombatAction, aim: Aim, info?: AimInfo): CombatAction | TargetedAttack {
  if (aim === 'body' || !AIMED.includes(action)) return action;
  const option = info?.zones.find((z) => z.action === action && z.zone === aim);
  return option ? { action: action as AttackKind, zone: aim } : action;
}

/** Hit chance a card shows: the zone's chance when aiming, else the plain one. */
export function aimedChance(action: CombatAction, option: ActionOption | undefined, aim: Aim, info?: AimInfo): number | undefined {
  if (!option) return undefined;
  if (aim === 'body' || !AIMED.includes(action)) return option.hitChance;
  return info?.zones.find((z) => z.action === action && z.zone === aim)?.hitChance ?? option.hitChance;
}

/** Tooltip text of an aim button, e.g. "A hit slows the opponent down. Opponent's leg armour: 4." */
export function aimDescription(aim: Aim, info?: AimInfo): string {
  const { effect } = AIM_INFO[aim];
  if (aim === 'body' || !info) return effect;
  const part = { head: 'head', torso: 'torso', legs: 'leg' }[aim];
  return `${effect} Opponent's ${part} armour: ${info.armour[aim]}.`;
}
