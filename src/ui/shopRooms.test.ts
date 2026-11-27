import { describe, expect, it } from 'vitest';
import { BUILDINGS } from './town';
import { VENDOR_AT } from './npcs';
import { ROOM_AT, SHOP_ROOMS, roomUrl } from './shopRooms';

describe('shop rooms (#35)', () => {
  it('gives every vendor a room, and only real buildings', () => {
    const ids = BUILDINGS.map((b) => b.id);
    for (const [building, room] of Object.entries(ROOM_AT)) {
      expect(ids, building).toContain(building);
      expect(SHOP_ROOMS).toContain(room);
    }
    for (const building of Object.keys(VENDOR_AT)) expect(ROOM_AT[building], building).toBeDefined();
  });

  it('uses every room and points at its picture', () => {
    expect(new Set(Object.values(ROOM_AT))).toEqual(new Set(SHOP_ROOMS));
    expect(roomUrl('forge')).toMatch(/bg\/shop_forge\.jpg$/);
  });
});
