/**
 * What happens to the loser of a finisher (#20), 30 fps, frame 0 = the killing blow lands.
 *  - finish_decap: the head tears off and hops away over the sand; the body stands a beat, then buckles and falls
 *  - finish_fold:  gore off. The fighter stays in one piece, is knocked off his feet and slaps down flat
 * The head flies forward, into the open sand between the fighters, so it never hides behind the falling body.
 */
import type { Clip } from './clip';

export const FINISHER_CLIPS: Clip[] = [
  {
    name: 'finish_decap', length: 56, hold: true,
    events: [
      { f: 0, type: 'cut' }, { f: 19, type: 'bounce' }, { f: 28, type: 'bounce' }, { f: 34, type: 'bounce' },
      { f: 38, type: 'impact' },
    ],
    head: {
      from: 0,
      start: { x: 0.08, h: 9.65, rot: 0 },
      hops: [
        { f: 19, x: 3.1, h: 1.12, rot: -300, peak: 5.0 },
        { f: 28, x: 4.0, h: 1.12, rot: -390, peak: 1.15 },
        { f: 34, x: 4.45, h: 1.12, rot: -425, peak: 0.42 },
        { f: 44, x: 4.7, h: 1.12, rot: -440, peak: 0 },
      ],
    },
    keys: [
      { f: 0 },
      { f: 3, x: -0.2, ease: 'out', pose: { torso: 15, arm_f_up: 74, arm_f_lo: 24, arm_b_up: 62, arm_b_lo: 40, blade: 30 } },
      // the headless beat: the body has not noticed yet
      { f: 10, x: -0.2, pose: { torso: -5, arm_f_up: 44, arm_f_lo: 36, arm_b_up: 18, arm_b_lo: 52, blade: -20 } },
      { f: 16, x: -0.3, pose: { torso: 9, arm_f_up: 24, arm_f_lo: 30, arm_b_up: -30, arm_b_lo: 20, blade: -64 } },
      { f: 25, air: true, x: -0.55, y: -1.6, ease: 'in', pose: { pelvis: 14, torso: 20, leg_f_up: 52, leg_f_lo: -84, leg_b_up: 30, leg_b_lo: -92, foot_f: 30, foot_b: 60 } },
      { f: 36, air: true, x: -1.3, y: -3.7, ease: 'in', pose: { pelvis: 76, torso: 8, leg_f_up: 40, leg_f_lo: -24, leg_b_up: 24, leg_b_lo: -12, arm_f_up: 120, arm_f_lo: 10, arm_b_up: 140, arm_b_lo: 10, foot_f: -20, foot_b: -10 } },
      { f: 39, air: true, x: -1.45, y: -4.15, ease: 'out', pose: { pelvis: 86 } },
      { f: 42, air: true, x: -1.5, y: -3.95, pose: { pelvis: 83 } },
      { f: 47, air: true, x: -1.5, y: -4.2, ease: 'out', pose: { pelvis: 88, leg_f_up: 10, leg_f_lo: -6, leg_b_up: -4, leg_b_lo: -2, foot_f: -60, foot_b: -70, arm_f_up: 130 } },
      { f: 56, air: true, x: -1.5, y: -4.2 },
    ],
  },
  {
    name: 'finish_fold', length: 44, hold: true,
    events: [{ f: 0, type: 'cut' }, { f: 16, type: 'impact' }, { f: 26, type: 'bounce' }],
    keys: [
      { f: 0 },
      { f: 4, air: true, x: -0.7, y: 0.7, ease: 'out', pose: { pelvis: 24, torso: 22, head: 30, leg_f_up: 52, leg_f_lo: -22, leg_b_up: 18, leg_b_lo: -34, foot_f: 10, foot_b: 30, arm_f_up: 104, arm_f_lo: 16, arm_b_up: 120, arm_b_lo: 22, blade: 60 } },
      { f: 10, air: true, x: -1.7, y: -0.3, pose: { pelvis: 62, torso: 10, head: -14, leg_f_up: 66, leg_f_lo: -18, leg_b_up: 40, leg_b_lo: -30, arm_f_up: 138, arm_b_up: 150 } },
      { f: 16, air: true, x: -2.05, y: -4.1, ease: 'in', pose: { pelvis: 88, torso: 2, head: 20, leg_f_up: 38, leg_f_lo: -20, leg_b_up: 22, leg_b_lo: -14 } },
      { f: 21, air: true, x: -2.15, y: -3.45, ease: 'out', pose: { pelvis: 78, head: -6, leg_f_up: 46, leg_b_up: 28, arm_f_up: 118, arm_b_up: 128 } },
      { f: 26, air: true, x: -2.2, y: -4.2, ease: 'in', pose: { pelvis: 90, torso: 0, head: 16, leg_f_up: 14, leg_f_lo: -8, leg_b_up: 2, leg_b_lo: -4, foot_f: -60, foot_b: -70 } },
      { f: 34, air: true, x: -2.2, y: -4.2, ease: 'out', pose: { head: 24, leg_f_up: 6, arm_f_up: 150, arm_f_lo: 4, arm_b_up: 162, arm_b_lo: 6 } },
      { f: 44, air: true, x: -2.2, y: -4.2 },
    ],
  },
];
