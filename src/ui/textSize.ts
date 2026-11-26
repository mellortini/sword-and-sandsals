import './textSize.css';

/** Text sizes the title menu cycles through (#77); the DOM panels zoom and the fight HUD grows with it. */
export const TEXT_SIZES = [
  { name: 'Normal', scale: 1 },
  { name: 'Large', scale: 1.15 },
  { name: 'Largest', scale: 1.3 },
] as const;

const KEY = 'folded-glory.text-size';
let current: number | null = null;

/** Index into TEXT_SIZES of the saved choice (Normal when nothing is saved or storage is blocked). */
export function textSizeIndex(): number {
  if (current !== null) return current;
  try {
    const i = Number(localStorage.getItem(KEY));
    return Number.isInteger(i) && i >= 0 && i < TEXT_SIZES.length ? i : 0;
  } catch {
    return 0;
  }
}

export const textScale = () => TEXT_SIZES[textSizeIndex()].scale;

/** The next size (wrapping), saved and applied at once; returns its index. */
export function cycleTextSize(step: 1 | -1 = 1): number {
  const i = (textSizeIndex() + step + TEXT_SIZES.length) % TEXT_SIZES.length;
  current = i;
  try {
    localStorage.setItem(KEY, String(i));
  } catch {
    // private mode: the size holds until the page reloads
  }
  applyTextSize();
  return i;
}

export function applyTextSize() {
  if (typeof document === 'undefined') return;
  const scale = TEXT_SIZES[textSizeIndex()].scale;
  document.documentElement.style.setProperty('--text-scale', String(scale));
}

applyTextSize();
