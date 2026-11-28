import type { Dialogue } from '../../core/dialogue';
import { OLD_HASK } from './oldHask';

/** Every dialogue of the game by id (#292); a new one is a file here and a line below. */
export const DIALOGUES: Readonly<Record<string, Dialogue>> = {
  [OLD_HASK.id]: OLD_HASK,
};
