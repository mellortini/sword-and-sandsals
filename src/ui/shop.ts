/// <reference types="vite/client" />
import { LEAGUE_MAX_TIER } from '../core/leagues';
import type { League } from '../core/leagues';
import type { Shop } from '../core/shop';
import type { SavedCharacter } from '../core/save';
import { ITEMS } from '../data/equipment';
import { WEAPONS, WEAPON_FAMILIES } from '../data/weapons';
import { EQUIP_SLOTS } from '../rig/PaperRig';
import type { EquipSlot } from '../rig/PaperRig';
import { Counter } from './counter';
import type { LookPreview } from './lookPreview';
import { MANNEQUIN_CROP, MANNEQUIN_PARTS, itemPicture } from './shopPictures';
import { SHOP_NAMES, buyAndWear, compareWorn, ownedOfFamily, saleOffers, sell, shopLeague, shopOffers, vendorLine } from './shopRules';
import type { ShopMoment, ShopOffer } from './shopRules';

const REASON_TEXT: Readonly<Record<string, string>> = {
  'not-stocked': 'I don’t have that one on the rack yet.',
  'already-owned': 'You already have that one. Keep your gold.',
  'insufficient-gold': 'Not enough gold.',
  'not-owned': 'That item is no longer in your pack.',
  'wrong-shop': 'I only buy plain goods of my own trade.',
  'gold-limit': 'You cannot carry more gold.',
};

/** what hangs on the weaponsmith's wall, and the armourer's mannequin parts, in plain words */
const FAMILY_LABEL: Readonly<Record<string, string>> = { sword: 'Swords', axe: 'Axes', spear: 'Spears', hammer: 'Hammers' };
const SLOT_LABEL: Readonly<Record<EquipSlot, string>> = { helmet: 'Helmet', shoulders: 'Shoulders', armor: 'Cuirass', greaves: 'Greaves', boots: 'Boots' };

/**
 * Sizes a blade that is turned upright: its length follows the box's height, but a broad head (axe, hammer) never grows
 * wider than the box.
 */
function standUp(img: HTMLImageElement, tall: number, wide: number) {
  const box = img.parentElement!;
  const fit = () => {
    const slim = img.naturalWidth / Math.max(1, img.naturalHeight);
    img.style.width = `${Math.min(box.clientHeight * tall, box.clientWidth * wide * slim)}px`;
  };
  if (img.complete && img.naturalWidth) fit(); else img.onload = fit;
}

/** the catalogue of one wall section or mannequin part, every tier, cheapest first */
function section(shop: Shop, key: string): { id: string; tier: number }[] {
  return shop === 'weaponsmith' ? WEAPONS.filter((w) => w.family === key) : ITEMS.filter((i) => i.slot === key);
}

/** the first league that sells a tier, for goods not on the rack yet */
function leagueFor(tier: number): string {
  const league = (Object.keys(LEAGUE_MAX_TIER) as League[]).find((l) => LEAGUE_MAX_TIER[l] >= tier);
  return league ? `${league[0].toUpperCase()}${league.slice(1)} league` : 'a later league';
}

const pic = (id: string, cls = '') => {
  const p = itemPicture(id);
  return p ? `<img class="${p.blade ? 'blade' : ''} ${cls}" src="${p.src}" alt="" loading="lazy">` : '';
};

/**
 * A shop (#205, logic in core #32) at the vendor's counter (#267). The weaponsmith's wall holds a sword, an axe, a spear
 * and a hammer (the gladiator's own, once bought): pick one to see every blade of that family. At the armourer's the
 * gladiator stands in the armour worn now, with a label on each part: pick one to see every piece for it; pointing at a
 * piece tries it on. Goods not sold in the gladiator's league yet show as dark shapes. A click buys: armour goes straight
 * on, a weapon into the pack (take it in hand under Gear). Nothing the gladiator already has can be bought again. Sell
 * lists what the shop buys back. The door (or Escape) leaves and saves what changed.
 */
export function openShop(
  shop: Shop, character: SavedCharacter, save: (character: SavedCharacter) => Promise<void>, preview?: LookPreview,
): Promise<SavedCharacter> {
  const counter = new Counter({
    building: shop, title: SHOP_NAMES[shop], gold: character.gold,
    tabs: [{ id: 'buy', label: 'Buy' }, { id: 'sell', label: 'Sell' }],
  });
  const board = counter.board;
  const title = counter.root.querySelector<HTMLElement>('.counter__title')!;
  let draft = character;
  let tab: 'buy' | 'sell' = 'buy';
  /** open wall section / mannequin part; null = the wall or the mannequin itself */
  let open: string | null = null;
  let busy = false;
  const said: Partial<Record<ShopMoment, number>> = {};
  const say = (moment: ShopMoment) => {
    const n = said[moment] ?? 0;
    said[moment] = n + 1;
    counter.say(vendorLine(shop, moment, n));
  };
  const league = () => shopLeague(draft.level);

  // ---------------------------------------------------------------- the gladiator wears the armour, or a piece tried on
  const dress = preview?.armoured;
  let dressed = '';
  let dressId = 0;
  const putOn = (look: SavedCharacter['look']) => {
    const frame = board.querySelector<HTMLElement>('.mannequin');
    const key = JSON.stringify(look);
    if (!dress || !frame || key === dressed) return;
    dressed = key;
    const id = ++dressId;
    void dress(look).then((canvas) => {
      if (id !== dressId || !frame.isConnected) return;
      frame.querySelector('canvas')?.remove();
      frame.prepend(canvas);
    }).catch(() => undefined);
  };
  const worn = () => draft.look;

  // ---------------------------------------------------------------- what the vendor says about a ware
  const describe = (id: string) => {
    const offer = shopOffers(draft, shop).find((o) => o.id === id);
    if (!offer) {
      const item = [...WEAPONS, ...ITEMS].find((i) => i.id === id)!;
      return `${item.name}.\nNot on my rack yet: I sell it from the ${leagueFor(item.tier)}.`;
    }
    const c = compareWorn(draft, id);
    const cmp = c ? (c.delta > 0 ? `+${c.delta}` : c.delta < 0 ? `−${-c.delta}` : '±0') + (c.worn ? ` against your ${c.worn}` : ', you wear nothing there') : '';
    return `${offer.name}, tier ${offer.tier}.\n${offer.stat}${cmp ? ` (${cmp})` : ''}.${offer.wearNote ? `\nYou can ${offer.wearNote.replace('wear from', 'wear it from')}.` : ''}`
      + (offer.owned ? `\nYou have it already (${offer.equipped ? 'on you' : 'in your pack'}).`
        : `\n${offer.price} gold.${offer.affordable ? '' : ' More than your purse holds.'}`);
  };

  const ware = (id: string, offer: ShopOffer | undefined, tier: number) => {
    const item = [...WEAPONS, ...ITEMS].find((i) => i.id === id)!;
    const cls = !offer ? 'locked' : offer.owned ? 'owned' : offer.affordable ? '' : 'poor';
    const has = offer?.owned ? (offer.equipped ? 'Equipped' : 'In your pack') : '';
    const label = !offer ? 'not sold yet' : has || `${offer.price} gold`;
    return `<button type="button" class="ware ${cls}" data-ware="${id}" aria-label="${item.name}, ${label}"${has ? ' aria-disabled="true"' : ''}>
      ${has ? '<span class="ware__badge">✓ Owned</span>' : ''}
      <span class="ware__pic">${pic(id)}</span><span class="ware__name">${offer ? item.name : `Tier ${tier}`}</span>
      <span class="ware__price">${offer ? has || `${offer.price} gold` : leagueFor(tier)}</span></button>`;
  };

  // ---------------------------------------------------------------- the board's views
  const render = (focus?: string) => {
    counter.setGold(draft.gold);
    counter.selectTab(tab);
    const offers = new Map(shopOffers(draft, shop).map((o) => [o.id, o]));
    if (tab === 'sell') {
      title.innerHTML = `Sell <small>what the ${SHOP_NAMES[shop].toLowerCase()} buys back</small>`;
      const sales = saleOffers(draft, shop);
      board.innerHTML = sales.length
        ? `<div class="counter__grid">${sales.map((s) => `<button type="button" class="ware ${s.price === undefined ? 'locked' : ''}" data-sell="${s.index}">
            <span class="ware__pic">${pic(s.id)}</span><span class="ware__name">${s.name}</span>
            <span class="ware__price">${s.price === undefined ? 'not bought here' : `${s.price} gold`}</span></button>`).join('')}</div>`
        : `<p class="counter__empty">Nothing in your pack that I buy.</p>`;
      for (const img of board.querySelectorAll<HTMLImageElement>('.ware__pic img.blade')) standUp(img, 0.98, 0.94);
    } else if (shop === 'weaponsmith' && !open) {
      title.innerHTML = `The Rack <small>${league()} league goods</small>`;
      board.innerHTML = `<div class="counter__wall">${WEAPON_FAMILIES.map((f) => {
        // the gladiator's own blade of the family hangs on the wall; without one, the best on sale now
        const mine = ownedOfFamily(draft, f);
        const shown = mine ?? ([...section(shop, f)].reverse().find((w) => offers.has(w.id)) ?? section(shop, f)[0]).id;
        const note = mine ? `Yours: ${WEAPONS.find((w) => w.id === mine)!.name}` : `${section(shop, f).filter((w) => offers.has(w.id)).length} on the rack`;
        return `<button type="button" class="wall-item${mine ? ' wall-item--mine' : ''}" data-open="${f}"><span class="wall-item__pic">${pic(shown)}</span>
          ${FAMILY_LABEL[f] ?? f}<small>${note}</small></button>`;
      }).join('')}</div>`;
      // turned upright, a blade's length is the column's height
      for (const img of board.querySelectorAll<HTMLImageElement>('.wall-item__pic img.blade')) standUp(img, 0.95, 0.9);
    } else if (shop === 'weaponsmith') {
      title.innerHTML = `${FAMILY_LABEL[open!]} <small>${league()} league goods</small>`;
      board.innerHTML = `<div class="counter__head"><button type="button" class="counter__back" data-act="back">← The rack</button></div>
        <div class="counter__grid">${section(shop, open!).map((w) => ware(w.id, offers.get(w.id), w.tier)).join('')}</div>`;
      for (const img of board.querySelectorAll<HTMLImageElement>('.ware__pic img.blade')) standUp(img, 0.98, 0.94);
    } else {
      title.innerHTML = open ? `${SLOT_LABEL[open as EquipSlot]} <small>${league()} league goods</small>` : `Your Armour <small>pick a part</small>`;
      const { x0, y0, x1, y1 } = MANNEQUIN_CROP;
      board.innerHTML = `<div class="counter__split"><div class="mannequin">${EQUIP_SLOTS.map((s) => {
        const [x, y] = MANNEQUIN_PARTS[s];
        return `<button type="button" class="mannequin__part" data-open="${s}" aria-pressed="${open === s}"
          style="left:${((x - x0) / (x1 - x0)) * 100}%;top:${((y1 - y) / (y1 - y0)) * 100}%">${SLOT_LABEL[s]}</button>`;
      }).join('')}</div>${open
        ? `<div class="counter__grid">${section(shop, open).map((i) => ware(i.id, offers.get(i.id), i.tier)).join('')}</div>`
        : `<p class="counter__empty">Pick a part to see what I have for it.</p>`}</div>`;
      dressed = '';
      putOn(worn());
    }
    if (focus) board.querySelector<HTMLElement>(focus)?.focus();
  };

  // pointing at a ware: the vendor names it, the gladiator tries it on
  const point = (e: Event) => {
    const w = (e.target as HTMLElement).closest<HTMLElement>('[data-ware]');
    if (!w) return;
    counter.say(describe(w.dataset.ware!), true);
    const piece = ITEMS.find((i) => i.id === w.dataset.ware);
    if (piece) putOn({ ...worn(), [piece.slot]: piece.tier });
  };
  board.addEventListener('mouseover', point);
  // only the keyboard's focus tries a piece on: focus set by the screen itself leaves the worn gear showing
  board.addEventListener('focusin', (e) => { if ((e.target as HTMLElement).matches(':focus-visible')) point(e); });
  board.addEventListener('mouseout', (e) => {
    const from = (e.target as HTMLElement).closest('[data-ware]');
    if (from && !from.contains(e.relatedTarget as Node | null) && shop === 'armourer') putOn(worn());
  });
  board.addEventListener('mouseleave', () => { if (shop === 'armourer') putOn(worn()); });

  return new Promise((resolve) => {
    const keys = new AbortController();
    const close = async () => {
      if (busy) return;
      if (draft !== character) {
        busy = true;
        try {
          await save(draft);
        } catch {
          busy = false;
          counter.say('The game could not be saved. Try again.', true);
          return;
        }
      }
      keys.abort();
      counter.close();
      resolve(draft === character ? character : draft);
    };
    counter.root.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button');
      if (!b || busy) return;
      if (b.dataset.act === 'exit') void close();
      else if (b.dataset.tab) { tab = b.dataset.tab as 'buy' | 'sell'; open = null; render(); }
      else if (b.dataset.act === 'back') { const was = open; open = null; render(`[data-open="${was}"]`); }
      else if (b.dataset.open) { open = open === b.dataset.open && shop === 'armourer' ? null : b.dataset.open; render(open ? '[data-ware]' : undefined); }
      else if (b.dataset.ware || b.dataset.sell) {
        const id = b.dataset.ware;
        if (id && !shopOffers(draft, shop).some((o) => o.id === id)) { counter.say(describe(id), true); return; }
        const result = id ? buyAndWear(draft, shop, id) : sell(draft, shop, draft.inventory[+b.dataset.sell!]);
        if (!result.ok) {
          say(result.reason === 'insufficient-gold' ? 'poor' : 'refused');
          if (result.reason !== 'insufficient-gold') counter.say(REASON_TEXT[result.reason] ?? 'Not possible.');
          return;
        }
        draft = result.character;
        render(id ? `[data-ware="${id}"]` : '[data-sell]');
        say(id ? 'bought' : 'sold');
        if (id && 'worn' in result && !result.worn) {
          const where = shop === 'armourer' ? 'It waits in your pack until you can wear it.' : 'It’s in your pack. Take it in hand under Gear.';
          counter.say(`${vendorLine(shop, 'bought', said.bought! - 1)}\n${where}`, true);
        }
      }
    });
    window.addEventListener('keydown', (e) => {
      e.stopImmediatePropagation();
      if (e.key === 'Escape') {
        if (open && tab === 'buy') { const was = open; open = null; render(`[data-open="${was}"]`); } else void close();
      } else if (e.key.startsWith('Arrow')) {
        e.preventDefault();
        const items = [...counter.root.querySelectorAll<HTMLButtonElement>('.counter__goods button, .counter__exit')];
        const at = items.indexOf(document.activeElement as HTMLButtonElement);
        const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1;
        items[at < 0 ? 0 : Math.max(0, Math.min(items.length - 1, at + step))]?.focus();
      }
    }, { capture: true, signal: keys.signal });
    render();
    say('hello');
  });
}
