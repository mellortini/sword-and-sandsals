import { ITEMS } from '../data/equipment';
import { WEAPONS } from '../data/weapons';
import type { Inventory } from './inventory';
import type { CombatState } from './types';
import { readWeaponEnchantment } from './weaponEnchantmentId';
import type { WeaponEnchantment } from './weaponEnchantmentId';

export const FORGE_MATERIALS = ['scraps', 'glue', 'ink', 'threads'] as const;
export type ForgeMaterials = Readonly<Record<(typeof FORGE_MATERIALS)[number], number>>;

export interface ForgeState {
  readonly inventory: Inventory;
  readonly materials: ForgeMaterials;
}

const MAX_UPGRADE = 10;
const EMPTY_MATERIALS: ForgeMaterials = { scraps: 0, glue: 0, ink: 0, threads: 0 };

export function readForgedItem(id?: string): { baseId?: string; level: number; enchantment?: WeaponEnchantment } {
  const { baseId: forgedId, enchantment } = readWeaponEnchantment(id);
  const match = forgedId?.match(/^(.+)\^\+([1-9]|10)$/);
  const baseId = match?.[1] ?? forgedId;
  const level = match ? Number(match[2]) : 0;
  if (enchantment && !WEAPONS.some((weapon) => weapon.id === baseId)) return { baseId: id, level: 0 };
  return { baseId, level, ...(enchantment && { enchantment }) };
}

function baseEquipment(id?: string) {
  return ITEMS.find((entry) => entry.id === id) ?? WEAPONS.find((entry) => entry.id === id);
}

export function forgePresentation(id: string): { label: string; glow: number } | undefined {
  const { baseId, level, enchantment } = readForgedItem(id);
  const item = baseEquipment(baseId);
  if (!item) return undefined;
  const upgrade = level > 0 ? ` +${level}` : '';
  const effect = enchantment ? ` (${enchantment.element} ${enchantment.power})` : '';
  return { label: `${item.name}${upgrade}${effect}`, glow: level / MAX_UPGRADE };
}

export function forgeUpgradeCost(id: string): ForgeMaterials | undefined {
  const { baseId, level } = readForgedItem(id);
  const item = baseEquipment(baseId);
  if (!item || level === MAX_UPGRADE) return undefined;
  const step = level + 1;
  return { scraps: item.tier + step, glue: Math.ceil(step / 2), ink: Math.floor(step / 3), threads: 'slot' in item ? step : 0 };
}

type ForgeResult =
  | { ok: true; state: ForgeState }
  | { ok: false; state: ForgeState; reason: 'not-owned' | 'unavailable' | 'insufficient-materials' | 'material-limit' };

export function upgradeForgeItem(state: ForgeState, id: string): ForgeResult {
  const index = state.inventory.backpack.indexOf(id);
  if (index < 0) return { ok: false, state, reason: 'not-owned' };
  const cost = forgeUpgradeCost(id);
  if (!cost) return { ok: false, state, reason: 'unavailable' };
  if (FORGE_MATERIALS.some((key) => state.materials[key] < cost[key])) {
    return { ok: false, state, reason: 'insufficient-materials' };
  }
  const materials = { ...state.materials };
  for (const key of FORGE_MATERIALS) materials[key] -= cost[key];
  const { baseId, level, enchantment } = readForgedItem(id);
  const backpack = [...state.inventory.backpack];
  const effect = enchantment ? `~${enchantment.element}~${enchantment.power}` : '';
  backpack[index] = `${baseId}^+${level + 1}${effect}`;
  return { ok: true, state: { inventory: { ...state.inventory, backpack }, materials } };
}

export function salvageForgeItem(state: ForgeState, id: string): ForgeResult {
  const index = state.inventory.backpack.indexOf(id);
  if (index < 0) return { ok: false, state, reason: 'not-owned' };
  const { baseId, level } = readForgedItem(id);
  const item = baseEquipment(baseId);
  if (!item) return { ok: false, state, reason: 'unavailable' };

  const materials = {
    scraps: state.materials.scraps + item.tier + Math.floor(level / 2),
    glue: state.materials.glue + 1,
    ink: state.materials.ink + Math.floor(item.tier / 3),
    threads: state.materials.threads + ('slot' in item ? 1 : 0),
  };
  if (FORGE_MATERIALS.some((key) => !Number.isSafeInteger(materials[key]))) {
    return { ok: false, state, reason: 'material-limit' };
  }
  const backpack = state.inventory.backpack.slice();
  backpack.splice(index, 1);
  return { ok: true, state: { inventory: { ...state.inventory, backpack }, materials } };
}

export function forgeFightLoot(fight: CombatState): ForgeMaterials {
  if (fight.winner !== 'player') return EMPTY_MATERIALS;
  const level = fight.fighters.enemy.level;
  return { scraps: 2 + Math.floor(level / 4), glue: 1, ink: Math.floor(level / 6), threads: 1 };
}
