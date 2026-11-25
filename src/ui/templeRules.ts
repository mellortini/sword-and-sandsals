import { COMBAT_ITEMS } from '../core/spells';
import { TEMPLE_REMEDIES, templeHealingQuote } from '../core/temple';
import type { TempleRemedy } from '../core/temple';
import type { SavedCharacter } from '../core/save';

/** One remedy on the temple's shelf (#191). */
export interface RemedyRow {
  readonly id: TempleRemedy;
  readonly name: string;
  readonly price: number;
  /** what it does in a fight */
  readonly effect: string;
  /** how many are in the pack; each kind fills one combat slot */
  readonly owned: number;
  readonly affordable: boolean;
}

const EFFECT: Readonly<Record<TempleRemedy, string>> = {
  'glue-tonic': 'Restores 12 health in a fight.',
  'repair-tape': 'Tapes you up against the next blows.',
  staples: 'Restores 4 health and closes a tear.',
};

export function remedyRows(character: SavedCharacter): RemedyRow[] {
  return TEMPLE_REMEDIES.map(({ id, price }) => ({
    id, price, name: COMBAT_ITEMS[id].name, effect: EFFECT[id],
    owned: character.inventory.filter((item) => item === id).length,
    affordable: character.gold >= price,
  }));
}

/** The healing offer: "Heal 18 HP for 6 gold", or why there is nothing to heal. */
export function healingText(character: SavedCharacter): { line: string; price: number; canHeal: boolean } {
  const { health, maxHealth, price } = templeHealingQuote(character);
  if (price === 0) return { line: `Health ${health} / ${maxHealth} · no wounds to mend`, price, canHeal: false };
  return { line: `Health ${health} / ${maxHealth} · mend ${maxHealth - health} HP for ${price} gold`, price, canHeal: character.gold >= price };
}
