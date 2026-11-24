import { expect, it } from 'vitest';
import { SKILL_TREES } from '../data/skills';
import { applyCombatStatus, createCombat, getActionOptions, getCombatSlotOptions, performAction } from './combat';
import { deserializeSave, serializeSave } from './save';
import type { SavedCharacter } from './save';
import { unlockSkill } from './skills';
import { resolveAttributes } from './stats';

const character: SavedCharacter = {
  name: 'Aelia', level: 6, experience: 0, gold: 50, skillPoints: 2, attributes: resolveAttributes(), inventory: [],
  look: { skin: 3, face: 0, hair: 1, hairColor: 1, beard: 2, helmet: 0, armor: 0, shoulders: 0, greaves: 0, boots: 0, weapon: 'gladius' },
};

it('has four distinct combat effects per school', () => {
  const baseline = createCombat(1).fighters.player;
  expect(SKILL_TREES).toHaveLength(6);
  const ids = new Set<string>();
  for (const tree of SKILL_TREES) {
    expect(tree.skills).toHaveLength(4);
    for (const { id, bonus } of tree.skills) {
      expect(ids.has(id)).toBe(false);
      ids.add(id);
      const player = createCombat(1, { skills: [id] }).fighters.player;
      switch (bonus.kind) {
        case 'attribute': expect(player.attributes[bonus.key]).toBe(baseline.attributes[bonus.key] + bonus.points); break;
        case 'stat': expect(player.stats[bonus.key]).toBe(baseline.stats[bonus.key] + bonus.points); break;
        case 'resistance': expect(player.statusResistances[bonus.key]).toBe(bonus.points); break;
        case 'rule': expect(player.skillRules[bonus.key]).toBe(bonus.points); break;
      }
    }
  }
});

it('requires previous skills and points, and round-trips unlocked selections', () => {
  expect(unlockSkill(character, 'riposte')).toMatchObject({ ok: false, reason: 'prerequisite' });
  const first = unlockSkill(character, 'keen-edge');
  expect(first).toMatchObject({ ok: true, character: { skillPoints: 1, skills: ['keen-edge'] } });
  expect(unlockSkill(first.character, 'keen-edge')).toMatchObject({ ok: false, reason: 'already-learned' });
  const second = unlockSkill(first.character, 'measured-strike');
  expect(unlockSkill(second.character, 'riposte')).toMatchObject({ ok: false, reason: 'insufficient-points' });
  expect(deserializeSave(serializeSave(second.character))).toEqual({ ok: true, character: second.character });
});

it('applies learned rules to real movement, spells, resistance, counters and the crowd', () => {
  const initial = createCombat(12, {
    position: 4, skills: ['economy-of-motion', 'focused-casting', 'opening-act', 'unshaken', 'riposte'],
    slots: [{ id: 'ember' }, null, null, null],
  }, { position: 6 });
  expect(initial.fighters.player.crowd.favour).toBe(58);
  expect(getActionOptions(initial)).toContainEqual({ action: 'step_forward', energyCost: 0 });
  expect(getCombatSlotOptions(initial)[0].energyCost).toBe(7);
  expect(applyCombatStatus(initial, 'player', 'stunned')).toBe(initial);
  const guard = performAction(initial, 'block').state;
  const blocked = performAction(guard, 'normal');
  expect(blocked.state.fighters.player.counterReady).toBe(true);
});

it('uses the armour bonus against aimed strikes and multiplies charge damage', () => {
  const player = { position: 4 };
  const enemy = { position: 5 };
  const normal = performAction(createCombat(1, player, enemy), { action: 'normal', zone: 'head' });
  const plated = performAction(createCombat(1, player, { ...enemy, skills: ['layered-guard'] }), { action: 'normal', zone: 'head' });
  expect(plated.state.fighters.enemy.health).toBeGreaterThan(normal.state.fighters.enemy.health);
  const charge = performAction(createCombat(1, player, { position: 8 }), 'charge');
  const predator = performAction(createCombat(1, { ...player, skills: ['predator-charge'] }, { position: 8 }), 'charge');
  expect(predator.state.fighters.enemy.health).toBeLessThan(charge.state.fighters.enemy.health);
});

it('combines a saved health value with skill-adjusted maximum health', () => {
  const combat = createCombat(1, { health: 70, skills: ['wild-vigour'] });
  expect(combat.fighters.player).toMatchObject({ health: 70, stats: { maxHealth: 76 }, consecutiveMisses: 0 });
  const previousSave = createCombat(1, { skills: ['wild-vigour'] });
  expect(previousSave.fighters.player.health).toBe(76);
});
