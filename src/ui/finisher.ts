/**
 * One call plays a finisher on the loser (#20): the clip that fits the gore setting plus the paper flying off it.
 * The winner's blow is an ordinary attack clip; call this on its `hit` frame.
 */
import type { Animator } from '../anim/Animator';
import { HEAD_CENTRE } from '../anim/decap';
import { playSever } from '../audio/sever';
import type { FxLayer } from './fx';
import { finisherClip, goreMode } from './gore';
import type { GoreMode } from './gore';
import { PaperScraps } from './scraps';

export interface FinisherOptions {
  /** screen y of the sand under the fighters */
  floorY: number;
  /** default: the saved setting */
  mode?: GoreMode;
  onEnd?: () => void;
}

export function playFinisher(victim: Animator, fx: FxLayer, options: FinisherOptions) {
  const mode = options.mode ?? goreMode();
  const rig = victim.rig;
  const scraps = new PaperScraps(mode, options.floorY);
  fx.addScraps(scraps);
  const neck = () => rig.screenPoint('torso', 0.12, 3.5);
  const head = () => rig.screenPoint('head', HEAD_CENTRE.x, HEAD_CENTRE.y);
  const chest = () => rig.screenPoint('torso', 0.2, 2.2);
  const up = -Math.PI / 2;
  victim.play(finisherClip(mode), {
    blend: 2, then: null, onEnd: options.onEnd,
    onEvent: (e) => {
      if (mode === 'off') {
        if (e.type === 'cut') scraps.burst({ ...chest(), count: 46, angle: up, spread: 1.7, speed: 30 });
        // a puff of paper where the body slaps the sand
        else if (e.type === 'impact') scraps.burst({ ...chest(), count: 16, angle: up, spread: 1.4, speed: 15 });
        return;
      }
      if (e.type === 'cut') {
        playSever(mode);
        scraps.burst({ ...neck(), count: 38, angle: up - 0.35 * rig.facing, spread: 1.2, speed: 28 });
        scraps.spray(neck, 30);
      } else if (e.type === 'bounce') {
        scraps.burst({ ...head(), count: 6, angle: up, spread: 1.3, speed: 11 });
      } else if (e.type === 'impact') {
        scraps.burst({ ...neck(), count: 14, angle: up, spread: 1.5, speed: 13 });
      }
    },
  });
}
