import type { Look } from '../rig/PaperRig';
import { ACHIEVEMENT_COUNTERS } from './achievements';
import type { AchievementProgress } from './achievements';
import { MAX_LEVEL } from './progression';
import { resolveAttributes } from './stats';
import type { Attributes, EquipmentLoadout } from './types';

const SAVE_VERSION = 1;
const DATABASE = 'folded-glory';
const STORE = 'saves';
const SLOT = 'current';

const APPEARANCE = ['skin', 'face', 'hair', 'hairColor', 'beard'] as const;
const EQUIPMENT = ['helmet', 'armor', 'shoulders', 'greaves', 'boots'] as const satisfies readonly (keyof EquipmentLoadout)[];
const ATTRIBUTES = Object.keys(resolveAttributes());

export interface SavedCharacter {
  name: string;
  level: number;
  experience: number;
  attributePoints?: number;
  skillPoints?: number;
  gold: number;
  attributes: Attributes;
  /** Appearance, equipped weapon and five independent armour slots. */
  look: Look;
  /** Gameplay item IDs for the hands, separate from the puppet weapon skin. */
  hands?: { weapon?: string; offHand?: string };
  inventory: string[];
  achievements?: AchievementProgress;
}

type DecodeFailure = 'invalid' | 'unsupported';

export type SaveDecodeResult =
  | { ok: true; character: SavedCharacter }
  | { ok: false; reason: DecodeFailure };

export type GameLoadResult =
  | { status: 'loaded' | 'new'; character: SavedCharacter }
  | { status: 'recovered'; character: SavedCharacter; reason: DecodeFailure | 'storage'; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function within(value: unknown, min: number, max = Number.MAX_SAFE_INTEGER): boolean {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max;
}

function isLook(value: unknown): value is Look {
  return isRecord(value)
    && APPEARANCE.every((part) => within(value[part], 0, 9))
    && EQUIPMENT.every((slot) => within(value[slot], 0, 10))
    && typeof value.weapon === 'string';
}

function isItemId(id: unknown): id is string {
  return typeof id === 'string' && id.trim().length > 0;
}

function isAchievementProgress(value: unknown): value is AchievementProgress {
  if (!isRecord(value) || !isRecord(value.counters)) return false;
  const { unlocked, completedFightIds, counters } = value;
  return Array.isArray(unlocked) && unlocked.every(isItemId)
    && Array.isArray(completedFightIds) && completedFightIds.every(isItemId)
    && ACHIEVEMENT_COUNTERS.every((key) => within(counters[key], 0));
}

function isCharacter(value: unknown): value is SavedCharacter {
  if (!isRecord(value)) return false;
  const { attributes, hands, inventory } = value;
  return typeof value.name === 'string' && value.name.trim().length > 0
    && within(value.level, 1, MAX_LEVEL) && within(value.experience, 0)
    && (value.attributePoints === undefined || within(value.attributePoints, 0))
    && (value.skillPoints === undefined || within(value.skillPoints, 0)) && within(value.gold, 0)
    && isRecord(attributes) && ATTRIBUTES.every((key) => within(attributes[key], 0))
    && isLook(value.look)
    && (hands === undefined || (isRecord(hands) && ['weapon', 'offHand'].every((slot) => hands[slot] === undefined || isItemId(hands[slot]))))
    && Array.isArray(inventory) && inventory.every(isItemId)
    && (value.achievements === undefined || isAchievementProgress(value.achievements));
}

export function serializeSave(character: SavedCharacter): string {
  if (!isCharacter(character)) throw new TypeError('Invalid character for save.');
  return JSON.stringify({ version: SAVE_VERSION, character }, null, 2);
}

export function deserializeSave(json: string): SaveDecodeResult {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return { ok: false, reason: 'invalid' };
  }
  if (!isRecord(data) || !within(data.version, 0)) return { ok: false, reason: 'invalid' };
  if (data.version !== SAVE_VERSION) return { ok: false, reason: 'unsupported' };
  return isCharacter(data.character) ? { ok: true, character: data.character } : { ok: false, reason: 'invalid' };
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    let blocked = false;
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
    };
    request.onblocked = () => {
      blocked = true;
      reject(new Error('Save database is blocked by another tab.'));
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      if (blocked) database.close();
      else {
        database.onversionchange = () => database.close();
        resolve(database);
      }
    };
  });
}

async function withStore<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE, mode);
      const request = action(transaction.objectStore(STORE));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onabort = () => reject(transaction.error ?? new Error('Save transaction aborted.'));
    });
  } finally {
    database.close();
  }
}

export async function saveGame(character: SavedCharacter): Promise<void> {
  const json = serializeSave(character);
  await withStore('readwrite', (store) => store.put(json, SLOT));
}

/** Returns a fresh character on a missing, unreadable or unsupported save. */
export async function loadGame(createCharacter: () => SavedCharacter): Promise<GameLoadResult> {
  let stored: unknown;
  try {
    stored = await withStore('readonly', (store) => store.get(SLOT));
  } catch {
    return { status: 'recovered', character: createCharacter(), reason: 'storage', message: 'Save storage is unavailable. A new character is ready.' };
  }

  if (stored === undefined) return { status: 'new', character: createCharacter() };
  const decoded = typeof stored === 'string' ? deserializeSave(stored) : { ok: false, reason: 'invalid' } as const;
  if (decoded.ok) return { status: 'loaded', character: decoded.character };
  const message = decoded.reason === 'unsupported'
    ? 'This save version is unsupported. A new character is ready.'
    : 'The saved character could not be read. A new character is ready.';
  return { status: 'recovered', character: createCharacter(), reason: decoded.reason, message };
}

/** A malformed or unsupported import leaves the current save untouched. */
export async function importGame(json: string): Promise<SaveDecodeResult> {
  const decoded = deserializeSave(json);
  if (decoded.ok) await saveGame(decoded.character);
  return decoded;
}
