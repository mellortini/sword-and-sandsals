import { expect, it } from 'vitest';
import { PULPPORT_CHAMPION_WEAPON, PULPPORT_LEAGUES } from '../data/leagues';
import { WEAPONS } from '../data/weapons';
import { createCombat, performAction } from './combat';
import { enchantWeapon } from './enchant';
import { upgradeForgeItem } from './forge';
import { equipItem } from './inventory';
import { applyFightReward, getFightReward } from './rewards';
import { deserializeSave, serializeSave } from './save';
import type { SavedCharacter } from './save';
import { resolveAttributes } from './stats';
import { combatWeapon } from './weapons';

const character: SavedCharacter = {
  name: 'Aelia', level: 1, experience: 0, gold: 50, attributes: resolveAttributes(), inventory: ['armor1'],
  look: { skin: 3, face: 0, hair: 1, hairColor: 1, beard: 2, helmet: 0, armor: 0, shoulders: 0, greaves: 0, boots: 0, weapon: 'gladius' },
};

function championWin() {
  const id = PULPPORT_CHAMPION_WEAPON.id;
  const state = createCombat(1, { position: 4, level: 1, attributes: { might: 1_000 } }, { position: 5, level: 4, equipment: { weapon: id } });
  expect(state.fighters.enemy.weapon?.id).toBe(id);
  expect(getFightReward(state, 'bronze-final')).toBeUndefined();
  const finished = performAction(state, 'normal').state;
  const reward = getFightReward(finished, 'bronze-final');
  if (!reward) throw new Error('Expected a completed champion fight.');
  return reward;
}

it('awards gold, XP, forge materials and the champion prize once, including after loading', () => {
  const reward = championWin();
  expect(reward.weapon).toBe(PULPPORT_CHAMPION_WEAPON);
  const updated = applyFightReward(character, reward, true);
  expect(updated).toMatchObject({
    gold: 85, level: 2, attributePoints: 5, inventory: ['armor1', PULPPORT_CHAMPION_WEAPON.id],
    forgeMaterials: { scraps: 3, glue: 1, ink: 0, threads: 1 },
  });
  const loaded = deserializeSave(serializeSave(updated));
  if (!loaded.ok) throw new Error('Expected a valid save.');
  expect(applyFightReward(loaded.character, reward, true)).toBe(loaded.character);
  expect(equipItem({ backpack: loaded.character.inventory, equipped: {} }, PULPPORT_CHAMPION_WEAPON.id,
    { level: 4, might: 5 })).toMatchObject({ ok: true, inventory: { equipped: { weapon: PULPPORT_CHAMPION_WEAPON.id } } });
});

it('adds rewards to existing materials even when the weapon is left behind', () => {
  const reward = championWin();
  const stocked = { ...character, forgeMaterials: { scraps: 9, glue: 3, ink: 2, threads: 1 } };
  const updated = applyFightReward(stocked, reward, false);
  expect(updated).toMatchObject({
    gold: 85, level: 2, inventory: ['armor1'], rewardedFightIds: ['bronze-final'],
    forgeMaterials: { scraps: 12, glue: 4, ink: 2, threads: 2 },
  });
  expect(stocked.forgeMaterials.scraps).toBe(9);
});

it('keeps donated coins on defeat without granting champion loot or XP', () => {
  const start = createCombat(2);
  const player = { ...start.fighters.player, crowd: { ...start.fighters.player.crowd, giftGold: 5 } };
  const loss = { ...start, winner: 'enemy' as const, fighters: { ...start.fighters, player } };
  const reward = getFightReward(loss, 'lost-final', PULPPORT_CHAMPION_WEAPON.id)!;
  expect(reward).toMatchObject({ gold: 5, experience: 0, weapon: undefined });
  expect(reward.forgeMaterials).toBeUndefined();
  expect(applyFightReward(character, reward, true).forgeMaterials).toBeUndefined();
});

it('rejects a reward that would overflow the material balance', () => {
  const full = { ...character, forgeMaterials: { scraps: Number.MAX_SAFE_INTEGER, glue: 0, ink: 0, threads: 0 } };
  expect(() => applyFightReward(full, championWin(), true)).toThrow(RangeError);
  expect(full.forgeMaterials.scraps).toBe(Number.MAX_SAFE_INTEGER);
});

const leaguePrizes = Object.entries(PULPPORT_LEAGUES).map(([league, bouts]) => ({ league, bout: bouts.at(-1)! }));

it.each(leaguePrizes)('awards and equips the $league champion weapon without adding it to the shop catalogue', ({ league, bout }) => {
  const prize = bout.champion!.weapon;
  const state = createCombat(
    1, { position: 4, attributes: { might: 2_000, precision: 100 } },
    { ...bout.setup, position: 5 },
  );
  expect(state.fighters.enemy.weapon?.id).not.toBe(prize.id);
  const fight = performAction(state, 'normal').state;
  const reward = getFightReward(fight, `${league}-first`, prize.id);
  if (!reward) throw new Error('Expected a completed championship bout.');
  expect(reward.weapon).toBe(prize);
  expect(WEAPONS.some(({ id }) => id === prize.id)).toBe(false);

  const claimed = applyFightReward({ ...character, gold: 100_000 }, reward, true);
  expect(claimed.inventory).toEqual(['armor1', prize.id]);
  const enchant = enchantWeapon(claimed, prize.id, 'backpack', { element: 'fire', power: 2 });
  if (!enchant.ok) throw new Error(`Could not enchant ${prize.id}: ${enchant.reason}`);
  const forged = upgradeForgeItem({
    inventory: { backpack: enchant.character.inventory, equipped: {} },
    materials: { scraps: 100, glue: 100, ink: 100, threads: 100 },
  }, enchant.id);
  if (!forged.ok) throw new Error(`Could not forge ${prize.id}: ${forged.reason}`);
  const upgradedId = `${prize.id}^+1~fire~2`;
  expect(forged.state.inventory.backpack).toEqual(['armor1', upgradedId]);
  expect(combatWeapon(upgradedId)).toMatchObject({ damage: prize.damage + 1, enchantment: { element: 'fire', power: 2 } });
  expect(equipItem(forged.state.inventory, upgradedId, { level: 32, might: 100 }, 'offHand')).toMatchObject({
    ok: true, inventory: { equipped: { offHand: upgradedId } },
  });

  const rematch = { ...reward, fightId: `${league}-rematch` };
  const packed = { ...enchant.character, inventory: [...forged.state.inventory.backpack] };
  expect(applyFightReward(packed, rematch, true).inventory).toEqual(['armor1', upgradedId]);
  const worn = { ...enchant.character, inventory: ['armor1'], hands: { offHand: upgradedId } };
  expect(applyFightReward(worn, rematch, true).inventory).toEqual(['armor1']);
});
