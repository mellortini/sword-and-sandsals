/**
 * Body damage stages (#284): the wounds on a fighter follow the health left, 10 % at a time. The overlay sprites come
 * from blender/wounds.py; kit.json `wounds` says which sprite each body part shows at each stage.
 */
export const WOUND_STAGES = 10;

/** 1 = unhurt (above 90 % health) ... 10 = 10 % or less */
export function woundStage(health: number, maxHealth: number): number {
  if (!(maxHealth > 0)) return 1;
  // whole numbers first: 90 of 100 must be exactly the second stage, not lost to a floating-point remainder
  const tenths = Math.ceil((Math.max(0, health) * WOUND_STAGES) / maxHealth);
  return Math.min(WOUND_STAGES, Math.max(1, WOUND_STAGES + 1 - tenths));
}

/** the overlay sprite of one body part at a stage (null = no wound there yet) */
export function woundSprite(table: Record<string, (string | null)[]> | undefined, part: string, stage = 1): string | null {
  return table?.[part]?.[stage - 1] ?? null;
}
