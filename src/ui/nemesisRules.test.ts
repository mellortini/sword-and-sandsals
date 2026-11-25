import { describe, expect, it } from 'vitest';
import { createCombat, performAction } from '../core/combat';
import type { SavedCharacter } from '../core/save';
import { resolveAttributes } from '../core/stats';
import { afterBout, nemesisLine, nemesisRival } from './nemesisRules';

const career: SavedCharacter = {
  name: 'Aelia', level: 5, experience: 0, gold: 0, attributes: resolveAttributes(), inventory: [],
  look: { skin: 0, face: 0, hair: 0, hairColor: 0, beard: 0, helmet: 0, armor: 0, shoulders: 0, greaves: 0, boots: 0, weapon: 'gladius' },
};
const start = createCombat(1, { position: 4 }, { position: 10, name: 'Varro the Creased' });
const charge = performAction(start, 'charge');
const lost = { ...charge.state, winner: 'enemy' as const };
const won = { ...charge.state, winner: 'player' as const };

describe('nemesis rules', () => {
  it('turns the opponent who won into the nemesis and announces it', () => {
    const r = afterBout(career, { name: 'Varro the Creased', level: 4 }, 77, 'b1', lost, charge.events);
    expect(r.character.nemesis).toMatchObject({ id: 'rival-varro-the-creased', name: 'Varro the Creased', encounters: 1, charges: 1, seed: 77 });
    expect(r.notice?.title).toBe('Varro the Creased will be back');
    expect(nemesisLine(r.character.nemesis!)).toBe('Beat you once · watches for your charges');
  });

  it('grows the feud on another loss and ends it on a win', () => {
    const first = afterBout(career, { name: 'Varro the Creased', level: 4 }, 77, 'b1', lost, charge.events).character;
    const rival = nemesisRival(first.nemesis!, first.level);
    expect(rival).toMatchObject({ name: 'Varro the Creased', nemesis: first.nemesis });
    expect(rival.level).toBeGreaterThan(first.level);
    const again = afterBout(first, rival, 5, 'b2', lost, charge.events);
    expect(again.character.nemesis?.encounters).toBe(2);
    expect(again.notice?.title).toBe('Varro the Creased grows stronger');
    const beaten = afterBout(again.character, { ...rival, nemesis: again.character.nemesis }, 6, 'b3', won, []);
    expect(beaten.character.nemesis).toBeUndefined();
    expect(beaten.notice?.title).toBe('Varro the Creased is beaten');
  });

  it('changes nothing when an ordinary opponent loses', () => {
    const r = afterBout(career, { name: 'Tetraites', level: 2 }, 1, 'b1', won, []);
    expect(r).toEqual({ character: career });
  });
});
