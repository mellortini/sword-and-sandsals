/// <reference types="vite/client" />
import { buyTempleRemedy, healAtTemple } from '../core/temple';
import type { TempleRemedy } from '../core/temple';
import type { SavedCharacter } from '../core/save';
import { healingText, remedyRows } from './templeRules';
import './forge.css';
import './temple.css';

const REASON_TEXT = {
  'insufficient-gold': 'Not enough gold.',
  'already-healed': 'There are no wounds to mend.',
} as const;

/**
 * The Glue Temple (#191, logic in core #39): mend wounds for gold and buy remedies for the fight. Each kind of
 * remedy fills a combat slot and shows up as a card on the action bar. Changes stay in a draft; Keep saves,
 * Later (or Escape) closes without paying. Uses the forge's panel styles (forge.css) so the town screens match.
 */
export function openTemple(character: SavedCharacter, save: (character: SavedCharacter) => Promise<void>): Promise<SavedCharacter> {
  const backdrop = document.createElement('div');
  backdrop.className = 'forge temple';
  backdrop.innerHTML = `
    <div class="forge__panel temple__panel" role="dialog" aria-modal="true" aria-labelledby="tpTitle">
      <div class="forge__head">
        <h3 id="tpTitle">Glue Temple</h3>
        <div class="forge__name">${escapeHtml(character.name)} · level ${character.level}</div>
        <div class="temple__gold">Gold <b id="tpGold"></b></div>
      </div>
      <section class="temple__heal" aria-label="Healing">
        <div class="temple__heal-line" id="tpHeal"></div>
        <button type="button" data-act="heal">Mend wounds</button>
      </section>
      <div class="temple__remedies" id="tpRemedies"></div>
      <div class="forge__hint">Each kind of remedy takes one item slot in the fight · unused ones stay in your pack</div>
      <div class="forge__problem" id="tpProblem" role="status"></div>
      <div class="forge__actions">
        <button type="button" data-act="later">Later</button>
        <button type="button" data-act="keep" class="keep">Keep</button>
      </div>
    </div>`;
  document.body.append(backdrop);

  const $ = (id: string) => backdrop.querySelector<HTMLElement>(`#${id}`)!;
  let draft = character;
  let busy = false;

  const refresh = () => {
    $('tpGold').textContent = String(draft.gold);
    const heal = healingText(draft);
    $('tpHeal').textContent = heal.line;
    backdrop.querySelector('[data-act="heal"]')!.setAttribute('aria-disabled', String(!heal.canHeal));
    $('tpRemedies').innerHTML = remedyRows(draft).map((r) => `
      <section class="forge-item temple-remedy" style="--glow:0" aria-label="${r.name}">
        <div class="forge-item__title"><span class="forge-item__name">${r.name}</span>
          <span class="forge-item__tier">${r.owned ? `in pack ×${r.owned}` : 'none in pack'}</span></div>
        <div class="forge-item__stat">${r.effect}</div>
        <div class="forge-item__buttons temple-remedy__buttons">
          <button type="button" data-act="buy" data-remedy="${r.id}" aria-disabled="${!r.affordable}">Buy · ${r.price} gold</button>
        </div>
      </section>`).join('');
    backdrop.querySelector<HTMLButtonElement>('[data-act="keep"]')!.disabled = draft === character || busy;
  };

  return new Promise((resolve) => {
    const keys = new AbortController();
    const close = (result: SavedCharacter) => {
      keys.abort();
      backdrop.remove();
      resolve(result);
    };
    backdrop.addEventListener('click', async (e) => {
      const button = (e.target as HTMLElement).closest('button');
      if (!button || button.disabled || busy) return;
      const action = button.dataset.act;
      if (action === 'heal' || action === 'buy') {
        const result = action === 'heal' ? healAtTemple(draft) : buyTempleRemedy(draft, button.dataset.remedy as TempleRemedy);
        $('tpProblem').textContent = result.ok ? '' : REASON_TEXT[result.reason];
        if (!result.ok) return;
        draft = result.character;
        const focus = action === 'buy' ? `[data-remedy="${button.dataset.remedy}"]` : '[data-act="heal"]';
        refresh();
        backdrop.querySelector<HTMLButtonElement>(focus)?.focus();
      } else if (action === 'later') close(character);
      else if (action === 'keep') {
        busy = true;
        refresh();
        try {
          await save(draft);
          close(draft);
        } catch {
          busy = false;
          $('tpProblem').textContent = 'The game could not be saved. Try again.';
          refresh();
        }
      }
    });
    window.addEventListener('keydown', (e) => {
      e.stopImmediatePropagation();
      if (e.key === 'Escape') close(character);
      else if (e.key.startsWith('Arrow')) {
        e.preventDefault();
        const buttons = [...backdrop.querySelectorAll<HTMLButtonElement>('.temple__heal button, .temple-remedy button')];
        const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
        const step = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : -1;
        buttons[at < 0 ? 0 : Math.max(0, Math.min(buttons.length - 1, at + step))]?.focus();
      }
    }, { capture: true, signal: keys.signal });
    refresh();
    backdrop.querySelector<HTMLButtonElement>('[data-act="heal"]')!.focus();
  });
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
