import { ITEMS } from '../data/equipment';
import type { Item } from '../data/equipment';
import { WEAPONS } from '../data/weapons';
import type { Weapon } from '../data/weapons';
import { readWeaponEnchantment } from './enchant';
import { readForgedItem } from './forge';
import type { Inventory } from './inventory';
import { LEAGUE_MAX_TIER } from './leagues';
import type { League } from './leagues';
import { shopDiscount } from './stats';
import type { Attributes } from './types';

export type Shop = 'armourer' | 'weaponsmith';
export type ShopItem = Readonly<Item> | Weapon;

export interface ShopCustomer {
  readonly gold: number;
  readonly attributes: Pick<Attributes, 'charm'>;
  readonly inventory: Inventory;
}

type Transaction =
  | { ok: true; customer: ShopCustomer; price: number }
  | { ok: false; customer: ShopCustomer; reason: 'not-stocked' | 'already-owned' | 'insufficient-gold' | 'not-owned' | 'wrong-shop' | 'gold-limit' };

const CATALOGUE: Readonly<Record<Shop, readonly ShopItem[]>> = { armourer: ITEMS, weaponsmith: WEAPONS };

export function shopPrices(item: ShopItem, charm: number): { buy: number; sell: number } {
  return { buy: Math.ceil(item.price * (100 - shopDiscount(charm)) / 100), sell: Math.floor(item.price * 30 / 100) };
}

export function getShopStock(shop: Shop, league: League): readonly ShopItem[] {
  return CATALOGUE[shop].filter((item) => item.tier <= LEAGUE_MAX_TIER[league]);
}

/** the catalogue id under a forged or enchanted one: `sword3^+2~fire~1` -> `sword3` */
const plainId = (id: string) => {
  const unenchanted = readWeaponEnchantment(id).baseId ?? id;
  return readForgedItem(unenchanted).baseId ?? unenchanted;
};

/** worn or in the pack, upgraded and enchanted copies included */
export function ownsItem(inventory: Inventory, id: string): boolean {
  return [...inventory.backpack, ...Object.values(inventory.equipped)].some((held) => plainId(held) === id);
}

export function buyItem(customer: ShopCustomer, shop: Shop, league: League, id: string): Transaction {
  const item = getShopStock(shop, league).find((entry) => entry.id === id);
  if (!item) return { ok: false, customer, reason: 'not-stocked' };
  // one of each: a second copy would only waste the gold
  if (ownsItem(customer.inventory, id)) return { ok: false, customer, reason: 'already-owned' };
  const price = shopPrices(item, customer.attributes.charm).buy;
  if (customer.gold < price) return { ok: false, customer, reason: 'insufficient-gold' };

  const inventory = { ...customer.inventory, backpack: [...customer.inventory.backpack, id] };
  return { ok: true, customer: { ...customer, gold: customer.gold - price, inventory }, price };
}

export function sellItem(customer: ShopCustomer, shop: Shop, id: string): Transaction {
  const index = customer.inventory.backpack.indexOf(id);
  if (index === -1) return { ok: false, customer, reason: 'not-owned' };
  const item = CATALOGUE[shop].find((entry) => entry.id === id);
  if (!item) return { ok: false, customer, reason: 'wrong-shop' };

  const price = shopPrices(item, customer.attributes.charm).sell;
  const gold = customer.gold + price;
  if (!Number.isSafeInteger(gold)) return { ok: false, customer, reason: 'gold-limit' };

  const backpack = customer.inventory.backpack.slice();
  backpack.splice(index, 1);
  const inventory = { ...customer.inventory, backpack };
  return { ok: true, customer: { ...customer, gold, inventory }, price };
}
