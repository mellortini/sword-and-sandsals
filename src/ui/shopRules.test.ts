import { describe, expect, it } from 'vitest';
import type { SavedCharacter } from '../core/save';
import { resolveAttributes } from '../core/stats';
import { buy, saleOffers, sell, shopLeague, shopOffers } from './shopRules';

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
    expect(cap).toMatchObject({ name: 'Leather Cap', stat: 'Armour 1', affordable: true, owned: 0 });
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

  it('refuses when the gold is short', () => {
    expect(buy({ ...c, gold: 0 }, 'armourer', 'helmet2')).toEqual({ ok: false, reason: 'insufficient-gold' });
  });
});
