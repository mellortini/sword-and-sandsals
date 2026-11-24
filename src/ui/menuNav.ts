/** A menu entry; disabled entries stay visible but cannot be chosen. */
export interface MenuEntry {
  readonly label: string;
  readonly enabled: boolean;
}

/** First enabled entry, or -1 when there is none. */
export function firstEnabled(entries: readonly MenuEntry[]): number {
  return entries.findIndex((e) => e.enabled);
}

/**
 * Next enabled entry from `current` in `step` direction (+1 down, -1 up), wrapping around the list.
 * Returns `current` when no other entry is enabled.
 */
export function moveSelection(entries: readonly MenuEntry[], current: number, step: 1 | -1): number {
  const n = entries.length;
  for (let i = 1; i <= n; i++) {
    const j = (((current + step * i) % n) + n) % n;
    if (entries[j].enabled) return j;
  }
  return current;
}
