import { Container, Graphics, Sprite, Text } from 'pixi.js';
import { PaperMenu } from '../ui/paperMenu';
import type { PaperMenuEntry } from '../ui/paperMenu';
import { FEET_Y, PELVIS_ABOVE_FEET, UNIT, W, groundShadowTexture, randomLook } from './common';
import type { SceneContext } from './common';

interface TitleEntry extends PaperMenuEntry {
  /** `?view=` the entry opens */
  readonly view?: string;
}

const ENTRIES: TitleEntry[] = [
  // unlocks with the character creator (#23)
  { label: 'New game', enabled: false, note: 'coming soon' },
  // unlocks with saved games (#10)
  { label: 'Continue', enabled: false, note: 'no saved game yet' },
  { label: 'Quick bout', enabled: true, view: 'prefight' },
  { label: 'Wardrobe', enabled: true, view: 'wardrobe' },
];

/**
 * `?view=title`: game title over the dimmed arena, two idle gladiators facing each other and the main menu.
 * Mouse or keyboard (↑/↓, Enter). Entries open their view by URL, like every other scene.
 */
export async function showTitle({ world, bgTex, ui, add }: SceneContext) {
  const root = new Container();
  world.addChild(root);
  const bg = new Sprite(bgTex);
  bg.tint = 0x8a7470;
  root.addChild(bg);

  const gsh = groundShadowTexture();
  for (const [i, x] of [[0, 330], [1, 1590]] as const) {
    const g = new Sprite(gsh);
    g.anchor.set(0.5); g.blendMode = 'multiply'; g.tint = 0x8a5a48;
    g.width = 5.2 * UNIT; g.height = 1.3 * UNIT;
    g.position.set(x + 0.35 * UNIT * (i ? -1 : 1), FEET_Y);
    root.addChild(g);
    await add(randomLook(), x, FEET_Y - PELVIS_ABOVE_FEET * UNIT, UNIT, i ? -1 : 1, root, i * 0.7);
  }

  // a dark vignette band behind the title and the menu keeps the text readable over the busy stands
  root.addChild(new Graphics()
    .roundRect(W / 2 - 520, 60, 1040, 800, 40)
    .fill({ color: 0x1c1013, alpha: 0.55 }));

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

  const menu = new PaperMenu(ENTRIES, (i) => {
    const view = ENTRIES[i].view;
    if (view) location.search = `?view=${view}`;
  });
  menu.position.set((W - menu.menuWidth) / 2, 380);
  root.addChild(menu);

  const hint = new Text({ text: '↑ ↓  choose    Enter  confirm', style: { fontFamily: 'Georgia', fontSize: 22, fill: '#cdb99a' } });
  hint.anchor.set(0.5);
  hint.position.set(W / 2, 380 + menu.menuHeight + 44);
  root.addChild(hint);

  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') menu.move(1);
    else if (e.key === 'ArrowUp') menu.move(-1);
    else if (e.key === 'Enter') menu.choose();
    else return;
    e.preventDefault();
  });
  ui.innerHTML = '<a href="?view=arena">arena</a>';
}
