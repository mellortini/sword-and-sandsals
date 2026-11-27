/// <reference types="vite/client" />
import type { Shop } from '../core/shop';
import type { SavedCharacter } from '../core/save';
import type { Look } from '../rig/PaperRig';
import type { LookPreview } from './lookPreview';
import { VENDOR_AT, loadNpcs, mouthOpen, npcUrl } from './npcs';
import { ROOM_AT, roomUrl } from './shopRooms';
import { SHOP_NAMES, buy, compareWorn, lookWith, saleOffers, sell, shopLeague, shopOffers, vendorLine } from './shopRules';
import type { ShopMoment } from './shopRules';
import { frameFill, loadUiSheet } from './uiSheet';
import './forge.css';
import './shop.css';

const REASON_TEXT: Readonly<Record<string, string>> = {
  'not-stocked': 'This shop does not stock that.',
  'insufficient-gold': 'Not enough gold.',
  'not-owned': 'That item is no longer in your pack.',
  'wrong-shop': 'The shop only buys plain goods of its own trade.',
  'gold-limit': 'You cannot carry more gold.',
};

/** seconds a line keeps the vendor's mouth moving: a little per letter, never too short or long */
const talkTime = (text: string) => Math.min(3, Math.max(0.8, text.length * 0.035));

/**
 * A shop (#205, logic in core #32, screen #34) in its own room (#35): the vendor's bust on the left talks in a speech
 * bubble (#33), the gladiator in the middle tries on the item under the pointer or focus, the goods are on a paper
 * scroll on the right. Buy lists the stock of the gladiator's league with prices after Charm and how each compares with
 * what is worn; Sell lists pack items of this trade with what the shop pays. Bought items go to the pack (wear them in
 * Gear). Changes stay in a draft; Keep saves, Later (or Escape) closes without paying.
 */
export function openShop(
  shop: Shop, character: SavedCharacter, save: (character: SavedCharacter) => Promise<void>, preview?: LookPreview,
): Promise<SavedCharacter> {
  const backdrop = document.createElement('div');
  backdrop.className = 'forge shop shop--room';
  backdrop.style.setProperty('--room', `url("${roomUrl(ROOM_AT[shop] ?? 'forge')}")`);
  backdrop.innerHTML = `
    <div class="shop__vendor" aria-hidden="true">
      <div class="shop__bubble" id="spSay"></div>
      <div class="shop__bust" id="spBust"><img class="shop__face" alt=""><img class="shop__face shop__face--talk" alt=""></div>
      <div class="shop__who" id="spWho"></div>
    </div>
    <div class="shop__preview" id="spTry" aria-hidden="true"></div>
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
  let closed = false;

  // ---------------------------------------------------------------- the vendor: bust, name, lines with a moving mouth
  const bust = $('spBust');
  const said: Partial<Record<ShopMoment, number>> = {};
  let talking = 0;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const say = (moment: ShopMoment) => {
    const n = said[moment] ?? 0;
    said[moment] = n + 1;
    const text = vendorLine(shop, moment, n);
    $('spSay').textContent = text;
    const id = ++talking, start = performance.now(), length = talkTime(text);
    const flap = (now: number) => {
      if (id !== talking || closed) return;
      const t = (now - start) / 1000;
      bust.classList.toggle('talking', !still && mouthOpen(t, length));
      if (t < length) requestAnimationFrame(flap);
    };
    requestAnimationFrame(flap);
  };
  void loadNpcs().then((npcs) => {
    const npc = npcs?.[VENDOR_AT[shop]];
    if (!npc || closed) return;
    const [shut, open] = bust.querySelectorAll('img');
    shut.src = npcUrl(npc);
    open.src = npcUrl(npc, true);
    $('spWho').innerHTML = `${npc.name}<small>${npc.role}</small>`;
  });
  // the goods are written on a paper scroll from the UI kit (#16); without the sheet the dark panel stays
  void loadUiSheet().then((sheet) => {
    if (!sheet || closed) return;
    const panel = backdrop.querySelector<HTMLElement>('.shop__panel')!;
    for (const [part, key] of [['top', 'scroll_top'], ['body', 'scroll_body'], ['bottom', 'scroll_bottom']] as const) {
      const css = frameFill(sheet, key);
      if (!css) return;
      panel.style.setProperty(`--scroll-${part}-image`, css.backgroundImage);
      panel.style.setProperty(`--scroll-${part}-size`, css.backgroundSize);
      panel.style.setProperty(`--scroll-${part}-pos`, css.backgroundPosition);
    }
    panel.classList.add('shop__panel--scroll');
  });

  // ---------------------------------------------------------------- the gladiator trying things on
  const tryOn = $('spTry');
  let shown: string | null = null;
  let previewId = 0;
  const showLook = (key: string, look: Look) => {
    if (!preview || key === shown || closed) return;
    shown = key;
    const id = ++previewId;
    void preview(look).then((canvas) => {
      if (id !== previewId || closed) return;
      canvas.className = 'shop__puppet';
      tryOn.replaceChildren(canvas);
    }).catch(() => undefined);
  };
  const showWorn = () => showLook(`worn:${JSON.stringify(draft.look)}`, draft.look);
  if (!preview) tryOn.hidden = true;

  const compare = (id: string) => {
    const c = compareWorn(draft, id);
    if (!c) return '';
    const sign = c.delta > 0 ? `+${c.delta}` : c.delta < 0 ? `−${-c.delta}` : '±0';
    const cls = c.delta > 0 ? 'up' : c.delta < 0 ? 'down' : 'same';
    return `<span class="shop-row__cmp shop-row__cmp--${cls}">${sign} ${c.label.toLowerCase()} ${c.worn ? `vs ${c.worn}` : '· nothing worn'}</span>`;
  };

  const refresh = (focus?: string) => {
    $('spGold').textContent = String(draft.gold);
    for (const t of backdrop.querySelectorAll<HTMLButtonElement>('[role="tab"]')) t.setAttribute('aria-selected', String(t.dataset.tab === tab));
    if (tab === 'buy') {
      $('spList').innerHTML = shopOffers(draft, shop).map((o) => `<div class="shop-row" data-try="${o.id}">
        <span class="shop-row__name">${o.name}<small>tier ${o.tier}${o.owned ? ` · ${o.owned} in pack` : ''}</small></span>
        <span class="shop-row__stat">${o.stat}${o.wearNote ? ` · <b>${o.wearNote}</b>` : ''}${compare(o.id)}</span>
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

  // pointing at or focusing an offer puts it on the gladiator; leaving the list shows what is worn again
  const tryRow = (e: Event) => {
    const row = (e.target as HTMLElement).closest<HTMLElement>('[data-try]');
    if (row) showLook(`try:${row.dataset.try}`, lookWith(draft, row.dataset.try!));
  };
  $('spList').addEventListener('mouseover', tryRow);
  $('spList').addEventListener('focusin', tryRow);
  $('spList').addEventListener('mouseleave', showWorn);

  return new Promise((resolve) => {
    const keys = new AbortController();
    const close = (result: SavedCharacter) => {
      closed = true;
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
        showWorn();
      } else if (button.dataset.buy || button.dataset.sell) {
        const result = button.dataset.buy ? buy(draft, shop, button.dataset.buy) : sell(draft, shop, draft.inventory[+button.dataset.sell!]);
        problem.classList.toggle('ok', result.ok);
        if (!result.ok) {
          problem.textContent = REASON_TEXT[result.reason] ?? 'Not possible.';
          say(result.reason === 'insufficient-gold' ? 'poor' : 'refused');
          return;
        }
        draft = result.character;
        problem.textContent = button.dataset.buy ? `Bought for ${result.price} gold. Wear it in Gear.` : `Sold for ${result.price} gold.`;
        say(button.dataset.buy ? 'bought' : 'sold');
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
    showWorn();
    say('hello');
  });
}
