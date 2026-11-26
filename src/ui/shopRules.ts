import { buyItem, getShopStock, sellItem, shopPrices } from '../core/shop';
import type { Shop, ShopCustomer } from '../core/shop';
import type { League } from '../core/leagues';
import type { SavedCharacter } from '../core/save';
import { applyInventory, gearItem, savedInventory } from './gearRules';

export const SHOP_NAMES: Readonly<Record<Shop, string>> = { armourer: 'Armourer', weaponsmith: 'Weaponsmith' };

/**
 * The league whose goods a gladiator may buy (#205). Until the career stores its league (#58), it follows the level at
 * which the league's best items can be worn (tier 3 from level 4, 5 from 9, 7 from 16, 9 from 25).
 */
export function shopLeague(level: number): League {
  return level >= 25 ? 'legend' : level >= 16 ? 'champion' : level >= 9 ? 'gold' : level >= 4 ? 'silver' : 'bronze';
}

const customer = (c: SavedCharacter): ShopCustomer => ({ gold: c.gold, attributes: c.attributes, inventory: savedInventory(c) });
const fromCustomer = (c: SavedCharacter, next: ShopCustomer): SavedCharacter => ({ ...applyInventory(c, next.inventory), gold: next.gold });

export interface ShopOffer {
  readonly id: string;
  readonly name: string;
  readonly tier: number;
  readonly stat: string;
  readonly price: number;
  readonly owned: number;
  readonly affordable: boolean;
  /** "wear from level 9" / "needs Might 7" when the gladiator cannot wear it yet; buying is still allowed */
  readonly wearNote?: string;
}

export function shopOffers(c: SavedCharacter, shop: Shop): ShopOffer[] {
  return getShopStock(shop, shopLeague(c.level)).map((item) => {
    const info = gearItem(item.id)!;
    const price = shopPrices(item, c.attributes.charm).buy;
    const wearNote = c.level < info.minLevel ? `wear from level ${info.minLevel}`
      : c.attributes.might < info.minMight ? `needs Might ${info.minMight}` : undefined;
    return {
      id: item.id, name: info.name, tier: item.tier, stat: info.stat, price,
      owned: c.inventory.filter((id) => id === item.id).length, affordable: c.gold >= price, wearNote,
    };
  });
}

export interface SaleOffer { readonly index: number; readonly id: string; readonly name: string; readonly stat: string; readonly price?: number }

/** Pack items this shop deals in; upgraded or enchanted pieces have no price here (the shop only buys plain goods). */
export function saleOffers(c: SavedCharacter, shop: Shop): SaleOffer[] {
  const goods = getShopStock(shop, 'legend');
  return c.inventory.flatMap((id, index) => {
    const info = gearItem(id);
    if (!info || (shop === 'weaponsmith') !== (info.slot === 'hand')) return [];
    const plain = goods.find((g) => g.id === id);
    return [{ index, id, name: info.name, stat: info.stat, price: plain ? shopPrices(plain, c.attributes.charm).sell : undefined }];
  });
}

export function buy(c: SavedCharacter, shop: Shop, id: string) {
  const r = buyItem(customer(c), shop, shopLeague(c.level), id);
  return r.ok ? { ok: true as const, character: fromCustomer(c, r.customer), price: r.price } : { ok: false as const, reason: r.reason };
}

export function sell(c: SavedCharacter, shop: Shop, id: string) {
  const r = sellItem(customer(c), shop, id);
  return r.ok ? { ok: true as const, character: fromCustomer(c, r.customer), price: r.price } : { ok: false as const, reason: r.reason };
}
