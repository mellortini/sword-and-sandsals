/**
 * The "reduce motion" setting (#75): with it the camera never zooms, shakes or drifts. It starts from the system's
 * prefers-reduced-motion and is saved in the browser once changed; the settings screen (#80) only has to call cycleMotion().
 */
export const MOTION_MODES = [
  { id: 'full', name: 'Full' },
  { id: 'reduced', name: 'Reduced' },
] as const;

export type MotionMode = (typeof MOTION_MODES)[number]['id'];

const KEY = 'folded-glory.motion';
let current: MotionMode | null = null;

const isMode = (v: unknown): v is MotionMode => MOTION_MODES.some((m) => m.id === v);

function systemPrefersLess(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** the saved choice, else what the system asks for */
export function motionMode(): MotionMode {
  if (current) return current;
  try {
    const saved = localStorage.getItem(KEY);
    if (isMode(saved)) return saved;
  } catch {
    // storage blocked: fall back to the system
  }
  return systemPrefersLess() ? 'reduced' : 'full';
}

export const reduceMotion = () => motionMode() === 'reduced';

export function setMotionMode(mode: MotionMode) {
  current = mode;
  try {
    localStorage.setItem(KEY, mode);
  } catch {
    // private mode: the choice holds until the page reloads
  }
}

/** the other mode, saved at once */
export function cycleMotion(): MotionMode {
  const next = motionMode() === 'full' ? 'reduced' : 'full';
  setMotionMode(next);
  return next;
}
