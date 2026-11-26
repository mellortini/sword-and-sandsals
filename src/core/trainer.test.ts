import { expect, it } from 'vitest';
import type { SavedCharacter } from './save';
import { resolveAttributes } from './stats';
import { resetAttributes, spendAttributePoints, trainerResetQuote } from './trainer';

const character: SavedCharacter = {
  name: 'Aelia', level: 4, experience: 0, gold: 50, attributePoints: 7, skillPoints: 1,
  attributes: resolveAttributes({ might: 12, vitality: 8, arcana: 4 }), inventory: ['sword1'],
  look: { skin: 3, face: 0, hair: 1, hairColor: 1, beard: 2, helmet: 0, armor: 0, shoulders: 0, greaves: 0, boots: 0, weapon: 'gladius' },
};

it('allocates saved points to one attribute and preserves the original snapshot', () => {
  expect(spendAttributePoints(character, 'guard', 3)).toMatchObject({
    ok: true, character: { attributePoints: 4, attributes: { guard: 8 }, gold: 50, skillPoints: 1 },
  });
  expect(character.attributes.guard).toBe(5);
  expect(spendAttributePoints(character, 'guard', 8)).toEqual({ ok: false, character, reason: 'insufficient-points' });
  expect(spendAttributePoints(character, 'guard', 0.5)).toEqual({ ok: false, character, reason: 'invalid-allocation' });
});

it('refunds allocated points for gold and keeps attributes below the starter baseline', () => {
  expect(trainerResetQuote(character)).toEqual({ price: 40, refund: 10 });
  const reset = resetAttributes(character);
  expect(reset).toMatchObject({
    ok: true, character: { gold: 10, attributePoints: 17, skillPoints: 1, attributes: { might: 5, vitality: 5, arcana: 4 } },
  });
  expect(resetAttributes(reset.character)).toMatchObject({ ok: false, reason: 'nothing-to-reset' });
  const broke = { ...character, gold: 39 };
  expect(resetAttributes(broke)).toEqual({ ok: false, character: broke, reason: 'insufficient-gold' });
});

it('supports characters saved before point balances were introduced', () => {
  const earlier = { ...character, attributePoints: undefined };
  expect(resetAttributes(earlier)).toMatchObject({ ok: true, character: { attributePoints: 10 } });
});
