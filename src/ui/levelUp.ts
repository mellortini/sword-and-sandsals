/// <reference types="vite/client" />
import type { SavedCharacter } from '../core/save';
import { deriveStats } from '../core/stats';
import type { EquipmentLoadout } from '../core/types';
import { ATTRIBUTE_INFO } from './creatorRules';
import { addPoint, canAdd, canTakeBack, commitPoints, placedPoints, startDraft, takeBackPoint } from './levelUpRules';
import type { PointDraft } from './levelUpRules';
import './levelUp.css';

/**
 * The level-up screen (#24): a paper panel over the game where the gladiator's free attribute points are placed.
 * Keep saves the character through `save` and resolves with it; Later (or Escape) closes it and keeps the points
 * for another time. While it is open, keys do not reach the screen underneath.
 */
export function openLevelUp(
  character: SavedCharacter,
  loadout: EquipmentLoadout,
  save: (character: SavedCharacter) => Promise<void>,
): Promise<SavedCharacter> {
  const backdrop = document.createElement('div');
  backdrop.className = 'level-up';
  backdrop.innerHTML = `
    <div class="level-up__panel" role="dialog" aria-modal="true" aria-labelledby="lvlTitle">
      <h3 id="lvlTitle">Level ${character.level}</h3>
      <div class="level-up__name">${escapeHtml(character.name)}</div>
      <div class="level-up__points">Attribute points <b id="lvlFree"></b></div>
      ${ATTRIBUTE_INFO.map((a) => `<div class="level-up__row" title="${a.hint}"><span>${a.label}</span>`
        + `<button type="button" data-attr="${a.key}" data-d="-1" aria-label="take back from ${a.label}">−</button>`
        + `<span class="v" id="lvl_${a.key}"></span>`
        + `<button type="button" data-attr="${a.key}" data-d="1" aria-label="add to ${a.label}">+</button>`
        + `<span class="hint">${a.hint}</span></div>`).join('')}
      <div class="level-up__derived" id="lvlDerived"></div>
      <div class="level-up__problem" id="lvlProblem" role="status"></div>
      <div class="level-up__actions">
        <button type="button" data-act="later">Later</button>
        <button type="button" data-act="keep" class="keep">Keep</button>
      </div>
    </div>`;
  document.body.append(backdrop);

  const $ = (id: string) => backdrop.querySelector<HTMLElement>(`#${id}`)!;
  const before = deriveStats(character.attributes, loadout);
  let draft: PointDraft = startDraft(character);
  let busy = false;

  const refresh = () => {
    $('lvlFree').textContent = String(draft.free);
    $('lvlFree').classList.toggle('done', draft.free === 0);
    for (const { key } of ATTRIBUTE_INFO) {
      const v = $(`lvl_${key}`);
      v.textContent = String(draft.attributes[key]);
      v.classList.toggle('up', draft.attributes[key] > draft.base[key]);
      backdrop.querySelector<HTMLButtonElement>(`button[data-attr="${key}"][data-d="-1"]`)!.disabled = !canTakeBack(draft, key);
      backdrop.querySelector<HTMLButtonElement>(`button[data-attr="${key}"][data-d="1"]`)!.disabled = !canAdd(draft, key);
    }
    const now = deriveStats(draft.attributes, loadout);
    const delta = (a: number, b: number) => (b > a ? ` <i>+${b - a}</i>` : '');
    $('lvlDerived').innerHTML = `Health <b>${now.maxHealth}</b>${delta(before.maxHealth, now.maxHealth)}`
      + ` · Energy <b>${now.maxEnergy}</b>${delta(before.maxEnergy, now.maxEnergy)}`;
    backdrop.querySelector<HTMLButtonElement>('[data-act="keep"]')!.disabled = placedPoints(draft) === 0 || busy;
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
      if (!button || button.disabled) return;
      if (button.dataset.attr) {
        const key = button.dataset.attr as (typeof ATTRIBUTE_INFO)[number]['key'];
        draft = button.dataset.d === '1' ? addPoint(draft, key) : takeBackPoint(draft, key);
        refresh();
      } else if (button.dataset.act === 'later') {
        close(character);
      } else if (button.dataset.act === 'keep') {
        const kept = commitPoints(character, draft);
        busy = true;
        refresh();
        try {
          await save(kept);
          close(kept);
        } catch {
          busy = false;
          $('lvlProblem').textContent = 'The game could not be saved. Try again.';
          refresh();
        }
      }
    });
    // the result screen listens on window too: answer first and keep its Enter / Escape away
    window.addEventListener('keydown', (e) => {
      e.stopImmediatePropagation();
      if (e.key === 'Escape') close(character);
    }, { capture: true, signal: keys.signal });
    refresh();
    backdrop.querySelector<HTMLButtonElement>('button[data-d="1"]')?.focus();
  });
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
