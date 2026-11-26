import { isAiProfile } from '../core/ai';
import type { AiProfile } from '../core/ai';
import type { EquipmentLoadout, FighterSetup } from '../core/types';
import { ITEMS } from './equipment';
import type { Item } from './equipment';
import { replaceWeaponCatalogue, WEAPONS } from './weapons';
import type { Weapon } from './weapons';

const DEFAULT_ARMOUR = ITEMS.slice();
const DEFAULT_WEAPONS = WEAPONS.slice();
const ARMOUR_SLOTS = new Set(DEFAULT_ARMOUR.map((item) => item.slot));

export interface ModEnemy {
  readonly id: string;
  readonly profile: AiProfile;
  readonly setup: FighterSetup;
}

export interface ModLeague {
  readonly id: string;
  readonly name: string;
  readonly opponents: readonly string[];
}

export interface ModPack {
  readonly armour: readonly Item[];
  readonly weapons: readonly Weapon[];
  readonly enemies: readonly ModEnemy[];
  readonly leagues: readonly ModLeague[];
}

let activeMod: ModPack | undefined;

function object(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`Invalid ${label}.`);
  return value as Record<string, unknown>;
}

function rows(value: unknown, label: string): unknown[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 200) throw new TypeError(`Invalid ${label} list.`);
  return value;
}

function id(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-z][a-z0-9-]{0,39}$/.test(value)) throw new TypeError('Invalid mod ID.');
  return value;
}

function name(value: unknown): string {
  if (typeof value !== 'string' || !/^[\p{L}\p{N}][\p{L}\p{N} .,'-]{0,49}$/u.test(value)) throw new TypeError('Invalid mod name.');
  return value;
}

function numeric(value: unknown, min: number, max: number, integer = true): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
    throw new RangeError('Mod number outside the supported range.');
  }
  return value;
}

function unique<T extends { id: string }>(values: readonly T[]): T[] {
  if (new Set(values.map((value) => value.id)).size !== values.length) throw new TypeError('Duplicate mod ID.');
  return [...values];
}

export function parseModPack(json: string): ModPack {
  const input = object(JSON.parse(json), 'mod pack');
  if (input.version !== 1) throw new TypeError('Unsupported mod version.');

  const armourPatches = unique(rows(input.armour, 'armour').map((value) => {
    const patch = object(value, 'armour');
    const armourId = id(patch.id);
    const base = DEFAULT_ARMOUR.find((entry) => entry.id === armourId);
    if (!base) throw new TypeError('Unknown armour ID.');
    return {
      ...base,
      name: patch.name === undefined ? base.name : name(patch.name),
      armor: patch.armor === undefined ? base.armor : numeric(patch.armor, 0, 100),
      weight: patch.weight === undefined ? base.weight : numeric(patch.weight, 0, 25, false),
      price: patch.price === undefined ? base.price : numeric(patch.price, 0, 100_000),
    };
  }));
  const armour = DEFAULT_ARMOUR.map((base) => armourPatches.find((patch) => patch.id === base.id) ?? base);

  const weaponPatches = unique(rows(input.weapons, 'weapon').map((value) => {
    const patch = object(value, 'weapon');
    const weaponId = id(patch.id);
    if (weaponId === 'daggers') throw new TypeError('Reserved weapon ID.');
    const baseId = id(patch.base ?? weaponId);
    const base = DEFAULT_WEAPONS.find((entry) => entry.id === baseId);
    if (!base) throw new TypeError('Unknown base weapon ID.');
    return {
      ...base, id: weaponId,
      name: patch.name === undefined ? base.name : name(patch.name),
      damage: patch.damage === undefined ? base.damage : numeric(patch.damage, 1, 200),
      range: patch.range === undefined ? base.range : numeric(patch.range, 0.5, 5, false),
      price: patch.price === undefined ? base.price : numeric(patch.price, 0, 100_000),
    };
  }));
  const weapons = [
    ...DEFAULT_WEAPONS.map((base) => weaponPatches.find((patch) => patch.id === base.id) ?? base),
    ...weaponPatches.filter((patch) => !DEFAULT_WEAPONS.some((base) => base.id === patch.id)),
  ];

  const enemies: ModEnemy[] = unique(rows(input.enemies, 'enemy').map((value): ModEnemy => {
    const enemy = object(value, 'enemy');
    if (!isAiProfile(enemy.profile)) throw new TypeError('Unknown AI profile.');
    const level = numeric(enemy.level, 1, 60);
    const equipment: EquipmentLoadout = {};
    if (enemy.weapon !== undefined) {
      const weaponId = id(enemy.weapon);
      if (!weapons.some((entry) => entry.id === weaponId)) throw new TypeError('Unknown enemy weapon.');
      equipment.weapon = weaponId;
    }
    for (const [slot, tier] of Object.entries(object(enemy.armour ?? {}, 'enemy armour'))) {
      const armourSlot = [...ARMOUR_SLOTS].find((candidate) => candidate === slot);
      if (!armourSlot) throw new TypeError('Unknown armour slot.');
      equipment[armourSlot] = numeric(tier, 0, 10);
    }
    return { id: id(enemy.id), profile: enemy.profile, setup: { name: name(enemy.name), level, equipment } };
  }));

  const leagues = unique(rows(input.leagues, 'league').map((value) => {
    const league = object(value, 'league');
    const opponents = rows(league.opponents, 'opponent').map(id);
    if (!opponents.length || new Set(opponents).size !== opponents.length || opponents.some((enemy) => !enemies.some((entry) => entry.id === enemy))) {
      throw new TypeError('A mod league must reference defined opponents.');
    }
    return { id: id(league.id), name: name(league.name), opponents };
  }));
  return { armour, weapons, enemies, leagues };
}

export async function loadModPack(source: Pick<Blob, 'text'>): Promise<ModPack> {
  return parseModPack(await source.text());
}

export async function loadBundledMod(name: string, base: string): Promise<ModPack> {
  const response = await fetch(`${base}mods/${id(name)}.json`);
  if (!response.ok) throw new Error(`Could not load mod (${response.status}).`);
  const pack = await loadModPack(response);
  activateModPack(pack);
  return pack;
}

export function activateModPack(pack?: ModPack): void {
  ITEMS.splice(0, ITEMS.length, ...(pack?.armour ?? DEFAULT_ARMOUR));
  replaceWeaponCatalogue(pack?.weapons ?? DEFAULT_WEAPONS);
  activeMod = pack;
}

export function getActiveModPack(): ModPack | undefined {
  return activeMod;
}

export function getModOpponent(leagueId: string, index: number): ModEnemy | undefined {
  const league = activeMod?.leagues.find((entry) => entry.id === leagueId);
  const enemyId = league?.opponents[index];
  return activeMod?.enemies.find((entry) => entry.id === enemyId);
}
