/// <reference types="vite/client" />
import { FORGE_MATERIALS, salvageForgeItem, upgradeForgeItem } from '../core/forge';
import type { ForgeState } from '../core/forge';
import type { SavedCharacter } from '../core/save';
import { MATERIAL_NAMES, applyForge, materialAmount, forgeRows, forgeState, materialsText } from './forgeRules';
import type { ForgeRow } from './forgeRules';
import './forge.css';
import { dressRoom } from './counter';

const REASON_TEXT = {
  'not-owned': 'That item is no longer in your pack.',
  unavailable: 'This item cannot be forged any further.',
  'insufficient-materials': 'Not enough materials for this upgrade.',
  'material-limit': 'You cannot carry more materials.',
} as const;

/**
 * The forge screen (#189, logic in core #63): every item of the pack as a paper card with its upgrade number and
 * shine, the number an upgrade raises, its cost and what salvaging it gives back. Upgrade and Salvage change a draft;
 * Keep saves it, Later (or Escape) closes without changes. ↑/↓ move between cards, ←/→ between a card's buttons.
 * While it is open, keys do not reach the screen underneath. Equipped items are not in the pack, so they are not here.
 */
export function openForge(character: SavedCharacter, save: (character: SavedCharacter) => Promise<void>): Promise<SavedCharacter> {
  const backdrop = document.createElement('div');
  backdrop.className = 'forge';
  backdrop.innerHTML = `
    <div class="forge__panel" role="dialog" aria-modal="true" aria-labelledby="fgTitle">
      <div class="forge__head">
        <h3 id="fgTitle">Forge</h3>
        <div class="forge__name">${escapeHtml(character.name)} · level ${character.level}</div>
      </div>
      <div class="forge__materials" id="fgMaterials" aria-label="Materials"></div>
      <div class="forge__items" id="fgItems"></div>
      <div class="forge__hint">Each upgrade adds +1 damage or +1 armour, up to +10 · salvaging breaks the item for materials · only items in your pack</div>
      <div class="forge__problem" id="fgProblem" role="status"></div>
      <div class="forge__actions">
        <button type="button" data-act="later">Later</button>
        <button type="button" data-act="keep" class="keep">Keep</button>
      </div>
    </div>`;
  document.body.append(backdrop);
  // the building's counter frame: room, vendor, door (#267)
  dressRoom(backdrop, 'forge');

  const $ = (id: string) => backdrop.querySelector<HTMLElement>(`#${id}`)!;
  const start = forgeState(character);
  let draft: ForgeState = start;
  let busy = false;
  /** card index and button to focus after a redraw, so the keyboard does not lose its place */
  let focusAfter: { index: number; act: string } | undefined;

  const card = (row: ForgeRow) => {
    const next = row.stat.next === undefined ? '<span class="forge-item__max">max</span>' : ` → <b>${row.stat.next}</b>`;
    const cost = row.cost
      ? FORGE_MATERIALS.filter((key) => row.cost![key] > 0).map((key) => {
        const short = row.missing.includes(key);
        return `<span class="forge-cost${short ? ' forge-cost--short' : ''}">${materialAmount(key, row.cost![key])}${short ? ` (have ${draft.materials[key]})` : ''}</span>`;
      }).join('')
      : '<span class="forge-cost">fully forged</span>';
    const canUpgrade = row.cost !== undefined && row.missing.length === 0;
    return `<section class="forge-item" data-index="${row.index}" style="--glow:${row.glow}" aria-label="${escapeHtml(row.label)}">
      <div class="forge-item__title"><span class="forge-item__name">${escapeHtml(row.label)}</span>
        <span class="forge-item__tier">tier ${row.tier}${row.level > 0 ? ` · +${row.level}` : ''}</span></div>
      <div class="forge-item__stat">${row.stat.name} ${row.stat.now}${next}</div>
      <div class="forge-item__cost">${row.cost ? 'Cost: ' : ''}${cost}</div>
      <div class="forge-item__buttons">
        <button type="button" data-act="upgrade" data-index="${row.index}" aria-disabled="${!canUpgrade}">Upgrade</button>
        <button type="button" data-act="salvage" data-index="${row.index}" title="Gives ${materialsText(row.salvage)}">Salvage · ${materialsText(row.salvage)}</button>
      </div>
    </section>`;
  };

  const refresh = () => {
    $('fgMaterials').innerHTML = FORGE_MATERIALS.map((key) => {
      const change = draft.materials[key] - start.materials[key];
      return `<span class="forge-material"><span>${MATERIAL_NAMES[key]}</span><b>${draft.materials[key]}</b>${change ? `<i>${change > 0 ? '+' : ''}${change}</i>` : ''}</span>`;
    }).join('');
    const rows = forgeRows(draft);
    $('fgItems').innerHTML = rows.length
      ? rows.map(card).join('')
      : '<p class="forge__empty">Your pack is empty. Items you buy or win land here, and the forge can improve them.</p>';
    backdrop.querySelector<HTMLButtonElement>('[data-act="keep"]')!.disabled = draft === start || busy;
    if (focusAfter) {
      const cards = [...backdrop.querySelectorAll<HTMLElement>('.forge-item')];
      const target = cards.find((c) => +c.dataset.index! === focusAfter!.index) ?? cards[Math.min(focusAfter.index, cards.length - 1)];
      (target?.querySelector<HTMLButtonElement>(`[data-act="${focusAfter.act}"]`) ?? target?.querySelector('button')
        ?? backdrop.querySelector<HTMLButtonElement>('[data-act="keep"]'))?.focus();
      focusAfter = undefined;
    }
  };

  const act = (kind: 'upgrade' | 'salvage', index: number) => {
    const id = draft.inventory.backpack[index];
    if (id === undefined) return;
    // the core finds the first copy of an id; the pack order keeps equal copies equal, so that is the same item
    const result = kind === 'upgrade' ? upgradeForgeItem(draft, id) : salvageForgeItem(draft, id);
    if (!result.ok) {
      $('fgProblem').textContent = REASON_TEXT[result.reason];
      return;
    }
    $('fgProblem').textContent = kind === 'salvage' ? `Salvaged. Keep to make it final.` : '';
    draft = result.state;
    focusAfter = { index, act: kind };
    refresh();
  };

  const moveFocus = (key: string) => {
    const buttons = [...backdrop.querySelectorAll<HTMLButtonElement>('.forge-item button')];
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (!buttons.length) return;
    if (at < 0) return buttons[0].focus();
    const step = key === 'ArrowDown' ? 2 : key === 'ArrowUp' ? -2 : key === 'ArrowRight' ? 1 : -1;
    buttons[Math.max(0, Math.min(buttons.length - 1, at + step))].focus();
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
      if (action === 'upgrade' || action === 'salvage') act(action, +button.dataset.index!);
      else if (action === 'later') close(character);
      else if (action === 'keep') {
        const kept = applyForge(character, draft);
        busy = true;
        refresh();
        try {
          await save(kept);
          close(kept);
        } catch {
          busy = false;
          $('fgProblem').textContent = 'The game could not be saved. Try again.';
          refresh();
        }
      }
    });
    window.addEventListener('keydown', (e) => {
      e.stopImmediatePropagation();
      if (e.key === 'Escape') close(character);
      else if (e.key.startsWith('Arrow')) {
        e.preventDefault();
        moveFocus(e.key);
      }
    }, { capture: true, signal: keys.signal });
    refresh();
    (backdrop.querySelector<HTMLButtonElement>('.forge-item button') ?? backdrop.querySelector<HTMLButtonElement>('[data-act="later"]'))!.focus();
  });
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
