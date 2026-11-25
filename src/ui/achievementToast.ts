/// <reference types="vite/client" />
import type { Achievement } from '../core/achievements';
import './achievementToast.css';

const SHOW_MS = 3200;
/** the next slip waits this long, so at most two are on screen */
const GAP_MS = 1700;

/**
 * Newly unlocked achievements (#203) as paper slips sliding in at the top right corner, one after another (at most two
 * at a time), each for ~3 s, so they never cover the result screen's title. Announced to screen readers through a
 * polite live region. Clicks go through to the game.
 */
export function showAchievements(badges: readonly Achievement[]) {
  if (!badges.length) return;
  let stack = document.querySelector<HTMLElement>('.achievement-toasts');
  if (!stack) {
    stack = document.createElement('div');
    stack.className = 'achievement-toasts';
    stack.setAttribute('role', 'status');
    stack.setAttribute('aria-live', 'polite');
    document.body.append(stack);
  }
  badges.forEach((badge, i) => setTimeout(() => addSlip(stack!, badge), i * GAP_MS));
}

function addSlip(stack: HTMLElement, badge: Achievement) {
  const slip = document.createElement('div');
  slip.className = 'achievement-toast';
  slip.innerHTML = '<span class="achievement-toast__kicker">Achievement</span><b></b><span class="achievement-toast__text"></span>';
  slip.querySelector('b')!.textContent = badge.title;
  slip.querySelector('.achievement-toast__text')!.textContent = badge.description;
  stack.append(slip);
  setTimeout(() => {
    slip.classList.add('leaving');
    setTimeout(() => slip.remove(), 400);
  }, SHOW_MS);
}
