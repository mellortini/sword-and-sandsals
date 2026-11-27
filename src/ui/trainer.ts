/// <reference types="vite/client" />
import type { SavedCharacter } from '../core/save';
import { resetAttributes } from '../core/trainer';
import type { EquipmentLoadout } from '../core/types';
import { openLevelUp } from './levelUp';
import { pointsText, trainerView } from './trainerRules';
import './forge.css';
import './trainer.css';
import { dressRoom } from './counter';

const BLOCKED_TEXT = {
  'nothing-to-reset': 'Nothing trained yet, so there is nothing to reset.',
  'insufficient-gold': 'Not enough gold for a reset.',
} as const;

/**
 * The trainer (#193, logic in core #40): the gladiator's attributes with what was trained above the base,
 * "Place points" for saved points (the level-up screen, #24) and a paid reset that gives every trained point back.
 * The reset asks once before paying and saves at once; Place points saves on its own Keep. Close or Escape leaves.
 * While it is open, keys do not reach the screen underneath.
 */
export function openTrainer(
  character: SavedCharacter, loadout: EquipmentLoadout, save: (character: SavedCharacter) => Promise<void>,
): Promise<SavedCharacter> {
  const backdrop = document.createElement('div');
  backdrop.className = 'forge trainer';
  backdrop.innerHTML = `
    <div class="forge__panel trainer__panel" role="dialog" aria-modal="true" aria-labelledby="trTitle">
      <div class="forge__head">
        <h3 id="trTitle">Trainer</h3>
        <div class="forge__name">${escapeHtml(character.name)} · level ${character.level}</div>
        <div class="trainer__gold">Gold <b id="trGold"></b></div>
      </div>
      <div class="trainer__rows" id="trRows"></div>
      <div class="trainer__actions">
        <button type="button" data-act="place" class="trainer__main">Place points</button>
        <button type="button" data-act="reset">Reset attributes</button>
      </div>
      <div class="trainer__confirm" id="trConfirm" hidden>
        <span id="trConfirmText"></span>
        <button type="button" data-act="pay" class="trainer__main">Pay and reset</button>
        <button type="button" data-act="cancel">Cancel</button>
      </div>
      <div class="forge__problem" id="trProblem" role="status"></div>
      <div class="forge__actions trainer__close">
        <button type="button" data-act="close">Close</button>
      </div>
    </div>`;
  document.body.append(backdrop);
  // the building's counter frame: room, vendor, door (#267)
  dressRoom(backdrop, 'trainer');

  const $ = (id: string) => backdrop.querySelector<HTMLElement>(`#${id}`)!;
  const button = (act: string) => backdrop.querySelector<HTMLButtonElement>(`[data-act="${act}"]`)!;
  let current = character;
  let busy = false;

  const refresh = () => {
    const view = trainerView(current);
    $('trGold').textContent = String(current.gold);
    $('trRows').innerHTML = view.rows.map((r) => `<div class="trainer__row${r.trained ? ' trained' : ''}">
      <span>${r.label}</span><b>${r.value}</b><i>${r.trained ? `+${r.trained} trained` : 'base'}</i></div>`).join('');
    const place = button('place');
    place.textContent = view.points ? `Place ${pointsText(view.points)}` : 'No points to place';
    place.disabled = view.points === 0 || busy;
    const reset = button('reset');
    reset.textContent = view.refund ? `Reset · ${view.price} gold · get ${pointsText(view.refund)} back` : 'Reset attributes';
    reset.setAttribute('aria-disabled', String(view.resetBlocked !== undefined || busy));
    reset.title = view.resetBlocked ? BLOCKED_TEXT[view.resetBlocked] : '';
  };

  const confirm = (open: boolean) => {
    const view = trainerView(current);
    $('trConfirm').hidden = !open;
    $('trConfirmText').textContent = `Pay ${view.price} gold to undo all training? You get ${pointsText(view.refund)} back to place again.`;
    (open ? button('cancel') : button('reset')).focus();
  };

  return new Promise((resolve) => {
    let keys = new AbortController();
    const listen = () => {
      keys = new AbortController();
      window.addEventListener('keydown', (e) => {
        e.stopImmediatePropagation();
        if (e.key !== 'Escape') return;
        if (!$('trConfirm').hidden) confirm(false);
        else close();
      }, { capture: true, signal: keys.signal });
    };
    const close = () => {
      keys.abort();
      backdrop.remove();
      resolve(current);
    };
    backdrop.addEventListener('click', async (e) => {
      const target = (e.target as HTMLElement).closest('button');
      if (!target || target.disabled || busy) return;
      $('trProblem').textContent = '';
      $('trProblem').classList.remove('ok');
      switch (target.dataset.act) {
        case 'place': {
          // the level-up screen takes the keys while it is open and saves on its own Keep
          keys.abort();
          backdrop.hidden = true;
          current = await openLevelUp(current, loadout, save);
          backdrop.hidden = false;
          listen();
          refresh();
          button('place').focus();
          break;
        }
        case 'reset': {
          const blocked = trainerView(current).resetBlocked;
          if (blocked) $('trProblem').textContent = BLOCKED_TEXT[blocked];
          else confirm(true);
          break;
        }
        case 'cancel':
          confirm(false);
          break;
        case 'pay': {
          const result = resetAttributes(current);
          if (!result.ok) {
            $('trProblem').textContent = result.reason in BLOCKED_TEXT ? BLOCKED_TEXT[result.reason as keyof typeof BLOCKED_TEXT] : 'The reset is not possible.';
            confirm(false);
            break;
          }
          busy = true;
          refresh();
          try {
            await save(result.character);
            current = result.character;
            $('trProblem').textContent = 'Training undone. Place the points again.';
            $('trProblem').classList.add('ok');
          } catch {
            $('trProblem').textContent = 'The game could not be saved. Nothing was paid. Try again.';
          }
          busy = false;
          $('trConfirm').hidden = true;
          refresh();
          button('place').focus();
          break;
        }
        case 'close':
          close();
          break;
      }
    });
    listen();
    refresh();
    (button('place').disabled ? button('reset') : button('place')).focus();
  });
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
