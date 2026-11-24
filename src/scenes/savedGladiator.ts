import { loadGame } from '../core/save';
import type { SavedCharacter } from '../core/save';
import { resolveAttributes } from '../core/stats';
import { DEFAULT_LOOK } from '../rig/PaperRig';

/** stand-in loadGame hands back when there is no save; never shown or stored */
const NOBODY: SavedCharacter = {
  name: 'Nobody', level: 1, experience: 0, gold: 0, attributes: resolveAttributes(), look: { ...DEFAULT_LOOK }, inventory: [],
};

/** The saved gladiator, or null when there is none (or it cannot be read). */
export async function loadSavedGladiator(): Promise<SavedCharacter | null> {
  try {
    const result = await loadGame(() => NOBODY);
    return result.status === 'loaded' ? result.character : null;
  } catch {
    return null;
  }
}
