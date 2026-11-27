import type { SceneContext } from '../common';
import { TownBackdrop } from '../townBackdrop';

/**
 * `?view=town`: the animated town backdrop on its own (#29).
 * `&time=0..1` start phase (0 sunrise, 0.25 noon, 0.5 sunset, 0.75 midnight), `&day=<seconds>` length of a whole day,
 * `&freeze` keeps the clock at `time` (clouds and flames still move).
 */
export async function showTown({ world, params }: SceneContext) {
  const time = Number(params.get('time'));
  const day = Number(params.get('day'));
  const town = await TownBackdrop.load(import.meta.env.BASE_URL, {
    phase: params.has('time') && Number.isFinite(time) ? time : undefined,
    daySeconds: day > 0 ? day : undefined,
    frozen: params.has('freeze'),
  });
  world.addChild(town);
  (window as unknown as { __town: TownBackdrop }).__town = town;
  return (dt: number) => town.update(dt);
}
