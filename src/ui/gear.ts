/// <reference types="vite/client" />
import type { SavedCharacter } from '../core/save';
import type { EquipmentSlot } from '../core/types';
import { GEAR_SLOTS, SLOT_NAMES, gearItem, gearTotals, savedInventory, takeOff, wear, wearProblem } from './gearRules';
import './forge.css';
import './gear.css';
import { dressRoom } from './counter';

/**
 * The gear screen (#197, logic in core #31): what the gladiator wears in each slot and the wearable items in the
 * pack. Wear swaps an item in (the old one goes to the pack), Take off puts it back. The puppet's look, the hands and
 * the forge levels follow, so the arena fights with exactly this. Changes stay in a draft; Keep saves, Later (or
 * Escape) closes without changes. ↑/↓ move between buttons. Uses the forge panel styles (forge.css).
 */
export function openGear(character: SavedCharacter, save: (character: SavedCharacter) => Promise<void>): Promise<SavedCharacter> {
  const backdrop = document.createElement('div');
  backdrop.className = 'forge gear';
  backdrop.innerHTML = `
    <div class="forge__panel gear__panel" role="dialog" aria-modal="true" aria-labelledby="grTitle">
      <div class="forge__head">
        <h3 id="grTitle">Gear</h3>
        <div class="forge__name">${escapeHtml(character.name)} · level ${character.level} · Might ${character.attributes.might}</div>
        <div class="gear__totals" id="grTotals"></div>
      </div>
      <div class="gear__columns">
        <section aria-labelledby="grWorn"><h4 id="grWorn">Worn</h4><div class="gear__worn" id="grSlots"></div></section>
        <section aria-labelledby="grPack"><h4 id="grPack">Pack</h4><div class="gear__pack" id="grItems"></div></section>
      </div>
      <div class="forge__problem" id="grProblem" role="status"></div>
      <div class="forge__actions">
        <button type="button" data-act="later">Later</button>
        <button type="button" data-act="keep" class="keep">Keep</button>
      </div>
    </div>`;
  document.body.append(backdrop);
  // the building's counter frame: room, vendor, door (#267)
  dressRoom(backdrop, 'gear');

  const $ = (id: string) => backdrop.querySelector<HTMLElement>(`#${id}`)!;
  let draft = character;
  let busy = false;

  const refresh = (focus?: string) => {
    const totals = gearTotals(draft);
    $('grTotals').innerHTML = `Armour <b>${totals.armour}</b> · Weight <b>${totals.weight}</b>${totals.fullSet ? ' · <i>full set +10%</i>' : ''}`;
    const worn = savedInventory(draft).equipped;
    $('grSlots').innerHTML = GEAR_SLOTS.map((slot) => {
      const id = worn[slot];
      const item = id === undefined ? undefined : gearItem(id);
      return `<div class="gear-slot${item ? '' : ' empty'}">
        <span class="gear-slot__name">${SLOT_NAMES[slot]}</span>
        <span class="gear-slot__item">${item ? escapeHtml(item.name) : 'nothing'}</span>
        <span class="gear-slot__stat">${item ? item.stat : ''}</span>
        ${item ? `<button type="button" data-act="off" data-slot="${slot}">Take off</button>` : '<span></span>'}
      </div>`;
    }).join('');
    const pack = draft.inventory.map((id, index) => ({ id, index, item: gearItem(id) })).filter((p) => p.item);
    $('grItems').innerHTML = pack.length ? pack.map(({ id, index, item }) => {
      const problem = wearProblem(draft, id);
      const where = item!.slot === 'hand' ? 'Main hand' : SLOT_NAMES[item!.slot];
      return `<div class="gear-item">
        <span class="gear-item__name">${escapeHtml(item!.name)}</span>
        <span class="gear-item__stat">${where} · ${item!.stat}${problem ? ` · <b>${problem}</b>` : ''}</span>
        <button type="button" data-act="wear" data-index="${index}" aria-disabled="${problem !== undefined}">Wear</button>
      </div>`;
    }).join('') : '<p class="forge__empty">No gear in the pack. Items you buy or win land here.</p>';
    backdrop.querySelector<HTMLButtonElement>('[data-act="keep"]')!.disabled = draft === character || busy;
    if (focus) (backdrop.querySelector<HTMLButtonElement>(focus) ?? backdrop.querySelector<HTMLButtonElement>('.gear button'))?.focus();
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
      if (action === 'wear' || action === 'off') {
        const result = action === 'wear'
          ? wear(draft, draft.inventory[+button.dataset.index!])
          : takeOff(draft, button.dataset.slot as EquipmentSlot);
        $('grProblem').textContent = result.ok ? '' : `Cannot wear it: ${result.problem}.`;
        if (!result.ok) return;
        draft = result.character;
        refresh(action === 'wear' ? `[data-act="wear"][data-index="${button.dataset.index}"]` : `[data-act="off"]`);
      } else if (action === 'later') close(character);
      else if (action === 'keep') {
        busy = true;
        refresh();
        try {
          await save(draft);
          close(draft);
        } catch {
          busy = false;
          $('grProblem').textContent = 'The game could not be saved. Try again.';
          refresh();
        }
      }
    });
    window.addEventListener('keydown', (e) => {
      e.stopImmediatePropagation();
      if (e.key === 'Escape') close(character);
      else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const buttons = [...backdrop.querySelectorAll<HTMLButtonElement>('.gear-slot button, .gear-item button, .forge__actions button:not(:disabled)')];
        const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
        const step = e.key === 'ArrowDown' ? 1 : -1;
        buttons[at < 0 ? 0 : (at + step + buttons.length) % buttons.length]?.focus();
      }
    }, { capture: true, signal: keys.signal });
    refresh('.gear button');
  });
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
