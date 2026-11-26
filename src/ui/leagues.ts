/// <reference types="vite/client" />
import type { SavedCharacter } from '../core/save';
import { leagueStandings, nextBout } from './leagueRules';
import type { BoutState, LeagueState } from './leagueRules';
import './forge.css';
import './leagues.css';

const LEAGUE_STATE: Record<LeagueState, string> = {
  cleared: '✓ cleared', open: 'open', locked: 'locked · clear the league below', empty: 'fighters still to be written',
};
const BOUT_MARK: Record<BoutState, string> = { won: '✓', next: '►', waiting: '·' };

/** Where the arena sends the gladiator for a league bout (the pre-fight screen builds the fighter from the id). */
export const boutUrl = (id: string) => `?view=prefight&bout=${encodeURIComponent(id)}`;

/**
 * The league ladder (#58): the five leagues of Pulpport, the fighters of each in the order they are met (the last is
 * the champion), what is won, and "Fight next bout" which opens the pre-fight screen for it. Closing or Escape leaves.
 * Uses the forge panel styles (forge.css).
 */
export function openLeagues(character: SavedCharacter): Promise<SavedCharacter> {
  const standings = leagueStandings(character);
  const next = nextBout(character);
  const backdrop = document.createElement('div');
  backdrop.className = 'forge leagues';
  backdrop.innerHTML = `
    <div class="forge__panel leagues__panel" role="dialog" aria-modal="true" aria-labelledby="lgTitle">
      <div class="forge__head">
        <h3 id="lgTitle">Leagues of Pulpport</h3>
        <div class="forge__name">${escapeHtml(character.name)} · level ${character.level}</div>
      </div>
      <ul class="leagues__list">${standings.map(({ league, state, won, bouts }) => `<li class="league ${state}">
        <div class="league__head"><span class="league__name">${league.name}</span>
          <span class="league__state">${bouts.length ? `${won} / ${bouts.length} · ` : ''}${LEAGUE_STATE[state]}</span></div>
        ${bouts.length ? `<ul class="league__bouts">${bouts.map(({ bout, state: s }, i) => `<li class="bout ${s}">
          <span aria-hidden="true">${BOUT_MARK[s]}</span><span>${escapeHtml(bout.name)}${i === bouts.length - 1 ? ' · champion' : ''}</span>
          <span class="bout__level">level ${bout.level}</span>
          ${bout.champion && s !== 'waiting' ? `<span class="bout__champion">“${escapeHtml(bout.champion.line)}”</span>` : ''}</li>`).join('')}</ul>` : ''}
        </li>`).join('')}</ul>
      ${next ? '' : '<p class="league__note">No league has a fighter waiting. More leagues open as their fighters are written.</p>'}
      <div class="forge__actions leagues__actions">
        <button type="button" data-act="fight"${next ? '' : ' disabled'}>${next ? `Fight ${escapeHtml(next.bout.name)}` : 'No bout waiting'}</button>
        <button type="button" data-act="close">Close</button>
      </div>
    </div>`;
  document.body.append(backdrop);
  return new Promise((resolve) => {
    const keys = new AbortController();
    const close = () => {
      keys.abort();
      backdrop.remove();
      resolve(character);
    };
    backdrop.querySelector('[data-act="close"]')!.addEventListener('click', close);
    backdrop.querySelector('[data-act="fight"]')!.addEventListener('click', () => {
      if (next) location.search = boutUrl(next.bout.id);
    });
    window.addEventListener('keydown', (e) => {
      e.stopImmediatePropagation();
      if (e.key === 'Escape') close();
    }, { capture: true, signal: keys.signal });
    backdrop.querySelector<HTMLButtonElement>(next ? '[data-act="fight"]' : '[data-act="close"]')!.focus();
  });
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
