import { expect, it } from 'vitest';
import { item } from '../src/data/equipment';

it('looks up armour by both slot and tier', () => {
  expect(item('helmet', 1)).toMatchObject({ id: 'helmet1', name: 'Rag Wrap' });
  expect(item('armor', 1)).toMatchObject({ id: 'armor1', name: 'Rag Sash' });
  expect(item('helmet', 10)).toMatchObject({ id: 'helmet10', name: 'Gilded Plume Helm' });
});

it('returns no item for an unequipped slot', () => {
  expect(item('helmet', 0)).toBeUndefined();
});
