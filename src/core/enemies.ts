import { ITEMS } from '../data/equipment';
import { ENEMY_EPITHETS, ENEMY_NAMES } from '../data/names';
import { WEAPONS } from '../data/weapons';
import type { Look } from '../rig/PaperRig';
import { LEAGUE_MAX_TIER } from './leagues';
import type { League } from './leagues';
import { nextRandom } from './rng';
import { resolveAttributes } from './stats';
import type { Attributes, EquipmentLoadout } from './types';

export interface GeneratedEnemy {
  readonly name: string;
  readonly level: number;
  readonly attributes: Attributes;
  readonly look: Look;
  readonly equipment: EquipmentLoadout;
}

const ARMOUR_SLOTS = [...new Set(ITEMS.map((item) => item.slot))];

export function generateEnemy(seed: number, playerLevel: number, league: League): GeneratedEnemy {
  if (!Number.isSafeInteger(seed)) throw new RangeError('Enemy seed must be a safe integer.');
  if (!Number.isInteger(playerLevel) || playerLevel < 1 || playerLevel > 60) throw new RangeError('Level must be from 1 to 60.');

  let rng = seed >>> 0;
  const draw = () => {
    const next = nextRandom(rng);
    rng = next.state;
    return next.value;
  };
  const integer = (max: number) => Math.floor(draw() * max);
  const level = Math.max(1, Math.min(60, playerLevel + integer(5) - 2));
  const name = `${ENEMY_NAMES[integer(ENEMY_NAMES.length)]} ${ENEMY_EPITHETS[integer(ENEMY_EPITHETS.length)]}`;
  const baseline = 4 + Math.floor((level - 1) / 4);
  const attribute = () => baseline + integer(5) - 2;
  const attributes = resolveAttributes({
    might: attribute(), agility: attribute(), precision: attribute(), guard: attribute(),
    vitality: attribute(), stamina: attribute(), charm: attribute(), arcana: attribute(),
  });
  const look: Look = {
    skin: integer(10), face: integer(10), hair: integer(10), hairColor: integer(10), beard: integer(10),
    helmet: 0, armor: 0, shoulders: 0, greaves: 0, boots: 0, weapon: 'gladius',
  };

  const tierCap = LEAGUE_MAX_TIER[league];
  const armour = ITEMS.filter((item) => item.tier <= tierCap && item.minLevel <= level);
  const equipment: EquipmentLoadout = {};
  for (const slot of ARMOUR_SLOTS) {
    const candidates = armour.filter((item) => item.slot === slot).slice(-2);
    if (!candidates.length || draw() >= (league === 'bronze' ? 0.7 : 0.9)) continue;
    const piece = candidates[integer(candidates.length)];
    look[slot] = piece.tier;
    equipment[slot] = piece.tier;
  }

  // The current puppet kit has a gladius sprite, so generated foes carry swords.
  const swords = WEAPONS.filter((weapon) => weapon.family === 'sword' && weapon.tier <= tierCap
    && weapon.minLevel <= level && weapon.minMight <= attributes.might).slice(-2);
  if (swords.length) equipment.weapon = swords[integer(swords.length)].id;
  return { name, level, attributes, look, equipment };
}
