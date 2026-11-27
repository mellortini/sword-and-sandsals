/// <reference types="vite/client" />
import { ACHIEVEMENT_COUNTERS } from '../core/achievements';
import type { SavedCharacter } from '../core/save';
import { trophyCount, trophyGroups, trophyList } from './achievementRules';
import { dressRoom } from './counter';
import { achievementMedal, medalHtml } from './medalIcons';
import './forge.css';
import './medals.css';
import './trophies.css';

const COUNTER_NAMES = { wins: 'Wins', losses: 'Losses', criticals: 'Critical hits', blocks: 'Blocks', charges: 'Charges', gifts: 'Crowd gifts' } as const;

/**
 * The Hall of Fame (#203): every achievement as a medallion with its card, in six groups; earned ones glow and carry a
 * tick, the others wear a padlock. The career counters sit on top. Read-only; Close or Escape leaves.
 */
export function openTrophies(character: SavedCharacter): Promise<SavedCharacter> {
  const counters = character.achievements?.counters;
  const backdrop = document.createElement('div');
  backdrop.className = 'forge trophies';
  const byId = new Map(trophyList(character).map((t) => [t.badge.id, t]));
  backdrop.innerHTML = `
    <div class="forge__panel trophies__panel medal-panel" role="dialog" aria-modal="true" aria-labelledby="tfTitle">
      <div class="medal-board">
        <div class="medal-head">
          <h3 id="tfTitle">Hall of Fame</h3>
          <div class="medal-head__name">${escapeHtml(character.name)}</div>
          <div class="medal-head__score">Earned <b>${trophyCount(character)}</b></div>
        </div>
        <div class="trophies__counters">${ACHIEVEMENT_COUNTERS.map((k) => `<span>${COUNTER_NAMES[k]} <b>${counters?.[k] ?? 0}</b></span>`).join('')}</div>
        <div class="medal-grid" tabindex="0">${trophyGroups(character).map((group) => `<section class="medal-tree" aria-label="${group.name}">
          <h4>${group.name}</h4>
          <ul class="trophies__list">${group.ids.map((id) => {
            const { badge, earned } = byId.get(id)!;
            return `<li class="medal-node trophy ${earned ? 'earned is-done' : 'is-locked'}">${medalHtml(achievementMedal(id))}<span class="medal-card">
              <span class="medal-card__name">${escapeHtml(badge.title)}</span><span class="medal-card__state">${earned ? '✓ earned' : 'not yet'}</span>
              <span class="medal-card__text">${escapeHtml(badge.description)}</span></span></li>`;
          }).join('')}</ul></section>`).join('')}</div>
      </div>
      <div class="medal-actions"><button type="button" data-act="close">Close</button></div>
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
