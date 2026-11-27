/// <reference types="vite/client" />
import type { EnchantElement, EnchantPower } from '../core/enchant';
import type { SavedCharacter } from '../core/save';
import { ELEMENT_NAMES, ENCHANT_ELEMENTS, POWERS, applyEnchantment, effectText, enchantPrice, enchantTargets } from './enchanterRules';
import './forge.css';
import './enchanter.css';
import { dressRoom } from './counter';

const REASON_TEXT = {
  'not-owned': 'That weapon is no longer there.',
  unavailable: 'This weapon cannot hold an enchantment.',
  'insufficient-gold': 'Not enough gold.',
} as const;

/**
 * The enchantress (#199, logic in core #56): pick a weapon (held or in the pack), an element and a power, see the price
 * and the effect, and enchant. An enchantment already on the weapon is replaced. Changes stay in a draft; Keep saves,
 * Later (or Escape) closes without paying. Uses the forge panel styles (forge.css).
 */
export function openEnchanter(character: SavedCharacter, save: (character: SavedCharacter) => Promise<void>): Promise<SavedCharacter> {
  const backdrop = document.createElement('div');
  backdrop.className = 'forge enchanter';
  backdrop.innerHTML = `
    <div class="forge__panel enchanter__panel" role="dialog" aria-modal="true" aria-labelledby="enTitle">
      <div class="forge__head">
        <h3 id="enTitle">Enchantress</h3>
        <div class="forge__name">${escapeHtml(character.name)} · Arcana ${character.attributes.arcana}</div>
        <div class="enchanter__gold">Gold <b id="enGold"></b></div>
      </div>
      <div class="enchanter__step"><h4>Weapon</h4><div class="enchanter__weapons" id="enWeapons" role="radiogroup" aria-label="Weapon"></div></div>
      <div class="enchanter__step"><h4>Element</h4><div class="enchanter__choices" id="enElements" role="radiogroup" aria-label="Element"></div></div>
      <div class="enchanter__step"><h4>Power</h4><div class="enchanter__choices" id="enPowers" role="radiogroup" aria-label="Power"></div></div>
      <div class="enchanter__offer" id="enOffer"></div>
      <div class="forge__problem" id="enProblem" role="status"></div>
      <div class="forge__actions">
        <button type="button" data-act="later">Later</button>
        <button type="button" data-act="keep" class="keep">Keep</button>
      </div>
    </div>`;
  document.body.append(backdrop);
  // the building's counter frame: room, vendor, door (#267)
  dressRoom(backdrop, 'enchanter');

  const $ = (id: string) => backdrop.querySelector<HTMLElement>(`#${id}`)!;
  let draft = character;
  let busy = false;
  let weaponKey = enchantTargets(character)[0]?.key;
  let element: EnchantElement = 'fire';
  let power: EnchantPower = 1;

  const radio = (attr: string, value: string, label: string, checked: boolean, extra = '') =>
    `<button type="button" role="radio" data-${attr}="${value}" aria-checked="${checked}" tabindex="${checked ? 0 : -1}">${label}${extra}</button>`;

  const refresh = () => {
    $('enGold').textContent = String(draft.gold);
    const targets = enchantTargets(draft);
    const target = targets.find((t) => t.key === weaponKey) ?? targets[0];
    weaponKey = target?.key;
    $('enWeapons').innerHTML = targets.length
      ? targets.map((t) => radio('weapon', t.key, escapeHtml(t.name), t.key === weaponKey, `<small>${t.where}</small>`)).join('')
      : '<p class="forge__empty">No weapon to enchant. Wear one or keep one in your pack.</p>';
    $('enElements').innerHTML = ENCHANT_ELEMENTS.map((e) => radio('element', e, ELEMENT_NAMES[e], e === element)).join('');
    $('enPowers').innerHTML = POWERS.map((p) => radio('power', String(p), `Power ${p}`, p === power,
      target ? `<small>${enchantPrice(target, p) ?? '–'} gold</small>` : '')).join('');
    const price = target ? enchantPrice(target, power) : undefined;
    $('enOffer').innerHTML = target && price !== undefined
      ? `<div><b>${ELEMENT_NAMES[element]} ${power}</b>: ${effectText({ element, power })}.`
        + `${target.current ? ` <i>Replaces ${ELEMENT_NAMES[target.current.element]} ${target.current.power}.</i>` : ''}</div>`
        + `<button type="button" data-act="enchant" aria-disabled="${draft.gold < price}">Enchant · ${price} gold</button>`
      : '';
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
      const { weapon, element: el, power: pw, act } = button.dataset;
      if (weapon || el || pw) {
        if (weapon) weaponKey = weapon;
        if (el) element = el as EnchantElement;
        if (pw) power = +pw as EnchantPower;
        $('enProblem').textContent = '';
        $('enProblem').classList.remove('ok');
        refresh();
        backdrop.querySelector<HTMLButtonElement>(`[data-${weapon ? 'weapon' : el ? 'element' : 'power'}][aria-checked="true"]`)?.focus();
      } else if (act === 'enchant') {
        const target = enchantTargets(draft).find((t) => t.key === weaponKey);
        if (!target) return;
        const result = applyEnchantment(draft, target, { element, power });
        if (!result.ok) {
          $('enProblem').textContent = REASON_TEXT[result.reason];
          $('enProblem').classList.remove('ok');
          return;
        }
        draft = result.character;
        $('enProblem').textContent = 'Enchanted. Keep to make it final.';
        $('enProblem').classList.add('ok');
        refresh();
        backdrop.querySelector<HTMLButtonElement>('[data-act="keep"]')!.focus();
      } else if (act === 'later') close(character);
      else if (act === 'keep') {
        busy = true;
        refresh();
        try {
          await save(draft);
          close(draft);
        } catch {
          busy = false;
          $('enProblem').textContent = 'The game could not be saved. Try again.';
          refresh();
        }
      }
    });
    window.addEventListener('keydown', (e) => {
      e.stopImmediatePropagation();
      if (e.key === 'Escape') close(character);
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        // move inside the focused row of choices
        const row = (document.activeElement as HTMLElement | null)?.closest('[role="radiogroup"]');
        if (!row) return;
        e.preventDefault();
        const buttons = [...row.querySelectorAll<HTMLButtonElement>('button')];
        const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
        buttons[(at + (e.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length]?.click();
      }
    }, { capture: true, signal: keys.signal });
    refresh();
    (backdrop.querySelector<HTMLButtonElement>('[data-weapon][aria-checked="true"]') ?? backdrop.querySelector<HTMLButtonElement>('[data-act="later"]'))!.focus();
  });
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
