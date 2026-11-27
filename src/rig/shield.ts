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

/**
 * The quarter turn behind a shield (#273): the body turns a little towards the enemy, so the shield shoulder comes
 * forward (in front of the chest) and the sword shoulder slides back behind it; the chest reads a little narrower.
 */
export const SHIELD_TURN = { shieldShoulder: 0.6, swordShoulder: -0.5, chestWidth: 0.9 } as const;

/**
 * The pose with the shield bone turned so the shield keeps the body's lean (plus the clip's own `shield` tilt), and
 * both shoulders where the quarter turn puts them.
 */
export function holdShield(pose: Pose): Pose {
  const arm = ARM.reduce((a, b) => a + (pose[b] ?? 0), 0);
  return {
    ...pose,
    shield: (pose.shield ?? 0) - arm,
    arm_b_shift: (pose.arm_b_shift ?? 0) + SHIELD_TURN.shieldShoulder,
    arm_f_shift: (pose.arm_f_shift ?? 0) + SHIELD_TURN.swordShoulder,
  };
}

type Layer = KitJson['layers'][number];
/** the shield arm's layers, drawn like a near arm: forearm, bracer, upper arm, shoulder, hand */
const ARM_ORDER: ReadonlyArray<[bone: string, slot: string]> = [
  ['arm_b_lo', 'body'], ['arm_b_lo', 'armor'], ['arm_b_up', 'body'], ['arm_b_up', 'shoulders'], ['hand_b', 'body'],
];
/** the sword arm's upper arm and shoulder pad: behind the turned chest */
const SWORD_SHOULDER: ReadonlyArray<[bone: string, slot: string]> = [['arm_f_up', 'body'], ['arm_f_up', 'shoulders']];

const pick = (layers: readonly Layer[], which: ReadonlyArray<[string, string]>) =>
  which.flatMap(([bone, slot]) => layers.filter((l) => l.bone === bone && l.slot === slot));
const among = (which: ReadonlyArray<[string, string]>) => (l: Layer) => which.some(([bone, slot]) => l.bone === bone && l.slot === slot);

/**
 * The draw order of the quarter turn behind a shield (#273), from the back:
 * - the sword shoulder and upper arm go behind the chest (in the back arm's shade): only the elbow comes out;
 * - the chest, head and helmet;
 * - the sword forearm, the blade and the sword hand, in front of the chest;
 * - on top, the shield arm (shoulder and all, in full light) and the shield, the nearest things to the viewer: a
 *   raised shield covers the sword shoulder, and a blade drawn back passes behind it.
 * Mirrored, the opponent holds the shield in the near (left) hand the same way. Without a shield the kit's order stays.
 */
export function shieldArmInFront(layers: readonly Layer[]): Layer[] {
  const shield = layers.filter((l) => l.slot === 'shield');
  if (!shield.length) return [...layers];
  const arm = pick(layers, ARM_ORDER).map((l) => ({ ...l, back: false }));
  const shoulder = pick(layers, SWORD_SHOULDER).map((l) => ({ ...l, back: true }));
  const rest = layers.filter((l) => !among(ARM_ORDER)(l) && !among(SWORD_SHOULDER)(l) && l.slot !== 'shield');
  const chest = rest.findIndex((l) => l.bone === 'torso' && l.slot === 'body');
  return [...rest.slice(0, chest), ...shoulder, ...rest.slice(chest), ...arm, ...shield];
}
