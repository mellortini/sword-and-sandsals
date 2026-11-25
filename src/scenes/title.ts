import { Container, Graphics, Sprite, Text } from 'pixi.js';
import { saveGame } from '../core/save';
import type { SavedCharacter } from '../core/save';
import { openForge } from '../ui/forge';
import { openSkillTree } from '../ui/skillTree';
import { openTemple } from '../ui/temple';
import { templeHealingQuote } from '../core/temple';
import { PaperMenu } from '../ui/paperMenu';
import { TEXT_SIZES, cycleTextSize, textSizeIndex } from '../ui/textSize';
import type { PaperMenuEntry } from '../ui/paperMenu';
import { FEET_Y, H, PELVIS_ABOVE_FEET, UNIT, W, groundShadowTexture, randomLook } from './common';
import type { SceneContext } from './common';
import { loadSavedGladiator } from './savedGladiator';

interface TitleEntry extends PaperMenuEntry {
  /** `?view=` the entry opens */
  readonly view?: string;
  /** a setting changed in place (Enter, ←/→) instead of a screen */
  readonly setting?: 'textSize';
  /** a panel opened over the title (skills #54, forge #189) */
  readonly panel?: 'skills' | 'forge' | 'temple';
}

const skillNote = (c: SavedCharacter) => {
  const n = c.skillPoints ?? 0;
  return n > 0 ? `${n} skill ${n === 1 ? 'point' : 'points'} to spend` : `${c.skills?.length ?? 0} learned`;
};

const forgeNote = (c: SavedCharacter) => {
  const n = c.inventory.length;
  return n > 0 ? `${n} ${n === 1 ? 'item' : 'items'} in your pack` : 'pack is empty';
};

const templeNote = (c: SavedCharacter) => {
  const { health, maxHealth } = templeHealingQuote(c);
  return health < maxHealth ? `wounded · ${health} / ${maxHealth} HP` : `${c.gold} gold`;
};

function entries(saved: SavedCharacter | null): TitleEntry[] {
  return [
    { label: 'New game', enabled: true, view: 'creator' },
    saved
      ? { label: 'Continue', enabled: true, view: 'prefight', note: `${saved.name} · level ${saved.level}` }
      : { label: 'Continue', enabled: false, note: 'no saved game yet' },
    saved
      ? { label: 'Skills', enabled: true, panel: 'skills', note: skillNote(saved) }
      : { label: 'Skills', enabled: false, note: 'no saved game yet' },
    saved
      ? { label: 'Forge', enabled: true, panel: 'forge', note: forgeNote(saved) }
      : { label: 'Forge', enabled: false, note: 'no saved game yet' },
    saved
      ? { label: 'Temple', enabled: true, panel: 'temple', note: templeNote(saved) }
      : { label: 'Temple', enabled: false, note: 'no saved game yet' },
    { label: 'Quick bout', enabled: true, view: 'prefight&gladiator=random' },
    { label: 'Wardrobe', enabled: true, view: 'wardrobe' },
    { label: 'Text size', enabled: true, setting: 'textSize', note: TEXT_SIZES[textSizeIndex()].name },
  ];
}

/**
 * `?view=title`: game title over the dimmed arena, two idle gladiators facing each other and the main menu.
 * Mouse or keyboard (↑/↓, Enter; ←/→ change a setting such as Text size, #77). Entries open their view by URL.
 */
export async function showTitle({ world, bgTex, ui, add }: SceneContext) {
  const root = new Container();
  world.addChild(root);
  const bg = new Sprite(bgTex);
  bg.tint = 0x8a7470;
  root.addChild(bg);

  // the saved gladiator (if any) stands on the left
  const saved = await loadSavedGladiator();
  const gsh = groundShadowTexture();
  for (const [i, x] of [[0, 330], [1, 1590]] as const) {
    const g = new Sprite(gsh);
    g.anchor.set(0.5); g.blendMode = 'multiply'; g.tint = 0x8a5a48;
    g.width = 5.2 * UNIT; g.height = 1.3 * UNIT;
    g.position.set(x + 0.35 * UNIT * (i ? -1 : 1), FEET_Y);
    root.addChild(g);
    await add(i === 0 && saved ? saved.look : randomLook(), x, FEET_Y - PELVIS_ABOVE_FEET * UNIT, UNIT, i ? -1 : 1, root, i * 0.7);
  }

  // a dark vignette band behind the title and the menu keeps the text readable over the busy stands
  const band = new Graphics();
  root.addChild(band);

  const title = new Text({
    text: 'FOLDED GLORY',
    style: {
      fontFamily: 'Georgia', fontSize: 120, fontWeight: 'bold', fill: '#f2c14e', letterSpacing: 10,
      dropShadow: { color: '#3a1418', alpha: 0.9, angle: Math.PI / 4, distance: 6, blur: 2 },
    },
  });
  title.anchor.set(0.5);
  title.position.set(W / 2, 190);
  const tagline = new Text({
    text: 'Paper gladiators. Ink for blood.',
    style: { fontFamily: 'Georgia', fontSize: 34, fontStyle: 'italic', fill: '#f4d3a7' },
  });
  tagline.anchor.set(0.5);
  tagline.position.set(W / 2, 290);
  root.addChild(title, tagline);

  const items = entries(saved);
  const changeSetting = (i: number, step: 1 | -1) => {
    if (items[i].setting === 'textSize') menu.setNote(i, TEXT_SIZES[cycleTextSize(step)].name);
  };
  let gladiator = saved;
  const menu = new PaperMenu(items, (i) => {
    const view = items[i].view;
    if (view) location.search = `?view=${view}`;
    else if (items[i].panel === 'skills' && gladiator) {
      void openSkillTree(gladiator, saveGame).then((c) => {
        gladiator = c;
        menu.setNote(i, skillNote(c));
      });
    } else if (items[i].panel === 'forge' && gladiator) {
      void openForge(gladiator, saveGame).then((c) => {
        gladiator = c;
        menu.setNote(i, forgeNote(c));
      });
    } else if (items[i].panel === 'temple' && gladiator) {
      void openTemple(gladiator, saveGame).then((c) => {
        gladiator = c;
        menu.setNote(i, templeNote(c));
      });
    } else changeSetting(i, 1);
  }, undefined, saved ? 1 : 0);
  const menuY = 330;
  // the menu shrinks to keep itself and the hint on the screen once it has many entries (town screens, #189/#191)
  const menuScale = Math.min(1, (H - menuY - 90) / menu.menuHeight);
  menu.scale.set(menuScale);
  menu.position.set((W - menu.menuWidth * menuScale) / 2, menuY);
  const menuBottom = menuY + menu.menuHeight * menuScale;
  band.roundRect(W / 2 - 520, 60, 1040, Math.max(880, menuBottom + 80 - 60), 40).fill({ color: 0x1c1013, alpha: 0.55 });
  root.addChild(menu);

  const hint = new Text({ text: '↑ ↓  choose    Enter  confirm    ← →  change text size', style: { fontFamily: 'Georgia', fontSize: 22, fill: '#cdb99a' } });
  hint.anchor.set(0.5);
  hint.position.set(W / 2, menuBottom + 40);
  root.addChild(hint);

  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') menu.move(1);
    else if (e.key === 'ArrowUp') menu.move(-1);
    else if (e.key === 'Enter') menu.choose();
    else if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && items[menu.selected]?.setting) changeSetting(menu.selected, e.key === 'ArrowRight' ? 1 : -1);
    else return;
    e.preventDefault();
  });
  ui.innerHTML = '<a href="?view=arena">arena</a>';
}
