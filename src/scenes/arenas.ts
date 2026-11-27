/**
 * The fight arenas (#272): the empty stands a bout is fought in front of, and the spectators who sit there. Every
 * picture keeps the geometry of blender/arena.py (blender/arena_lib.py), so backdrop.ts and FIGHT_LAYOUT fit all.
 */
import type { StandsLook } from './backdrop';

export interface ArenaTheme {
  /** path under assets/: the arena with nobody in the stands */
  readonly picture: string;
  /** path under assets/ without extension: the spectator sprites (.png) and their places (.json), for CrowdFx */
  readonly people: string;
  /** how backdrop.ts softens the stands, where the picture needs other than the sunny default */
  readonly stands?: StandsLook;
}

export const ARENAS: Readonly<Record<'pulpport' | 'kraftmoor', ArenaTheme>> = {
  pulpport: { picture: 'bg/arena_empty.png', people: 'bg/arena_people' },
  kraftmoor: {
    picture: 'bg/arena_kraftmoor_empty.png',
    people: 'bg/arena_kraftmoor_people',
    // an overcast picture: dimmed like the sunny one it turns to mud, and the lamps and the press are lost
    stands: { blur: 4, saturation: 0.85, brightness: 0.96, shade: 0.4 },
  },
};

export type ArenaId = keyof typeof ARENAS;

export const isArenaId = (id: string | null | undefined): id is ArenaId => !!id && Object.hasOwn(ARENAS, id);
