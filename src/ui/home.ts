import { sleepAtHome, sleepQuote } from '../core/home';
import type { SavedCharacter } from '../core/save';
import './forge.css';
import './temple.css';

/**
 * The gladiator's home (#45, rules in core/home): sleep to mend a part of the wounds for free; each night takes a day.
 * Every night is saved at once. Leave or Escape closes. Uses the temple's panel styles.
 */
export function openHome(character: SavedCharacter, save: (character: SavedCharacter) => Promise<void>): Promise<SavedCharacter> {
  const backdrop = document.createElement('div');
  backdrop.className = 'forge temple home';
  backdrop.innerHTML = `
    <div class="forge__panel temple__panel" role="dialog" aria-modal="true" aria-labelledby="hmTitle">
      <div class="forge__head">
        <h3 id="hmTitle">Home</h3>
        <div class="forge__name">${escapeHtml(character.name)} · level ${character.level}</div>
        <div class="temple__gold">Day <b id="hmDay"></b></div>
      </div>
      <section class="temple__heal" aria-label="Sleep">
        <div class="temple__heal-line" id="hmLine"></div>
        <button type="button" data-act="sleep">Sleep</button>
      </section>
      <div class="forge__hint">A night in your own bed is free and takes one day · the Glue Temple mends at once, for gold</div>
      <div class="forge__problem" id="hmProblem" role="status"></div>
      <div class="forge__actions">
        <button type="button" data-act="leave">Leave</button>
      </div>
    </div>`;
  document.body.append(backdrop);

  const $ = (id: string) => backdrop.querySelector<HTMLElement>(`#${id}`)!;
  const sleepButton = backdrop.querySelector<HTMLButtonElement>('[data-act="sleep"]')!;
  const leaveButton = backdrop.querySelector<HTMLButtonElement>('[data-act="leave"]')!;
  let current = character;
  let busy = false;

  const refresh = () => {
    const { day, health, maxHealth, after } = sleepQuote(current);
    $('hmDay').textContent = String(day);
    $('hmLine').textContent = after > health
      ? `Health ${health} / ${maxHealth} · a night restores ${after - health} HP`
      : `Health ${health} / ${maxHealth} · you are rested`;
    sleepButton.setAttribute('aria-disabled', String(after <= health));
  };

  return new Promise((resolve) => {
    const keys = new AbortController();
    const close = () => {
      if (busy) return;
      keys.abort();
      backdrop.remove();
      resolve(current);
    };
    leaveButton.addEventListener('click', close);
    sleepButton.addEventListener('click', async () => {
      const slept = sleepAtHome(current);
      if (busy || slept === current) return;
      busy = true;
      $('hmProblem').textContent = '';
      try {
        await save(slept);
        current = slept;
      } catch {
        $('hmProblem').textContent = 'The game could not be saved. Try again.';
      }
      busy = false;
      refresh();
    });
    window.addEventListener('keydown', (e) => {
      e.stopImmediatePropagation();
      if (e.key === 'Escape') close();
      else if (e.key.startsWith('Arrow')) {
        e.preventDefault();
        (document.activeElement === sleepButton ? leaveButton : sleepButton).focus();
      }
    }, { capture: true, signal: keys.signal });
    refresh();
    sleepButton.focus();
  });
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
