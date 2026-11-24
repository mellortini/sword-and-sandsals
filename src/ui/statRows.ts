import type { Attributes, FighterStats } from '../core/types';

/** What the pre-fight comparison needs to know about one fighter. */
export interface ComparedFighter {
  readonly name: string;
  readonly level: number;
  readonly attributes: Readonly<Attributes>;
  readonly stats: Readonly<FighterStats>;
}

/** Which side a row favours; `even` when both values are the same. */
export type Edge = 'player' | 'enemy' | 'even';

export interface StatRow {
  readonly label: string;
  readonly player: string;
  readonly enemy: string;
  readonly edge: Edge;
}

interface RowSpec {
  label: string;
  value: (f: ComparedFighter) => number;
  /** true when a smaller number is the better one (weight slows jumps and costs energy) */
  lowerIsBetter?: boolean;
  format?: (v: number) => string;
}

const ATTRIBUTE_LABELS: [keyof Attributes, string][] = [
  ['might', 'Might'],
  ['agility', 'Agility'],
  ['precision', 'Precision'],
  ['guard', 'Guard'],
  ['vitality', 'Vitality'],
  ['stamina', 'Stamina'],
  ['charm', 'Charm'],
  ['arcana', 'Arcana'],
];

const ROWS: RowSpec[] = [
  { label: 'Level', value: (f) => f.level },
  { label: 'Health', value: (f) => f.stats.maxHealth },
  { label: 'Energy', value: (f) => f.stats.maxEnergy },
  { label: 'Armour', value: (f) => f.stats.armour },
  { label: 'Weight', value: (f) => f.stats.weight, lowerIsBetter: true, format: (v) => v.toFixed(1) },
  ...ATTRIBUTE_LABELS.map(([key, label]): RowSpec => ({ label, value: (f) => f.attributes[key] })),
];

/** Rows for the comparison panel, player on the left, enemy on the right. */
export function comparisonRows(player: ComparedFighter, enemy: ComparedFighter): StatRow[] {
  return ROWS.map(({ label, value, lowerIsBetter, format = String }) => {
    const a = value(player);
    const b = value(enemy);
    const better = lowerIsBetter ? a < b : a > b;
    return {
      label,
      player: format(a),
      enemy: format(b),
      edge: a === b ? 'even' : better ? 'player' : 'enemy',
    };
  });
}
