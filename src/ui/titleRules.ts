import type { SavedCharacter } from '../core/save';
import { isFirstBout } from './rookieRules';

export interface TitleEntry {
  readonly id: 'continue' | 'new' | 'settings' | 'credits';
  readonly label: string;
  readonly note: string;
  /** `?view=` the entry opens; settings and credits open over the title instead */
  readonly view?: string;
}

/**
 * The main menu's entries, top to bottom. Without a saved gladiator there is no Continue. Continue goes to town, the hub
 * of a career. Two gladiators go to the pre-fight screen instead: one who has not finished a bout yet (the easy first
 * one) and one whose nemesis is waiting (#209), whom no building in town leads to.
 */
export function titleEntries(saved: SavedCharacter | null): TitleEntry[] {
  const career: TitleEntry[] = saved
    ? [{ id: 'continue', label: 'Continue', note: `${saved.name} · level ${saved.level}`, view: isFirstBout(saved) || saved.nemesis ? 'prefight' : 'town' }]
    : [];
  return [
    ...career,
    { id: 'new', label: 'New game', note: 'a new road from Kamionka', view: 'creator' },
    { id: 'settings', label: 'Settings', note: 'sound, text, motion' },
    { id: 'credits', label: 'Credits', note: 'who made the game' },
  ];
}
