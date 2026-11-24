import { Container, Graphics, Sprite, Text } from 'pixi.js';
import { deriveStats, resolveAttributes } from '../core/stats';
import type { Attributes, EquipmentLoadout } from '../core/types';
import { EQUIP_SLOTS } from '../rig/PaperRig';
import type { Look, PaperRig } from '../rig/PaperRig';
import { StatPanel } from '../ui/statPanel';
import { comparisonRows } from '../ui/statRows';
import type { ComparedFighter } from '../ui/statRows';
import { showArena } from './arena';
import { W, randomLook } from './common';
import type { SceneContext, SceneUpdate } from './common';

export interface PreFightFighter extends ComparedFighter {
  readonly look: Look;
}

export type PreFightChoice = 'fight' | 'retreat';

/** Equipment tiers worn on the puppet are the same numbers the combat core reads. */
export function loadoutFromLook(look: Look): EquipmentLoadout {
  const loadout: EquipmentLoadout = {};
  for (const slot of EQUIP_SLOTS) if (look[slot] > 0) loadout[slot] = look[slot];
  return loadout;
}

export function preFightFighter(name: string, level: number, look: Look, attributes: Partial<Attributes> = {}): PreFightFighter {
  const resolved = resolveAttributes(attributes);
  return { name, level, look, attributes: resolved, stats: deriveStats(resolved, loadoutFromLook(look)) };
}

const PORTRAIT_W = 420;
const PORTRAIT_H = 500;
const PORTRAIT_SCALE = 56;
/** top of the portrait window in rig units above the pelvis (room for crests and plumes) */
const PORTRAIT_TOP = 8.6;
const PANEL_W = 640;
const TOP = 170;

/**
 * Pre-fight comparison: two portraits, names, levels and a stat table, with Fight / Retreat.
 * Draws into `context.world`, resolves with the choice and removes everything it added.
 * Keyboard: Enter = Fight, Escape = Retreat.
 */
export async function openPreFight(context: SceneContext, player: PreFightFighter, enemy: PreFightFighter): Promise<PreFightChoice> {
  const { world, bgTex, rigs, add } = context;
  const root = new Container();
  world.addChild(root);

  const bg = new Sprite(bgTex);
  bg.tint = 0x6e5c58;
  root.addChild(bg, title('Arena bout', W / 2, 58));

  const rigsBefore = rigs.length;
  const sideX = (W - PANEL_W) / 2 - PORTRAIT_W - 60;
  await portrait(root, add, player, sideX, 1);
  await portrait(root, add, enemy, W - sideX - PORTRAIT_W, -1);
  // the shared ticker renders the portraits until the choice is made; then they are taken out of `rigs`
  const added = rigs.slice(rigsBefore);

  const panel = new StatPanel(comparisonRows(player, enemy), PANEL_W);
  panel.position.set((W - PANEL_W) / 2, TOP);
  root.addChild(panel);

  const buttonsY = TOP + panel.panelHeight + 44;
  return new Promise<PreFightChoice>((resolve) => {
    const keys = new AbortController();
    const done = (choice: PreFightChoice) => {
      keys.abort();
      for (const r of added) {
        const i = rigs.indexOf(r);
        if (i >= 0) rigs.splice(i, 1);
      }
      root.destroy({ children: true });
      resolve(choice);
    };
    root.addChild(
      button('Fight', W / 2 - 150, buttonsY, true, () => done('fight')),
      button('Retreat', W / 2 + 150, buttonsY, false, () => done('retreat')),
    );
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') done('fight');
      else if (e.key === 'Escape') done('retreat');
    }, { signal: keys.signal });
  });
}

async function portrait(root: Container, add: SceneContext['add'], f: PreFightFighter, x: number, facing: 1 | -1) {
  const frame = new Graphics()
    .roundRect(x - 10, TOP - 10, PORTRAIT_W + 20, PORTRAIT_H + 20, 18)
    .fill({ color: 0x332124, alpha: 0.94 })
    .stroke({ color: 0x815a46, width: 3 })
    .roundRect(x, TOP, PORTRAIT_W, PORTRAIT_H, 12)
    .fill(0x4b3a44);
  root.addChild(frame);

  const wu = PORTRAIT_W / PORTRAIT_SCALE;
  const hu = PORTRAIT_H / PORTRAIT_SCALE;
  // a mirrored sprite grows to the left of its position, so the enemy is anchored at the frame's right edge
  const rig: PaperRig = await add(f.look, facing === 1 ? x : x + PORTRAIT_W, TOP, PORTRAIT_SCALE, facing, root, 0, true);
  rig.crop(0.3 - wu / 2, PORTRAIT_TOP - hu, 0.3 + wu / 2, PORTRAIT_TOP);

  const cx = x + PORTRAIT_W / 2;
  const plateY = TOP + PORTRAIT_H + 26;
  root.addChild(
    new Graphics()
      .roundRect(x + 10, plateY, PORTRAIT_W - 20, 96, 8)
      .fill(0x694630)
      .stroke({ color: 0xb58758, width: 3 }),
    fitted(f.name, cx, plateY + 32, PORTRAIT_W - 60, { fontSize: 38, fontWeight: 'bold', fill: '#fff0cb' }),
    fitted(`Level ${f.level}`, cx, plateY + 72, PORTRAIT_W - 60, { fontSize: 24, fill: '#f4d3a7' }),
  );
}

function title(s: string, x: number, y: number) {
  const t = new Text({ text: s.toUpperCase(), style: { fontFamily: 'Georgia', fontSize: 52, fill: '#e8be4c', letterSpacing: 6 } });
  t.anchor.set(0.5);
  t.position.set(x, y);
  return t;
}

function fitted(s: string, x: number, y: number, maxWidth: number, style: { fontSize: number; fill: string; fontWeight?: 'bold' }) {
  const t = new Text({ text: s, style: { fontFamily: 'Georgia', ...style } });
  t.anchor.set(0.5);
  if (t.width > maxWidth) t.scale.x = maxWidth / t.width;
  t.position.set(x, y);
  return t;
}

function button(label: string, x: number, y: number, primary: boolean, onPress: () => void) {
  const w = 250, h = 76;
  const b = new Container();
  const face = new Graphics()
    .roundRect(-w / 2, 0, w, h, 12)
    .fill(primary ? 0x9a6a2e : 0x5a3c34)
    .stroke({ color: primary ? 0xf2c14e : 0xb58758, width: 3 });
  const t = new Text({ text: label, style: { fontFamily: 'Georgia', fontSize: 34, fontWeight: 'bold', fill: '#fff0cb' } });
  t.anchor.set(0.5);
  t.position.set(0, h / 2);
  b.addChild(face, t);
  b.position.set(x, y);
  b.eventMode = 'static';
  b.cursor = 'pointer';
  b.accessibleTitle = label;
  b.on('pointerover', () => { face.tint = 0xffe6c0; });
  b.on('pointerout', () => { face.tint = 0xffffff; });
  b.on('pointertap', onPress);
  return b;
}

const ENEMY_NAMES = ['Crixus Fold', 'Varro the Creased', 'Spiculus', 'Flamma Pulp', 'Tetraites', 'Priscus Vellum'];

/** Placeholder opponent until the enemy generator (#41): gear tier sets the level, a few extra attribute points. */
function randomEnemy(tier: number): PreFightFighter {
  const look = randomLook(tier);
  const level = Math.max(1, tier * 3 - 2 + Math.floor(Math.random() * 3));
  const bump = () => 5 + Math.floor(Math.random() * (2 + tier));
  const attributes: Attributes = {
    might: bump(), agility: bump(), precision: bump(), guard: bump(),
    vitality: bump(), stamina: bump(), charm: bump(), arcana: 5,
  };
  return preFightFighter(ENEMY_NAMES[Math.floor(Math.random() * ENEMY_NAMES.length)], level, look, attributes);
}

/**
 * `?view=prefight[&tier=N]`: player (default attributes) against a random opponent.
 * Fight → arena with the same two gladiators; Retreat → a new opponent.
 */
export async function showPreFight(context: SceneContext): Promise<SceneUpdate> {
  const tp = context.params.get('tier');
  const tier = tp ? Math.min(10, Math.max(1, +tp)) : 1 + Math.floor(Math.random() * 10);
  const player = preFightFighter('Player', 1, randomLook(tier));
  context.ui.innerHTML = '<a href="?">arena</a> · <a href="?view=wardrobe">garderoba</a>';

  let update: SceneUpdate | undefined;
  void (async () => {
    let choice: PreFightChoice;
    let enemy: PreFightFighter;
    do {
      enemy = randomEnemy(tier);
      choice = await openPreFight(context, player, enemy);
    } while (choice === 'retreat');
    context.ui.innerHTML = '';
    update = (await showArena(context, [
      { look: player.look, name: player.name },
      { look: enemy.look, name: enemy.name },
    ])) ?? undefined;
  })();
  return (dt) => update?.(dt);
}
