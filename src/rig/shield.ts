/**
 * Shields (#38) in the ten tiers of the armour sets, shaped by their era: tiers 1-4 (rags to studded hide) carry a
 * small round parma that grows with the tier, tiers 5-10 (bronze recruit onwards, the legion era) a tall rectangular
 * scutum that keeps growing. The look names the tier (`shield: 0..10`, 0 = none; sprite `shield<tier>`, bone `shield`
 * under `hand_b`).
 *
 * The shield is strapped to the forearm but held facing the enemy, so it does not swing with the arm: the rig turns
 * the shield bone so the shield leans with the body (pelvis + torso) whatever the arm does. A clip may still tilt it
 * on top of that with the `shield` pose key (degrees CCW).
 */
import type { KitJson, Pose } from './PaperRig';

export const SHIELD_TIERS = 10;
/** the last tier with a round shield; from the next one on, a scutum */
export const ROUND_TIERS = 4;

/** the back-arm bones between the torso and the shield */
const ARM = ['arm_b_up', 'arm_b_lo', 'hand_b'] as const;

/** is this a shield tier (1..10)? */
export function isShieldTier(tier: number | undefined): tier is number {
  return Number.isInteger(tier) && tier! >= 1 && tier! <= SHIELD_TIERS;
}

export function shieldShape(tier: number): 'round' | 'scutum' {
  return tier <= ROUND_TIERS ? 'round' : 'scutum';
}

/** display name for the wardrobe: shape and the armour set of that tier */
export function shieldName(tier: number | undefined, sets: readonly string[]): string {
  if (!isShieldTier(tier)) return '—';
  return `${shieldShape(tier) === 'round' ? 'Parma' : 'Scutum'} · ${sets[tier - 1] ?? tier}`;
}

/** the pose with the shield bone turned so the shield keeps the body's lean (plus the clip's own `shield` tilt) */
export function holdShield(pose: Pose): Pose {
  const arm = ARM.reduce((a, b) => a + (pose[b] ?? 0), 0);
  return { ...pose, shield: (pose.shield ?? 0) - arm };
}

type Layer = KitJson['layers'][number];
/** the shield arm's layers in front of the body, drawn like the sword arm: forearm, bracer, upper arm, shoulder, hand */
const ARM_ORDER: ReadonlyArray<[bone: string, slot: string]> = [
  ['arm_b_lo', 'body'], ['arm_b_lo', 'armor'], ['arm_b_up', 'body'], ['arm_b_up', 'shoulders'], ['hand_b', 'body'],
];

/**
 * The draw order with a shield (#273): the arm that carries it comes out from behind the body, shoulder and all, and is
 * drawn in full light just under the shield, so the arm reads as the near one holding it. Mirrored, the opponent holds
 * the shield in the left hand the same way. Without the shield the arm stays behind the body (the kit's own order).
 */
export function shieldArmInFront(layers: readonly Layer[]): Layer[] {
  const isArm = (l: Layer) => ARM_ORDER.some(([bone, slot]) => l.bone === bone && l.slot === slot);
  const arm = ARM_ORDER.flatMap(([bone, slot]) => layers.filter((l) => l.bone === bone && l.slot === slot))
    .map((l) => ({ ...l, back: false }));
  const rest = layers.filter((l) => !isArm(l));
  const at = rest.findIndex((l) => l.slot === 'shield');
  if (at < 0) return [...layers];
  return [...rest.slice(0, at), ...arm, ...rest.slice(at)];
}
