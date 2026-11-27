/**
 * Facial expressions (#26). A face shows an expression through three pose keys that clips animate like any bone
 * (0..1, the face switches at 0.5), so a flinch, a shout or a blink is just part of a clip's keys:
 *  - eyes: the lids are shut (sprite face<i>_lids_closed)
 *  - mouth: the mouth is open (face<i>_mouth_open)
 *  - brows: the brows are pulled down in anger or effort (face<i>_brows_angry replaces face<i>_brows)
 */
import type { Pose } from './PaperRig';

export const EXPRESSION_KEYS = ['eyes', 'mouth', 'brows'] as const;
export type ExpressionKey = (typeof EXPRESSION_KEYS)[number];

/** named looks, for the lab and portraits */
export const EXPRESSIONS: Readonly<Record<'neutral' | 'blink' | 'pain' | 'anger' | 'triumph', Readonly<Partial<Record<ExpressionKey, number>>>>> = {
  neutral: {},
  blink: { eyes: 1 },
  pain: { eyes: 1, mouth: 1 },
  anger: { brows: 1 },
  triumph: { mouth: 1 },
};

/** face layer piece -> the pose key that shows it (on: true) or hides it (on: false) */
export const EXPRESSION_PIECES: Readonly<Record<string, { key: ExpressionKey; on: boolean }>> = {
  lids_closed: { key: 'eyes', on: true },
  mouth_open: { key: 'mouth', on: true },
  brows_angry: { key: 'brows', on: true },
  brows: { key: 'brows', on: false },
};

/** is this face piece drawn in this pose? (pieces that no expression touches always are) */
export function pieceShown(piece: string, pose: Pose): boolean {
  const e = EXPRESSION_PIECES[piece];
  return !e || ((pose[e.key] ?? 0) > 0.5) === e.on;
}

/** seconds between blinks and how long the lids stay shut */
export const BLINK = { min: 2, max: 6, shut: 0.12 } as const;
