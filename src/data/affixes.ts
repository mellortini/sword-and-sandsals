import type { StatusKind } from '../core/status';

type StatModifier = { readonly kind: 'attack' | 'armour' | 'regeneration'; readonly value: number };
type HitModifier = { readonly kind: 'on-hit'; readonly status: StatusKind; readonly chance: number };

export interface Affix {
  readonly id: string;
  readonly label: string;
  readonly fits: 'weapon' | 'armour';
  readonly modifier: StatModifier | HitModifier;
}

export const AFFIXES: readonly Affix[] = [
  { id: 'jagged', label: 'Jagged', fits: 'weapon', modifier: { kind: 'attack', value: 2 } },
  { id: 'tempered', label: 'Tempered', fits: 'weapon', modifier: { kind: 'attack', value: 3 } },
  { id: 'kindling', label: 'of Kindling', fits: 'weapon', modifier: { kind: 'on-hit', status: 'burning', chance: 25 } },
  { id: 'tearing', label: 'of Tearing', fits: 'weapon', modifier: { kind: 'on-hit', status: 'torn', chance: 25 } },
  { id: 'glued', label: 'Glued', fits: 'armour', modifier: { kind: 'regeneration', value: 2 } },
  { id: 'reinforced', label: 'Reinforced', fits: 'armour', modifier: { kind: 'armour', value: 2 } },
  { id: 'laminated', label: 'Laminated', fits: 'armour', modifier: { kind: 'armour', value: 3 } },
  { id: 'mending', label: 'of Mending', fits: 'armour', modifier: { kind: 'regeneration', value: 1 } },
];
