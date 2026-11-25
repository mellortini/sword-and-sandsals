import { describe, expect, it } from 'vitest';
import { createCombat, getActionOptions, getAttackZoneOptions } from '../core/combat';
import type { AimInfo } from './aimRules';
import { aimDescription, aimedChance, aimedCommand } from './aimRules';

const state = createCombat(4, { position: 9 }, { position: 10, equipment: { helmet: 3, greaves: 2 } });
const info: AimInfo = {
  zones: (['quick', 'normal', 'power'] as const).flatMap((a) => getAttackZoneOptions(state, a)),
  armour: state.fighters.enemy.armourByZone,
};
const normal = getActionOptions(state).find((o) => o.action === 'normal')!;

describe('aiming rules', () => {
  it('sends an aimed attack only when a zone is chosen and the core offers it', () => {
    expect(aimedCommand('normal', 'body', info)).toBe('normal');
    expect(aimedCommand('normal', 'head', info)).toEqual({ action: 'normal', zone: 'head' });
    expect(aimedCommand('block', 'head', info)).toBe('block');
    expect(aimedCommand('normal', 'legs', { ...info, zones: [] })).toBe('normal');
  });

  it("shows the zone's hit chance on the card", () => {
    const head = info.zones.find((z) => z.action === 'normal' && z.zone === 'head')!.hitChance;
    expect(aimedChance('normal', normal, 'head', info)).toBe(head);
    expect(head).toBeLessThan(normal.hitChance!);
    expect(aimedChance('normal', normal, 'body', info)).toBe(normal.hitChance);
    expect(aimedChance('normal', undefined, 'head', info)).toBeUndefined();
  });

  it("names the opponent's armour on the zone", () => {
    expect(aimDescription('legs', info)).toBe(`A hit slows the opponent down. Opponent's leg armour: ${info.armour.legs}.`);
    expect(aimDescription('body', info)).toBe('An ordinary blow that meets all of the armour.');
  });
});
