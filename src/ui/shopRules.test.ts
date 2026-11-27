import { describe, expect, it } from 'vitest';
import type { SavedCharacter } from '../core/save';
import { resolveAttributes } from '../core/stats';
import { item } from '../data/equipment';
import { buy, buyAndWear, compareWorn, lookWith, ownedOfFamily, saleOffers, sell, shopLeague, shopOffers, vendorLine } from './shopRules';

const c: SavedCharacter = {
  name: 'Aelia', level: 3, experience: 0, gold: 100, attributes: resolveAttributes({ charm: 10 }),
  look: { skin: 0, face: 0, hair: 0, hairColor: 0, beard: 0, helmet: 1, armor: 0, shoulders: 0, greaves: 0, boots: 0, weapon: 'gladius' },
  inventory: ['sword1', 'sword1^+2', 'boots2', 'glue-tonic'],
};

describe('shop rules', () => {
  it('stocks goods by league, which follows the level for now', () => {
    expect([1, 4, 9, 16, 25].map(shopLeague)).toEqual(['bronze', 'silver', 'gold', 'champion', 'legend']);
    const offers = shopOffers(c, 'armourer');
    expect(offers).toHaveLength(10);
    expect(offers.every((o) => o.tier <= 2)).toBe(true);
    const cap = offers.find((o) => o.id === 'helmet2')!;
    expect(cap).toMatchObject({ name: 'Leather Cap', stat: 'Armour 1', affordable: true, owned: false });
    expect(cap.price).toBe(23); // list price 25, Charm 10 takes 10% off
  });

  it('buys into the pack and sells plain goods back for less', () => {
    const bought = buy(c, 'armourer', 'helmet2');
    expect(bought.ok && bought.character.inventory.at(-1)).toBe('helmet2');
    expect(bought.ok && bought.character.gold).toBe(100 - (bought.ok ? bought.price : 0));
    expect(bought.ok && bought.character.look.helmet).toBe(1); // worn gear stays as it was

    const sales = saleOffers(c, 'weaponsmith');
    expect(sales.map((s) => [s.id, s.price !== undefined])).toEqual([['sword1', true], ['sword1^+2', false]]);
    const sold = sell(c, 'weaponsmith', 'sword1');
    expect(sold.ok && sold.character.inventory).toEqual(['sword1^+2', 'boots2', 'glue-tonic']);
    expect(sell(c, 'weaponsmith', 'sword1^+2')).toEqual({ ok: false, reason: 'wrong-shop' });
  });

  it('never sells a second copy of what is worn, packed or upgraded', () => {
    for (const [shop, id] of [['weaponsmith', 'sword1'], ['armourer', 'boots2'], ['armourer', 'helmet1']] as const) {
      expect(buy(c, shop, id)).toEqual({ ok: false, reason: 'already-owned' });
      expect(shopOffers(c, shop).find((o) => o.id === id)!.owned).toBe(true);
    }
    expect(buy({ ...c, inventory: ['sword2^+1'] }, 'weaponsmith', 'sword2')).toEqual({ ok: false, reason: 'already-owned' });
    const first = buy(c, 'armourer', 'helmet2');
    expect(first.ok && buy(first.character, 'armourer', 'helmet2')).toEqual({ ok: false, reason: 'already-owned' });
  });

  it('puts bought armour straight on and keeps the old piece; weapons wait in the pack', () => {
    const helmet = buyAndWear(c, 'armourer', 'helmet2');
    expect(helmet.ok && [helmet.worn, helmet.character.look.helmet]).toEqual([true, 2]);
    expect(helmet.ok && helmet.character.inventory).toContain('helmet1');
    const blade = buyAndWear(c, 'weaponsmith', 'axe1');
    expect(blade.ok && [blade.worn, blade.character.look.weapon]).toEqual([false, 'gladius']);
  });

  it('hangs the best blade the gladiator has of a family on the wall', () => {
    expect(ownedOfFamily(c, 'sword')).toBe('sword1');
    expect(ownedOfFamily(c, 'axe')).toBeUndefined();
    expect(ownedOfFamily({ ...c, inventory: ['axe1', 'axe2~fire~1'] }, 'axe')).toBe('axe2');
  });

  it('refuses when the gold is short', () => {
    expect(buy({ ...c, gold: 0 }, 'armourer', 'helmet2')).toEqual({ ok: false, reason: 'insufficient-gold' });
  });

  it('tries an offer on the puppet without changing the save (#34)', () => {
    expect(lookWith(c, 'helmet2')).toEqual({ ...c.look, helmet: 2 });
    expect(lookWith(c, 'boots3').boots).toBe(3);
    expect(lookWith(c, 'axe4').weapon).toBe('axe4');
    expect(lookWith(c, 'glue-tonic')).toBe(c.look);
    expect(c.look.helmet).toBe(1);
  });

  it('compares an offer with what is worn in its slot (#34)', () => {
    const worn = compareWorn(c, 'helmet2')!;
    expect(worn.label).toBe('Armour');
    expect(worn.worn).toBeDefined();
    expect(worn.delta).toBe(item('helmet', 2)!.armor - item('helmet', 1)!.armor);
    expect(compareWorn(c, 'boots2')).toMatchObject({ label: 'Armour', worn: undefined });
    expect(compareWorn(c, 'boots2')!.delta).toBeGreaterThan(0);
    expect(compareWorn(c, 'sword1')).toMatchObject({ label: 'Damage' });
    expect(compareWorn(c, 'glue-tonic')).toBeUndefined();
  });

  it('gives each vendor lines that take turns (#34)', () => {
    for (const shop of ['armourer', 'weaponsmith'] as const) {
      for (const m of ['hello', 'bought', 'sold', 'poor', 'refused'] as const) expect(vendorLine(shop, m).length).toBeGreaterThan(5);
      expect(vendorLine(shop, 'hello', 0)).not.toBe(vendorLine(shop, 'hello', 1));
      expect(vendorLine(shop, 'hello', 2)).toBe(vendorLine(shop, 'hello', 0));
    }
  });
});
