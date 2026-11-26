import { FORGE_MATERIALS, forgePresentation, forgeUpgradeCost, readForgedItem, salvageForgeItem } from '../core/forge';
import type { ForgeMaterials, ForgeState } from '../core/forge';
import type { SavedCharacter } from '../core/save';
import { combatWeapon } from '../core/weapons';
import { ITEMS } from '../data/equipment';
import { WEAPONS } from '../data/weapons';

export type ForgeMaterial = (typeof FORGE_MATERIALS)[number];

export const MATERIAL_NAMES: Readonly<Record<ForgeMaterial, string>> = {
  scraps: 'Scraps', glue: 'Glue', ink: 'Ink', threads: 'Threads',
};

const SINGULAR: Readonly<Record<ForgeMaterial, string>> = { scraps: 'Scrap', glue: 'Glue', ink: 'Ink', threads: 'Thread' };

/** "1 Scrap", "3 Scraps" */
export const materialAmount = (key: ForgeMaterial, n: number) => `${n} ${n === 1 ? SINGULAR[key] : MATERIAL_NAMES[key]}`;

const NO_MATERIALS: ForgeMaterials = { scraps: 0, glue: 0, ink: 0, threads: 0 };

/** One item of the pack as the forge screen shows it (#189). */
export interface ForgeRow {
  /** position in the pack (two copies of one item are two rows) */
  readonly index: number;
  readonly id: string;
  /** name with the upgrade number, e.g. "Rag Wrap +3" */
  readonly label: string;
  readonly level: number;
  /** 0…1, how strongly the card shines */
  readonly glow: number;
  readonly tier: number;
  /** the number an upgrade raises: weapon damage or the piece's armour */
  readonly stat: { readonly name: 'Damage' | 'Armour'; readonly now: number; readonly next?: number };
  /** undefined at +10 */
  readonly cost?: ForgeMaterials;
  /** materials still missing for the next upgrade (empty when it can be paid) */
  readonly missing: readonly ForgeMaterial[];
  /** what salvaging this piece gives back */
  readonly salvage: ForgeMaterials;
}

/** The forge's view of a character: the pack and the materials. Equipped items stay out of the forge. */
export function forgeState(character: SavedCharacter): ForgeState {
  return { inventory: { backpack: character.inventory, equipped: {} }, materials: character.forgeMaterials ?? NO_MATERIALS };
}

/** The character after the forge: new pack and materials, nothing else changes. */
export function applyForge(character: SavedCharacter, state: ForgeState): SavedCharacter {
  return { ...character, inventory: [...state.inventory.backpack], forgeMaterials: { ...state.materials } };
}

function statOf(id: string, level: number): number | undefined {
  const { baseId } = readForgedItem(id);
  const armour = ITEMS.find((piece) => piece.id === baseId);
  if (armour) return armour.armor + level;
  return combatWeapon(id)?.damage;
}

function tierOf(id: string): number {
  const { baseId } = readForgedItem(id);
  return (ITEMS.find((piece) => piece.id === baseId) ?? WEAPONS.find((entry) => entry.id === baseId))?.tier ?? 0;
}

/** Rows for every known item of the pack, in pack order. Unknown ids are left out. */
export function forgeRows(state: ForgeState): ForgeRow[] {
  const rows: ForgeRow[] = [];
  state.inventory.backpack.forEach((id, index) => {
    const look = forgePresentation(id);
    const { baseId, level } = readForgedItem(id);
    const now = statOf(id, level);
    if (!look || now === undefined) return;
    const cost = forgeUpgradeCost(id);
    const next = cost ? statOf(`${baseId}^+${level + 1}`, level + 1) : undefined;
    const salvaged = salvageForgeItem(state, id);
    const salvage = salvaged.ok ? difference(salvaged.state.materials, state.materials) : NO_MATERIALS;
    const isArmour = ITEMS.some((piece) => piece.id === baseId);
    rows.push({
      index, id, label: look.label, level, glow: look.glow, tier: tierOf(id),
      stat: { name: isArmour ? 'Armour' : 'Damage', now, next },
      cost,
      missing: cost ? FORGE_MATERIALS.filter((key) => state.materials[key] < cost[key]) : [],
      salvage,
    });
  });
  return rows;
}

function difference(after: ForgeMaterials, before: ForgeMaterials): ForgeMaterials {
  return { scraps: after.scraps - before.scraps, glue: after.glue - before.glue, ink: after.ink - before.ink, threads: after.threads - before.threads };
}

/** "3 Scraps · 1 Glue" — only the materials that are not zero. */
export function materialsText(materials: ForgeMaterials): string {
  const parts = FORGE_MATERIALS.filter((key) => materials[key] > 0).map((key) => materialAmount(key, materials[key]));
  return parts.length ? parts.join(' · ') : 'nothing';
}
