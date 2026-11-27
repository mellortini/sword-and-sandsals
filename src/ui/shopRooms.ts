/**
 * Shop interiors (#35), rendered by blender/interiors.py: assets/bg/shop_<room>.jpg, 1920x1080 paper dioramas.
 * Each room keeps its middle and right calm for the shop screen (#34): the vendor's bust on the left (src/ui/npcs.ts),
 * the goods on a scroll on the right.
 */

export const SHOP_ROOMS = ['forge', 'armoury', 'enchanter', 'temple', 'training'] as const;
export type ShopRoom = (typeof SHOP_ROOMS)[number];

/** which room is behind which town building (src/ui/town.ts BUILDINGS ids) */
export const ROOM_AT: Readonly<Record<string, ShopRoom>> = {
  weaponsmith: 'forge',
  forge: 'forge',
  armourer: 'armoury',
  enchanter: 'enchanter',
  temple: 'temple',
  trainer: 'training',
  skills: 'training',
};

/** URL of a room's background */
export function roomUrl(room: ShopRoom): string {
  return `${import.meta.env.BASE_URL}bg/shop_${room}.jpg`;
}
