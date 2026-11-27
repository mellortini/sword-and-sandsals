/**
 * The gore setting (#20): how rough a finisher looks. There is no blood in a paper world - "shreds" is red crepe tissue,
 * "ink" is red ink, "off" keeps every fighter in one piece and throws plain paper confetti.
 * Saved in the browser; the settings screen (#80) only has to call cycleGore().
 */
export const GORE_MODES = [
  { id: 'shreds', name: 'Paper shreds' },
  { id: 'ink', name: 'Red ink' },
  { id: 'off', name: 'Off' },
] as const;

export type GoreMode = (typeof GORE_MODES)[number]['id'];

const KEY = 'folded-glory.gore';
let current: GoreMode | null = null;

const isMode = (v: unknown): v is GoreMode => GORE_MODES.some((m) => m.id === v);

/** the saved choice (shreds when nothing is saved or storage is blocked) */
export function goreMode(): GoreMode {
  if (current) return current;
  try {
    const saved = localStorage.getItem(KEY);
    return isMode(saved) ? saved : 'shreds';
  } catch {
    return 'shreds';
  }
}

export function setGoreMode(mode: GoreMode) {
  current = mode;
  try {
    localStorage.setItem(KEY, mode);
  } catch {
    // private mode: the choice holds until the page reloads
  }
}

/** the next mode (wrapping), saved at once */
export function cycleGore(step: 1 | -1 = 1): GoreMode {
  const i = GORE_MODES.findIndex((m) => m.id === goreMode());
  const next = GORE_MODES[(i + step + GORE_MODES.length) % GORE_MODES.length].id;
  setGoreMode(next);
  return next;
}

/** which clip the loser of a finisher plays */
export const finisherClip = (mode: GoreMode) => (mode === 'off' ? 'finish_fold' : 'finish_decap');
