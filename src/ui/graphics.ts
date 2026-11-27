/**
 * Graphics settings (#80): the soft paper shadow drawn under every part of a puppet. It is the costliest thing a puppet
 * draws, so a slow phone can switch it off. Saved in the browser; the puppets read it when a scene builds them.
 */
const KEY = 'folded-glory.paper-shadows';
let current: boolean | null = null;

export function paperShadows(): boolean {
  if (current !== null) return current;
  try {
    return localStorage.getItem(KEY) !== 'off';
  } catch {
    return true;
  }
}

export function setPaperShadows(on: boolean) {
  current = on;
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off');
  } catch {
    // private mode: holds until the page reloads
  }
}
