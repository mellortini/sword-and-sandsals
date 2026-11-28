/**
 * Nocleg w domu (#45): darmowe leczenie, które kosztuje czas, żeby nie dało się utknąć bez złota. Świątynia leczy
 * od razu i bez upływu dni, ale za złoto.
 */
import type { SavedCharacter } from './save';
import { passTime, storyOf } from './story';
import { templeHealingQuote } from './temple';

/** Część pełnego zdrowia, którą daje jedna noc: z połowy (po przegranej) do pełna w dwie noce. */
export const SLEEP_RECOVERY = 0.25;

export interface SleepQuote {
  readonly day: number;
  readonly health: number;
  readonly maxHealth: number;
  /** zdrowie po jednej nocy */
  readonly after: number;
}

export function sleepQuote(character: SavedCharacter): SleepQuote {
  const { health, maxHealth } = templeHealingQuote(character);
  return {
    day: storyOf(character).day, health, maxHealth,
    after: Math.min(maxHealth, health + Math.ceil(maxHealth * SLEEP_RECOVERY)),
  };
}

/** Jedna noc. Zdrowa postać nie ma po co spać, więc dostaje z powrotem ten sam obiekt. */
export function sleepAtHome(character: SavedCharacter): SavedCharacter {
  const { health, after } = sleepQuote(character);
  return after > health ? passTime({ ...character, health: after }, 'rest') : character;
}
