/// <reference types="vite/client" />
import { ACHIEVEMENT_COUNTERS } from '../core/achievements';
import type { SavedCharacter } from '../core/save';
import { trophyCount, trophyList } from './achievementRules';
import './forge.css';
import './trophies.css';
import { dressRoom } from './counter';

const COUNTER_NAMES = { wins: 'Wins', losses: 'Losses', criticals: 'Critical hits', blocks: 'Blocks', charges: 'Charges', gifts: 'Crowd gifts' } as const;

/**
 * The Hall of Fame (#203): every achievement as a paper plaque, earned ones gilded with a tick, and the career counters.
 * Read-only; Close or Escape leaves. Uses the forge panel styles (forge.css).
 */
export function openTrophies(character: SavedCharacter): Promise<SavedCharacter> {
  const counters = character.achievements?.counters;
  const backdrop = document.createElement('div');
  backdrop.className = 'forge trophies';
  backdrop.innerHTML = `
    <div class="forge__panel trophies__panel" role="dialog" aria-modal="true" aria-labelledby="tfTitle">
      <div class="forge__head">
        <h3 id="tfTitle">Hall of Fame</h3>
        <div class="forge__name">${escapeHtml(character.name)}</div>
        <div class="trophies__count">Earned <b>${trophyCount(character)}</b></div>
      </div>
      <div class="trophies__counters">${ACHIEVEMENT_COUNTERS.map((k) => `<span>${COUNTER_NAMES[k]} <b>${counters?.[k] ?? 0}</b></span>`).join('')}</div>
      <ul class="trophies__list">${trophyList(character).map(({ badge, earned }) => `<li class="trophy${earned ? ' earned' : ''}">
        <span class="trophy__title">${escapeHtml(badge.title)}</span>
        <span class="trophy__state">${earned ? '✓ earned' : 'not yet'}</span>
        <span class="trophy__text">${escapeHtml(badge.description)}</span></li>`).join('')}</ul>
      <div class="forge__actions trophies__close"><button type="button" data-act="close">Close</button></div>
    </div>`;
  document.body.append(backdrop);
  // the building's counter frame: room, vendor, door (#267)
  dressRoom(backdrop, 'trophies');
  return new Promise((resolve) => {
    const keys = new AbortController();
    const close = () => {
      keys.abort();
      backdrop.remove();
      resolve(character);
    };
    backdrop.querySelector('[data-act="close"]')!.addEventListener('click', close);
    window.addEventListener('keydown', (e) => {
      e.stopImmediatePropagation();
      if (e.key === 'Escape') close();
    }, { capture: true, signal: keys.signal });
    backdrop.querySelector<HTMLButtonElement>('[data-act="close"]')!.focus();
  });
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
