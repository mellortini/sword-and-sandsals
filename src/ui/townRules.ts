import type { SavedCharacter } from '../core/save';
import { templeHealingQuote } from '../core/temple';

export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** One line for the title menu (#201): what needs the player's attention in town, if anything. */
export function townNote(c: SavedCharacter): string {
  const { health, maxHealth } = templeHealingQuote(c);
  const todo = [
    health < maxHealth ? 'wounded' : '',
    (c.attributePoints ?? 0) > 0 ? plural(c.attributePoints!, 'attribute point') : '',
    (c.skillPoints ?? 0) > 0 ? plural(c.skillPoints!, 'skill point') : '',
  ].filter(Boolean);
  return todo.length ? todo.join(' · ') : 'gear, forge, temple, trainer…';
}
