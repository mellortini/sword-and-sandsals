/**
 * Body builds (#27): slim, average, heavy. A build widens or narrows the paper across the bone - the body part and
 * every armour piece on the same bone by the same factor - so all ten armour sets fit every build without new renders.
 * Heads, hands, feet and weapons keep their size.
 */
export const BUILDS = [
  { name: 'Slim', torso: 0.88, limb: 0.85 },
  { name: 'Average', torso: 1, limb: 1 },
  { name: 'Heavy', torso: 1.15, limb: 1.17 },
] as const;

export const DEFAULT_BUILD = 1;

const TORSO_BONES = new Set(['torso', 'pelvis']);
const LIMB_BONES = new Set(['arm_f_up', 'arm_f_lo', 'arm_b_up', 'arm_b_lo', 'leg_f_up', 'leg_f_lo', 'leg_b_up', 'leg_b_lo']);

/** how much wider (across the bone) the paper on `bone` is drawn for a build; unknown builds are average */
export function widthScale(build: number | undefined, bone: string): number {
  const b = BUILDS[build ?? DEFAULT_BUILD] ?? BUILDS[DEFAULT_BUILD];
  if (TORSO_BONES.has(bone)) return b.torso;
  if (LIMB_BONES.has(bone)) return b.limb;
  return 1;
}
