import { buyItem, getShopStock, ownsItem, sellItem, shopPrices } from '../core/shop';
import type { Shop, ShopCustomer } from '../core/shop';
import type { League } from '../core/leagues';
import type { SavedCharacter } from '../core/save';
import type { Look } from '../rig/PaperRig';
import { ITEMS } from '../data/equipment';
import { WEAPONS } from '../data/weapons';
import { applyInventory, gearItem, savedInventory, wear, weaponBase } from './gearRules';

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
  /** the gladiator has it already (worn or packed): it cannot be bought again */
  readonly owned: boolean;
  readonly equipped: boolean;
  readonly affordable: boolean;
  /** "wear from level 9" / "needs Might 7" when the gladiator cannot wear it yet; buying is still allowed */
  readonly wearNote?: string;
}

export function shopOffers(c: SavedCharacter, shop: Shop): ShopOffer[] {
  const inventory = savedInventory(c);
  return getShopStock(shop, shopLeague(c.level)).map((item) => {
    const info = gearItem(item.id)!;
    const price = shopPrices(item, c.attributes.charm).buy;
    const wearNote = c.level < info.minLevel ? `wear from level ${info.minLevel}`
      : c.attributes.might < info.minMight ? `needs Might ${info.minMight}` : undefined;
    return {
      id: item.id, name: info.name, tier: item.tier, stat: info.stat, price,
      owned: ownsItem(inventory, item.id), equipped: Object.values(inventory.equipped).some((id) => weaponBase(id) === item.id),
      affordable: c.gold >= price, wearNote,
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

/**
 * A purchase over the counter: bought armour goes straight on (the old piece moves to the pack) when the gladiator can
 * wear it already; weapons, and armour above the gladiator's level, wait in the pack.
 */
export function buyAndWear(c: SavedCharacter, shop: Shop, id: string) {
  const r = buy(c, shop, id);
  if (!r.ok) return r;
  if (shop !== 'armourer') return { ...r, worn: false };
  const dressed = wear(r.character, id);
  return { ...r, character: dressed.character, worn: dressed.ok };
}

/** the blade of a family shown on the weaponsmith's wall: the best one the gladiator has, worn or packed */
export function ownedOfFamily(c: SavedCharacter, family: string): string | undefined {
  const inventory = savedInventory(c);
  const held = [...inventory.backpack, ...Object.values(inventory.equipped)].map(weaponBase);
  return WEAPONS.filter((w) => w.family === family && held.includes(w.id)).sort((a, b) => b.tier - a.tier)[0]?.id;
}

export function sell(c: SavedCharacter, shop: Shop, id: string) {
  const r = sellItem(customer(c), shop, id);
  return r.ok ? { ok: true as const, character: fromCustomer(c, r.customer), price: r.price } : { ok: false as const, reason: r.reason };
}

/** the puppet's look with an item tried on: armour at its tier in its slot, a weapon in the hand (shop preview, #34) */
export function lookWith(c: SavedCharacter, id: string): Look {
  const armour = ITEMS.find((piece) => piece.id === id);
  if (armour) return { ...c.look, [armour.slot]: armour.tier };
  if (WEAPONS.some((w) => w.id === weaponBase(id))) return { ...c.look, weapon: weaponBase(id) };
  return c.look;
}

export interface WornComparison {
  /** 'Armour' or 'Damage' */
  readonly label: string;
  /** the offer's number minus the worn one's (all of it when nothing is worn there) */
  readonly delta: number;
  /** name of what is worn in that slot now */
  readonly worn?: string;
}

const statNumber = (stat: string) => Number(/-?\d+/.exec(stat)?.[0] ?? 0);

/** how an offer compares with what the gladiator wears in the same slot (#34) */
export function compareWorn(c: SavedCharacter, id: string): WornComparison | undefined {
  const offer = gearItem(id);
  if (!offer) return undefined;
  const wornId = savedInventory(c).equipped[offer.slot === 'hand' ? 'weapon' : offer.slot];
  const worn = wornId === undefined ? undefined : gearItem(wornId);
  return { label: offer.stat.split(' ')[0], delta: statNumber(offer.stat) - (worn ? statNumber(worn.stat) : 0), worn: worn?.name };
}

/** what the vendor says (#34): on entering, after a sale either way, when the gold is short, and at anything else refused */
export type ShopMoment = 'hello' | 'bought' | 'sold' | 'poor' | 'refused';

const LINES: Readonly<Record<Shop, Readonly<Record<ShopMoment, readonly string[]>>>> = {
  weaponsmith: {
    hello: ['Pressed carton, folded forty times. Nothing in Pulpport cuts cleaner.', 'Mind your fingers. Everything on that rack is sharp.'],
    bought: ['Mind the edge. It remembers every fold.', 'A good blade. Bring it back dented and I’ll press it flat.'],
    sold: ['I’ll smooth the creases out of this one.', 'Fair trade. It’ll find a new hand.'],
    poor: ['Come back with more coin, friend.', 'That one costs more than your purse holds.'],
    refused: ['That’s not something I deal in.'],
  },
  armourer: {
    hello: ['Every plate here has stopped a blade. Most of them twice.', 'Looking for something between you and the sand?'],
    bought: ['Wear it well. The straps go on the inside.', 'That will keep the worst of it off you.'],
    sold: ['I’ll beat the dents out of it.', 'Still some wear left in this. I’ll take it.'],
    poor: ['Gold first, armour after.', 'Not enough coin for that, I’m afraid.'],
    refused: ['Not my trade, that.'],
  },
};

/** the vendor's `n`th line for a moment (lines take turns) */
export function vendorLine(shop: Shop, moment: ShopMoment, n = 0): string {
  const lines = LINES[shop][moment];
  return lines[((n % lines.length) + lines.length) % lines.length];
}
