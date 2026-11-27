/** The back of a fight (#272): the arena's empty stands, softened, with its crowd over them. */
import { Assets, Sprite } from 'pixi.js';
import type { Container, Texture } from 'pixi.js';
import { CrowdFx } from '../ui/crowdFx';
import { ARENAS } from './arenas';
import type { ArenaId } from './arenas';
import { arenaBackdrop } from './backdrop';

/** Adds both to `parent`, under whatever comes next; the caller ticks the returned crowd. */
export async function buildArenaStage(parent: Container, id: ArenaId = 'pulpport'): Promise<CrowdFx> {
  const theme = ARENAS[id];
  const picture = await Assets.load<Texture>(`${import.meta.env.BASE_URL}${theme.picture}`);
  parent.addChild(new Sprite(arenaBackdrop(picture, theme.stands)));
  return parent.addChild(new CrowdFx(theme));
}
