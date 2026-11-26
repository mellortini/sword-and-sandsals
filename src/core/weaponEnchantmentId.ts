export const ENCHANT_ELEMENTS = ['fire', 'water', 'ink', 'wind'] as const;
export type EnchantElement = (typeof ENCHANT_ELEMENTS)[number];
export type EnchantPower = 1 | 2 | 3;

export interface WeaponEnchantment {
  readonly element: EnchantElement;
  readonly power: EnchantPower;
}

export function readWeaponEnchantment(id?: string): { baseId?: string; enchantment?: WeaponEnchantment } {
  const [baseId, element, power, extra] = id?.split('~') ?? [];
  if (!baseId || !ENCHANT_ELEMENTS.some((entry) => entry === element) || !['1', '2', '3'].includes(power) || extra !== undefined) {
    return { baseId: id };
  }
  return { baseId, enchantment: { element: element as EnchantElement, power: Number(power) as EnchantPower } };
}
