/// <reference types="vite/client" />
import './phone.css';

/**
 * Phone support (#19): touch-friendly page styles and the "turn your device" card shown in portrait on touch screens.
 * The card is plain CSS (orientation + coarse pointer), so it appears and hides by itself when the phone turns.
 */
export function installPhoneLayout(): void {
  if (document.querySelector('.rotate-hint')) return;
  const hint = document.createElement('div');
  hint.className = 'rotate-hint';
  hint.setAttribute('role', 'alert');
  const device = document.createElement('div');
  device.className = 'rotate-hint__device';
  device.setAttribute('aria-hidden', 'true');
  const title = document.createElement('b');
  title.textContent = 'FOLDED GLORY';
  const text = document.createElement('span');
  text.textContent = 'Turn your device sideways to enter the arena.';
  hint.append(device, title, text);
  document.body.append(hint);
}

/**
 * How much to enlarge on-canvas HUD pieces so they stay readable when the 1920×1080 stage is shrunk onto a small
 * screen. `worldScale` is the stage's scale (screen px per stage px); 1 on desktop, up to 1.3 on a phone.
 */
export function hudScaleFor(worldScale: number): number {
  if (!(worldScale > 0)) return 1;
  return Math.min(1.3, Math.max(1, 0.5 / worldScale));
}
