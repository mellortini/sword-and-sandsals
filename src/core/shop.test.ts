import { describe, expect, it } from 'vitest';
import { buyItem, getShopStock, sellItem, shopPrices } from './shop';
import type { ShopCustomer } from './shop';

const customer: ShopCustomer = {
  gold: 100,
  attributes: { charm: 30 },
  inventory: { backpack: ['boots2', 'boots2', 'hammer10'], equipped: { weapon: 'sword1' } },
};

describe('shop transactions', () => {
  it('keeps a separate catalogue for each shop and opens higher tiers by league', () => {
    const bronze = getShopStock('armourer', 'bronze');
    expect(bronze).toHaveLength(12);   // two tiers of five armour pieces and a shield (#273)
    expect(bronze.every((item) => ('slot' in item || item.id.startsWith('shield')) && item.tier <= 2)).toBe(true);
    const legend = getShopStock('weaponsmith', 'legend');
    expect(legend).toHaveLength(50);
    expect(legend.every((item) => 'family' in item)).toBe(true);
    expect(legend.some((item) => item.tier === 10)).toBe(true);
  });

  it('caps the Charm discount at 25% and pays 30% of list price, regardless of Charm', () => {
    const armour = getShopStock('armourer', 'bronze').find((item) => item.id === 'armor2')!;
    expect(shopPrices(armour, 0)).toEqual({ buy: 50, sell: 15 });
    expect(shopPrices(armour, 10)).toEqual({ buy: 45, sell: 15 });
    expect(shopPrices(armour, 100)).toEqual({ buy: 38, sell: 15 });
  });

  it('buys into the backpack with exact gold and preserves the customer when a purchase is denied', () => {
    const exact = { ...customer, gold: 38 };
    const buy = buyItem(exact, 'armourer', 'bronze', 'armor2');
    expect(buy).toMatchObject({ ok: true, price: 38, customer: { gold: 0 } });
    expect(buy.customer.inventory.backpack).toEqual(['boots2', 'boots2', 'hammer10', 'armor2']);
    expect(exact.inventory.backpack).toHaveLength(3);
    const short = { ...customer, gold: 37 };
    expect(buyItem(short, 'armourer', 'bronze', 'armor2')).toEqual({ ok: false, customer: short, reason: 'insufficient-gold' });
    expect(buyItem(customer, 'armourer', 'bronze', 'armor3')).toEqual({ ok: false, customer, reason: 'not-stocked' });
    expect(buyItem(customer, 'weaponsmith', 'bronze', 'armor2')).toEqual({ ok: false, customer, reason: 'not-stocked' });
  });

  it('sells one backpack copy to the right merchant and refuses to sell an equipped item', () => {
    const sold = sellItem(customer, 'armourer', 'boots2');
    expect(sold).toMatchObject({ ok: true, price: 4, customer: { gold: 104 } });
    expect(sold.customer.inventory.backpack).toEqual(['boots2', 'hammer10']);
    expect(customer.inventory.backpack).toEqual(['boots2', 'boots2', 'hammer10']);
    expect(sellItem(customer, 'armourer', 'hammer10')).toEqual({ ok: false, customer, reason: 'wrong-shop' });
    expect(sellItem(customer, 'weaponsmith', 'sword1')).toEqual({ ok: false, customer, reason: 'not-owned' });
    const rich = { ...customer, gold: Number.MAX_SAFE_INTEGER };
    expect(sellItem(rich, 'armourer', 'boots2')).toEqual({ ok: false, customer: rich, reason: 'gold-limit' });
  });
});
