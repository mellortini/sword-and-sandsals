import { BOOK_FULL, BOOK_THRESHOLDS, bookEntries, bookValue } from '../core/duelBook';
import type { SavedCharacter } from '../core/save';
import { DUEL_CHALLENGES } from '../data/duelChallenges';
import { openTrophies } from './trophies';
import { trophyCount } from './achievementRules';
import './forge.css';
import './duelBook.css';

/**
 * The Book of Duels (#293, rules in core/duelBook): an old book open on two pages. The left page lists the signed
 * entries with their worth, day and witness; the right one the challenges still open and what the book's value opens
 * (the Masters' trials, the Grand Tournament). Read only. Hall of Fame opens the achievements; Close or Escape closes.
 */
export function openDuelBook(character: SavedCharacter): Promise<SavedCharacter> {
  const entries = bookEntries(character);
  const value = bookValue(entries);
  const signed = new Set(entries.map((e) => e.id));
  const open = DUEL_CHALLENGES.filter((c) => !signed.has(`challenge.${c.id}`));
  const backdrop = document.createElement('div');
  backdrop.className = 'forge duel-book';
  backdrop.innerHTML = `
    <div class="duel-book__panel" role="dialog" aria-modal="true" aria-labelledby="dbTitle">
      <div class="duel-book__head">
        <h3 id="dbTitle">Book of Duels</h3>
        <div class="duel-book__name">${escapeHtml(character.name)} · small letters</div>
        <div class="duel-book__value" aria-label="Book value ${value} of ${BOOK_FULL}">
          <b>${value}</b> / ${BOOK_FULL}
          <span class="duel-book__bar"><span style="width:${Math.min(100, (100 * value) / BOOK_FULL)}%"></span></span>
        </div>
      </div>
      <div class="duel-book__pages">
        <section class="duel-book__page" aria-label="Signed entries" tabindex="0">
          <h4>Witnessed and signed</h4>
          ${entries.length ? `<ol class="duel-book__entries">${entries.map((e) => `<li>
            <span class="duel-book__entry">${escapeHtml(e.title)}</span><span class="duel-book__worth">+${e.value}</span>
            <span class="duel-book__sign">${e.day !== undefined ? `day ${e.day} · ` : ''}<i>${escapeHtml(e.witness)}</i></span></li>`).join('')}</ol>`
            : '<p class="duel-book__empty">Not a line yet. Win a bout and someone will sign it.</p>'}
        </section>
        <section class="duel-book__page" aria-label="Open challenges" tabindex="0">
          <h4>What the book opens</h4>
          <ul class="duel-book__gates">${BOOK_THRESHOLDS.map((t) => `<li class="${value >= t.value ? 'is-open' : ''}">
            <span>${escapeHtml(t.name)}</span><b>${value >= t.value ? 'open' : t.value}</b></li>`).join('')}</ul>
          <h4>Challenges not yet met</h4>
          <ul class="duel-book__open">${open.map((c) => `<li>
            <span class="duel-book__entry">${escapeHtml(c.title)}</span><span class="duel-book__worth">${c.value}</span>
            <span class="duel-book__goal">${escapeHtml(c.goal)}</span></li>`).join('')}</ul>
        </section>
      </div>
      <div class="duel-book__actions">
        <button type="button" data-act="fame">Hall of Fame · ${trophyCount(character)}</button>
        <button type="button" data-act="close">Close</button>
      </div>
    </div>`;
  document.body.append(backdrop);
  const close = backdrop.querySelector<HTMLButtonElement>('[data-act="close"]')!;
  const fame = backdrop.querySelector<HTMLButtonElement>('[data-act="fame"]')!;

  return new Promise((resolve) => {
    const keys = new AbortController();
    let away = false;
    const done = () => {
      keys.abort();
      backdrop.remove();
      resolve(character);
    };
    close.addEventListener('click', done);
    fame.addEventListener('click', async () => {
      // the achievements over the book; back to the book when they close
      away = true;
      backdrop.hidden = true;
      await openTrophies(character);
      backdrop.hidden = false;
      away = false;
      fame.focus();
    });
    window.addEventListener('keydown', (e) => {
      if (away) return;
      e.stopImmediatePropagation();
      if (e.key === 'Escape') done();
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        (document.activeElement === close ? fame : close).focus();
      }
    }, { capture: true, signal: keys.signal });
    close.focus();
  });
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
