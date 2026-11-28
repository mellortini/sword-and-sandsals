/// <reference types="vite/client" />
import type { SavedCharacter } from '../core/save';
import { sleepQuote } from '../core/home';
import { templeHealingQuote } from '../core/temple';
import { openEnchanter } from './enchanter';
import { openForge } from './forge';
import { openGear } from './gear';
import { openHome } from './home';
import { openLeagues } from './leagues';
import { ladderNote } from './leagueRules';
import { careerLoadout } from './gearRules';
import { equipmentSignal, recordForCareer, trophyCount } from './achievementRules';
import { showAchievements } from './achievementToast';
import { openTrophies } from './trophies';
import { openShop } from './shop';
import type { LookPreview } from './lookPreview';
import { openSkillTree } from './skillTree';
import { openTavern } from './tavern';
import { openTemple } from './temple';
import { QUESTS, questState } from '../core/quests';
import { openTrainer } from './trainer';
import { plural } from './townRules';
import './forge.css';
import './town.css';

type Save = (character: SavedCharacter) => Promise<void>;

interface Building {
  readonly id: string;
  readonly name: string;
  /** what the place is for, always the same */
  readonly purpose: string;
  /** the gladiator's state there, e.g. "2 skill points to spend" */
  readonly note: (c: SavedCharacter) => string;
  /** `preview` draws the gladiator in a look, for screens that try things on (the shops, #34) */
  readonly open: (c: SavedCharacter, save: Save, preview?: LookPreview) => Promise<SavedCharacter>;
}

/** The town's places in the order the panel lists them (#201). Each opens its own screen. */
export const BUILDINGS: readonly Building[] = [
  { id: 'leagues', name: 'Leagues', purpose: 'Climb the ladder to the champions', note: ladderNote, open: (c) => openLeagues(c) },
  { id: 'armourer', name: 'Armourer', purpose: 'Buy and sell armour', note: (c) => `${c.gold} gold`, open: (c, save, preview) => openShop('armourer', c, save, preview) },
  { id: 'weaponsmith', name: 'Weaponsmith', purpose: 'Buy and sell weapons', note: (c) => `${c.gold} gold`, open: (c, save, preview) => openShop('weaponsmith', c, save, preview) },
  {
    id: 'gear', name: 'Gear', purpose: 'Wear what is in your pack',
    note: (c) => plural(c.inventory.length, 'item') + ' in the pack', open: openGear,
  },
  {
    id: 'forge', name: 'Forge', purpose: 'Upgrade or salvage pack items',
    note: (c) => { const m = c.forgeMaterials; return m ? `${m.scraps} scraps · ${m.glue} glue` : 'no materials yet'; }, open: openForge,
  },
  { id: 'enchanter', name: 'Enchantress', purpose: 'Fire, water, ink or wind on a weapon', note: (c) => `${c.gold} gold`, open: openEnchanter },
  {
    id: 'temple', name: 'Glue Temple', purpose: 'Mend wounds, buy remedies',
    note: (c) => { const { health, maxHealth } = templeHealingQuote(c); return health < maxHealth ? `wounded · ${health} / ${maxHealth} HP` : 'no wounds'; },
    open: openTemple,
  },
  {
    id: 'home', name: 'Home', purpose: 'Sleep off your wounds for free',
    note: (c) => { const { health, maxHealth, day } = sleepQuote(c); return health < maxHealth ? `day ${day} · wounded` : `day ${day} · rested`; },
    open: openHome,
  },
  {
    id: 'trainer', name: 'Trainer', purpose: 'Place points, reset training',
    note: (c) => ((c.attributePoints ?? 0) > 0 ? `${plural(c.attributePoints!, 'point')} to place` : 'nothing to place'),
    open: (c, save) => openTrainer(c, careerLoadout(c), save),
  },
  {
    id: 'skills', name: 'Skills', purpose: 'Learn skills with skill points',
    note: (c) => ((c.skillPoints ?? 0) > 0 ? `${plural(c.skillPoints!, 'point')} to spend` : `${c.skills?.length ?? 0} learned`),
    open: openSkillTree,
  },
  {
    id: 'tavern', name: 'Tavern', purpose: 'Rumours, side tasks, bets',
    note: (c) => {
      const ready = QUESTS.filter((q) => questState(c, q.id) === 'completed').length;
      return ready ? `${plural(ready, 'task')} to collect` : `${c.gold} gold`;
    },
    open: openTavern,
  },
  { id: 'trophies', name: 'Hall of Fame', purpose: 'Your achievements and record', note: (c) => `${trophyCount(c)} earned`, open: (c) => openTrophies(c) },
];

/**
 * Opens one building's screen and waits until it closes (#30). New gear from the pack may complete an armour set
 * (#203): that is recorded, saved and announced here, so every way into a building behaves the same.
 */
export async function visitBuilding(id: string, character: SavedCharacter, save: Save, preview?: LookPreview): Promise<SavedCharacter> {
  const place = BUILDINGS.find((b) => b.id === id);
  if (!place) return character;
  let current = await place.open(character, save, preview);
  if (place.id === 'gear' && current !== character) {
    const { character: recorded, unlocked } = recordForCareer(current, equipmentSignal(careerLoadout(current)));
    if (unlocked.length) {
      current = recorded;
      await save(current).catch(() => undefined);
      showAchievements(unlocked);
    }
  }
  return current;
}

/**
 * The town panel (#201): one card per building with what it is for and the gladiator's state there. A card opens its
 * screen over the town; when that closes, the town comes back with fresh notes. `onChange` hears every saved change
 * (the title updates its puppet and notes). Leave or Escape closes; arrows move between the cards.
 */
export function openTown(character: SavedCharacter, save: Save, onChange?: (c: SavedCharacter) => void, preview?: LookPreview): Promise<SavedCharacter> {
  const backdrop = document.createElement('div');
  backdrop.className = 'forge town';
  backdrop.innerHTML = `
    <div class="forge__panel town__panel" role="dialog" aria-modal="true" aria-labelledby="twTitle">
      <div class="forge__head">
        <h3 id="twTitle">Pulpport</h3>
        <div class="forge__name">${escapeHtml(character.name)} · level ${character.level}</div>
        <div class="town__gold">Gold <b id="twGold"></b></div>
      </div>
      <div class="town__places" id="twPlaces"></div>
      <div class="forge__actions town__leave"><button type="button" data-act="leave">Leave</button></div>
    </div>`;
  document.body.append(backdrop);

  const $ = (id: string) => backdrop.querySelector<HTMLElement>(`#${id}`)!;
  let current = character;
  let keys = new AbortController();

  const refresh = (focusId?: string) => {
    $('twGold').textContent = String(current.gold);
    $('twPlaces').innerHTML = BUILDINGS.map((b) => `<button type="button" class="town-place" data-place="${b.id}">
      <span class="town-place__name">${b.name}</span><span class="town-place__purpose">${b.purpose}</span>
      <span class="town-place__note">${escapeHtml(b.note(current))}</span></button>`).join('');
    backdrop.querySelector<HTMLButtonElement>(focusId ? `[data-place="${focusId}"]` : '.town-place')?.focus();
  };

  return new Promise((resolve) => {
    const close = () => {
      keys.abort();
      backdrop.remove();
      resolve(current);
    };
    const listen = () => {
      keys = new AbortController();
      window.addEventListener('keydown', (e) => {
        e.stopImmediatePropagation();
        if (e.key === 'Escape') close();
        else if (e.key.startsWith('Arrow')) {
          e.preventDefault();
          const cards = [...backdrop.querySelectorAll<HTMLButtonElement>('.town-place, [data-act="leave"]')];
          const at = cards.indexOf(document.activeElement as HTMLButtonElement);
          const cols = getComputedStyle($('twPlaces')).gridTemplateColumns.split(' ').length;
          const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowDown' ? cols : -cols;
          cards[at < 0 ? 0 : Math.max(0, Math.min(cards.length - 1, at + step))]?.focus();
        }
      }, { capture: true, signal: keys.signal });
    };
    backdrop.addEventListener('click', async (e) => {
      const button = (e.target as HTMLElement).closest('button');
      if (!button) return;
      if (button.dataset.act === 'leave') return close();
      const place = BUILDINGS.find((b) => b.id === button.dataset.place);
      if (!place) return;
      // the building's screen takes the keys while it is open
      keys.abort();
      backdrop.hidden = true;
      const before = current;
      current = await visitBuilding(place.id, current, save, preview);
      backdrop.hidden = false;
      if (current !== before) onChange?.(current);
      listen();
      refresh(place.id);
    });
    listen();
    refresh();
  });
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export { townNote } from './townRules';
