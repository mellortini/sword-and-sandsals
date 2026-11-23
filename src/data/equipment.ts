/**
 * Armour sets: tier 1 (Beggar's Rags) ... tier 10 (Gilded Legend). Every set has 5 pieces that fit together.
 * Numbers are first-pass balance: the set total armour and price grow per tier, each slot takes a fixed share.
 */
import type { EquipSlot } from '../rig/PaperRig';

export interface Item {
  id: string;
  slot: EquipSlot;
  tier: number;
  name: string;
  set: string;
  armor: number;        // damage reduction points
  weight: number;       // slows jumps / costs energy per action
  price: number;        // gold
  minLevel: number;
  bonus?: string;
}

export const SET_NAMES = ["Beggar's Rags", 'Scrap Leather', 'Padded Linen', 'Studded Hide', 'Bronze Recruit', 'Iron Scale',
  'Chain Veteran', 'Legion Plate', "Champion's Bronze", 'Gilded Legend'];

const NAMES: Record<EquipSlot, string[]> = {
  helmet: ['Rag Wrap', 'Leather Cap', 'Padded Coif', 'Studded Cap', 'Bronze Pot Helm', 'Iron Galea', 'Mail Coif', 'Legion Galea', 'Crested Champion Helm', 'Gilded Plume Helm'],
  armor: ['Rag Sash', 'Scrap Harness', 'Padded Gambeson', 'Studded Vest', 'Bronze Pectoral', 'Scale Cuirass', 'Mail Shirt', 'Segmented Plate', 'Bronze Muscle Cuirass', 'Gilded Lion Cuirass'],
  shoulders: ['Rag Shoulder', 'Leather Pad', 'Quilted Pauldron', 'Studded Pauldron', 'Bronze Disc', 'Scale Pauldron', 'Mail Sleeve', 'Laminar Pauldron', 'Champion Pauldron', 'Lion Pauldron'],
  greaves: ['Rag Leg Wraps', 'Leather Shin Guards', 'Linen Fasciae', 'Studded Greaves', 'Bronze Greaves', 'Iron Greaves', 'Mail Chausses', 'Legion Greaves', 'Champion Ocreae', 'Gilded Greaves'],
  boots: ['Rag Foot Wraps', 'Rope Sandals', 'Strapped Sandals', 'Studded Shoes', 'Laced Boots', 'Caligae', 'Iron-toe Boots', 'Steel Sabatons', 'Fur-lined Boots', 'Gilded Boots'],
};

const SET_ARMOR = [3, 6, 10, 15, 21, 28, 36, 45, 55, 66];
const SET_PRICE = [40, 120, 300, 650, 1300, 2500, 4600, 8200, 14500, 25000];
const SET_WEIGHT = [1, 2, 3, 4, 6, 8, 9, 10, 9, 8];
const MIN_LEVEL = [1, 2, 4, 6, 9, 12, 16, 20, 25, 30];
const SHARE: Record<EquipSlot, number> = { armor: 0.4, helmet: 0.2, greaves: 0.15, boots: 0.13, shoulders: 0.12 };
const BONUS: Record<number, string> = { 9: '+5% crowd favour', 10: '+3 Charm, +10% crowd favour' };

export const ITEMS: Item[] = [];
for (let t = 1; t <= 10; t++) {
  for (const slot of Object.keys(NAMES) as EquipSlot[]) {
    ITEMS.push({
      id: `${slot}${t}`, slot, tier: t, name: NAMES[slot][t - 1], set: SET_NAMES[t - 1],
      armor: Math.max(1, Math.round(SET_ARMOR[t - 1] * SHARE[slot])),
      weight: Math.max(0.5, Math.round(SET_WEIGHT[t - 1] * SHARE[slot] * 2) / 2),
      price: Math.round((SET_PRICE[t - 1] * SHARE[slot]) / 5) * 5,
      minLevel: MIN_LEVEL[t - 1],
      bonus: BONUS[t],
    });
  }
}

/** full-set bonus: all 5 pieces of one tier */
export const SET_BONUS = '+10% armour when wearing the full set';

export function item(slot: EquipSlot, tier: number): Item | undefined {
  return ITEMS.find((i) => i.slot === slot && i.tier === tier);
}
