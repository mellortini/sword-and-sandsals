import { AFFIXES } from '../data/affixes';
import type { Affix } from '../data/affixes';
import { ITEMS } from '../data/equipment';
import type { Item } from '../data/equipment';
import { WEAPONS } from '../data/weapons';
import type { Weapon } from '../data/weapons';
import { equipmentTotals } from './inventory';
import { nextRandom } from './rng';
import type { EquipmentLoadout } from './types';

export const RARITIES = [
  { id: 'common', label: 'Common', frameColor: '#a9a298', cutoff: 65, affixCount: 0 },
  { id: 'fine', label: 'Fine', frameColor: '#8dbd72', cutoff: 88, affixCount: 1 },
  { id: 'rare', label: 'Rare', frameColor: '#71a6de', cutoff: 97, affixCount: 2 },
  { id: 'epic', label: 'Epic', frameColor: '#c28cdb', cutoff: 99.5, affixCount: 3 },
  { id: 'legendary', label: 'Legendary', frameColor: '#e4ad53', cutoff: 100, affixCount: 4 },
] as const;

type Rarity = (typeof RARITIES)[number]['id'];
type HitModifier = Extract<Affix['modifier'], { kind: 'on-hit' }>;

export interface LootItem {
  readonly base: Readonly<Item | Weapon>;
  readonly rarity: Rarity;
  readonly affixes: readonly Affix[];
}

export function rollLoot(seed: number, level: number): { item: LootItem; rngState: number } {
  if (!Number.isSafeInteger(seed)) throw new RangeError('Loot seed must be a safe integer.');
  if (!Number.isSafeInteger(level) || level < 1 || level > 60) throw new RangeError('Level must be from 1 to 60.');

  let rngState = seed >>> 0;
  const sample = () => {
    const next = nextRandom(rngState);
    rngState = next.state;
    return next.value;
  };

  const eligible = [...ITEMS, ...WEAPONS].filter((base) => base.minLevel <= level);
  const highestTier = Math.max(...eligible.map(({ tier }) => tier));
  const pool = eligible.filter(({ tier }) => tier >= highestTier - 1);
  const base = pool[Math.floor(sample() * pool.length)];
  const percentile = sample() * 100;
  const rarity = RARITIES.find(({ cutoff }) => percentile < cutoff)!;

  const fits = 'family' in base ? 'weapon' : 'armour';
  const candidates = AFFIXES.filter((affix) => affix.fits === fits);
  const affixes: Affix[] = [];
  for (let i = 0; i < rarity.affixCount; i++) {
    const [picked] = candidates.splice(Math.floor(sample() * candidates.length), 1);
    affixes.push(picked);
  }
  return { item: { base, rarity: rarity.id, affixes }, rngState };
}

export function lootModifiers(loot: LootItem): { attack: number; armour: number; regeneration: number; onHit: readonly HitModifier[] } {
  const stats = { attack: 0, armour: 0, regeneration: 0, onHit: [] as HitModifier[] };
  for (const { modifier } of loot.affixes) {
    if (modifier.kind === 'on-hit') stats.onHit.push(modifier);
    else stats[modifier.kind] += modifier.value;
  }
  return stats;
}

export function lootArmourTotals(equipped: Partial<Record<Item['slot'], LootItem>>): {
  armour: number; weight: number; fullSet: boolean; regeneration: number;
} {
  const loadout: EquipmentLoadout = {};
  let extraArmour = 0;
  let regeneration = 0;
  for (const [slot, loot] of Object.entries(equipped)) {
    if (!loot || !('slot' in loot.base) || loot.base.slot !== slot) continue;
    loadout[loot.base.slot] = loot.base.tier;
    const modifiers = lootModifiers(loot);
    extraArmour += modifiers.armour;
    regeneration += modifiers.regeneration;
  }
  const totals = equipmentTotals(loadout);
  return { ...totals, armour: totals.armour + extraArmour, regeneration };
}
