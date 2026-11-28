/** The stands of a screen outside a fight: they cheer in waves on their own and now and then throw flowers. */
import { reduceMotion } from '../ui/motion';
import type { CrowdFx } from '../ui/crowdFx';

/** where thrown flowers land, px of the 1920x1080 arena: on the sand between and around the two gladiators */
const FLOWERS_AT = { from: 900, to: 1800, y: 960 } as const;

/** a number between `a` and `b` */
const between = (a: number, b: number) => a + Math.random() * (b - a);

/** The tick of a lively crowd (call it with the seconds passed). With Reduce motion no new cheers or flowers start. */
export function liveCrowd(crowd: CrowdFx): (dt: number) => void {
  crowd.mood = 0.8;
  let nextCheer = 0.6;
  let nextFlowers = 4;
  return (dt) => {
    if (!reduceMotion()) {
      nextCheer -= dt;
      nextFlowers -= dt;
      if (nextCheer <= 0) {
        crowd.cheer(Math.random() < 0.25 ? 1 : between(0.35, 0.7), between(0, 1920));
        nextCheer = between(1.8, 3.8);
      }
      if (nextFlowers <= 0) {
        crowd.throw('bouquet', 3 + Math.floor(Math.random() * 4), between(FLOWERS_AT.from, FLOWERS_AT.to), FLOWERS_AT.y);
        nextFlowers = between(5, 9);
      }
    }
    crowd.update(dt);
  };
}
