/// <reference types="vite/client" />
import type { Shop } from '../core/shop';
import type { SavedCharacter } from '../core/save';
import { SHOP_NAMES, buy, saleOffers, sell, shopLeague, shopOffers } from './shopRules';
import './forge.css';
import './shop.css';

const REASON_TEXT: Readonly<Record<string, string>> = {
  'not-stocked': 'This shop does not stock that.',
  'insufficient-gold': 'Not enough gold.',
  'not-owned': 'That item is no longer in your pack.',
  'wrong-shop': 'The shop only buys plain goods of its own trade.',
  'gold-limit': 'You cannot carry more gold.',
};

/**
 * A shop's counter (#205, logic in core #32): Buy lists the stock of the gladiator's league with prices after Charm,
 * Sell lists pack items of this trade with what the shop pays. Bought items go to the pack (wear them in Gear). Changes
 * stay in a draft; Keep saves, Later (or Escape) closes without paying. The vendor in a speech bubble comes with #34.
 */
export function openShop(shop: Shop, character: SavedCharacter, save: (character: SavedCharacter) => Promise<void>): Promise<SavedCharacter> {
  const backdrop = document.createElement('div');
  backdrop.className = 'forge shop';
  backdrop.innerHTML = `
    <div class="forge__panel shop__panel" role="dialog" aria-modal="true" aria-labelledby="spTitle">
      <div class="forge__head">
        <h3 id="spTitle">${SHOP_NAMES[shop]}</h3>
        <div class="forge__name">${shopLeague(character.level)} league goods · Charm ${character.attributes.charm}</div>
        <div class="shop__gold">Gold <b id="spGold"></b></div>
      </div>
      <div class="shop__tabs" role="tablist">
        <button type="button" role="tab" data-tab="buy" aria-selected="true">Buy</button>
        <button type="button" role="tab" data-tab="sell" aria-selected="false">Sell</button>
      </div>
      <div class="shop__list" id="spList" role="tabpanel"></div>
      <div class="forge__problem" id="spProblem" role="status"></div>
      <div class="forge__actions">
        <button type="button" data-act="later">Later</button>
        <button type="button" data-act="keep" class="keep">Keep</button>
      </div>
    </div>`;
  document.body.append(backdrop);

  const $ = (id: string) => backdrop.querySelector<HTMLElement>(`#${id}`)!;
  let draft = character;
  let tab: 'buy' | 'sell' = 'buy';
  let busy = false;

  const refresh = (focus?: string) => {
    $('spGold').textContent = String(draft.gold);
    for (const t of backdrop.querySelectorAll<HTMLButtonElement>('[role="tab"]')) t.setAttribute('aria-selected', String(t.dataset.tab === tab));
    if (tab === 'buy') {
      $('spList').innerHTML = shopOffers(draft, shop).map((o) => `<div class="shop-row">
        <span class="shop-row__name">${o.name}<small>tier ${o.tier}${o.owned ? ` · ${o.owned} in pack` : ''}</small></span>
        <span class="shop-row__stat">${o.stat}${o.wearNote ? ` · <b>${o.wearNote}</b>` : ''}</span>
        <button type="button" data-buy="${o.id}" aria-disabled="${!o.affordable}">Buy · ${o.price} gold</button></div>`).join('');
    } else {
      const sales = saleOffers(draft, shop);
      $('spList').innerHTML = sales.length ? sales.map((s) => `<div class="shop-row">
        <span class="shop-row__name">${s.name}</span><span class="shop-row__stat">${s.stat}</span>
        ${s.price === undefined ? '<span class="shop-row__none">not bought here</span>'
          : `<button type="button" data-sell="${s.index}">Sell · ${s.price} gold</button>`}</div>`).join('')
        : `<p class="forge__empty">Nothing in your pack that the ${SHOP_NAMES[shop].toLowerCase()} buys.</p>`;
    }
    backdrop.querySelector<HTMLButtonElement>('[data-act="keep"]')!.disabled = draft === character || busy;
    if (focus) backdrop.querySelector<HTMLButtonElement>(focus)?.focus();
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
      const problem = $('spProblem');
      if (button.dataset.tab) {
        tab = button.dataset.tab as 'buy' | 'sell';
        problem.textContent = '';
        refresh(`[data-tab="${tab}"]`);
      } else if (button.dataset.buy || button.dataset.sell) {
        const result = button.dataset.buy ? buy(draft, shop, button.dataset.buy) : sell(draft, shop, draft.inventory[+button.dataset.sell!]);
        problem.classList.toggle('ok', result.ok);
        if (!result.ok) {
          problem.textContent = REASON_TEXT[result.reason] ?? 'Not possible.';
          return;
        }
        draft = result.character;
        problem.textContent = button.dataset.buy ? `Bought for ${result.price} gold. Wear it in Gear.` : `Sold for ${result.price} gold.`;
        refresh(button.dataset.buy ? `[data-buy="${button.dataset.buy}"]` : '[data-sell]');
      } else if (button.dataset.act === 'later') close(character);
      else if (button.dataset.act === 'keep') {
        busy = true;
        refresh();
        try {
          await save(draft);
          close(draft);
        } catch {
          busy = false;
          problem.classList.remove('ok');
          problem.textContent = 'The game could not be saved. Try again.';
          refresh();
        }
      }
    });
    window.addEventListener('keydown', (e) => {
      e.stopImmediatePropagation();
      if (e.key === 'Escape') close(character);
      else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const buttons = [...backdrop.querySelectorAll<HTMLButtonElement>('.shop-row button')];
        const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
        buttons[at < 0 ? 0 : Math.max(0, Math.min(buttons.length - 1, at + (e.key === 'ArrowDown' ? 1 : -1)))]?.focus();
      } else if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && (document.activeElement as HTMLElement | null)?.getAttribute('role') === 'tab') {
        (backdrop.querySelector<HTMLButtonElement>(`[data-tab="${tab === 'buy' ? 'sell' : 'buy'}"]`))!.click();
      }
    }, { capture: true, signal: keys.signal });
    refresh('[data-tab="buy"]');
  });
}
