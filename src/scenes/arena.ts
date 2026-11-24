import { Container, Sprite } from 'pixi.js';
import { ARENA_LENGTH, createCombat, getActionOptions, performAction } from '../core/combat';
import type { CombatAction } from '../core/types';
import type { Look } from '../rig/PaperRig';
import { CombatHud } from '../ui/hud';
import { RadialMenu } from '../ui/radialMenu';
import { FEET_Y, H, PELVIS_ABOVE_FEET, UNIT, W, groundShadowTexture, randomLook } from './common';
import type { SceneContext } from './common';

export interface ArenaFighter {
  readonly look: Look;
  readonly name: string;
}

const CONTACT = 5;

const ACTION_CLIPS: Record<CombatAction, string> = {
  step_forward: 'walk_fwd',
  step_back: 'walk_back',
  jump: 'jump',
  charge: 'charge',
  quick: 'attack_quick',
  normal: 'attack_normal',
  power: 'attack_power',
  block: 'block',
  rest: 'rest',
  taunt: 'taunt',
};

/** Pre-fight can pass the two gladiators it displayed. Direct visits use random looks. */
export async function showArena({ world, bgTex, params, ui, add, rigs }: SceneContext, fighters?: readonly [ArenaFighter, ArenaFighter]) {
  const arena = new Container();
  world.addChild(arena);
  arena.addChild(new Sprite(bgTex));
  const gsh = groundShadowTexture();
  const tp = params.get('tier');
  const looks = fighters?.map((f) => f.look) ?? [randomLook(tp ? +tp : undefined), randomLook(tp ? +tp : undefined)];
  const firstRig = rigs.length;
  const shadows: Sprite[] = [];
  for (const [i, x] of [[0, 640], [1, 1290]] as const) {
    const g = new Sprite(gsh);
    g.anchor.set(0.5); g.blendMode = 'multiply'; g.tint = 0x8a5a48;
    g.width = 5.2 * UNIT; g.height = 1.3 * UNIT;
    g.position.set(x + 0.35 * UNIT * (i ? -1 : 1), FEET_Y);
    arena.addChild(g);
    shadows.push(g);
    await add(looks[i], x, FEET_Y - PELVIS_ABOVE_FEET * UNIT, UNIT, i ? -1 : 1, arena, i * 0.7);
  }

  const player = rigs[firstRig].anim!;
  const enemy = rigs[firstRig + 1].anim!;
  const preview = () => {
    const gap = (enemy.home.x - player.home.x) / UNIT - CONTACT;
    return createCombat(0, {
      name: fighters?.[0].name, equipment: looks[0],
      position: Math.max(0, Math.min(ARENA_LENGTH, ARENA_LENGTH - gap)),
    }, { name: fighters?.[1].name, equipment: looks[1], position: ARENA_LENGTH });
  };
  const hud = new CombatHud(preview(), W, H);
  arena.addChild(hud);

  // Preview movement with the same rules as the menu. The turn loop will present the full action result.
  const menu = new RadialMenu((action) => {
    const result = performAction(preview(), action);
    if (!result.ok) {
      openMenu();
      return;
    }
    const movement = result.events.find((event) => event.type === 'move' && event.fighter === 'player');
    const motion = movement?.type === 'move' ? { commit: true, distance: movement.to - movement.from } : {};
    player.play(ACTION_CLIPS[action], { ...motion, onEnd: openMenu });
  });

  function openMenu() {
    menu.open(getActionOptions(preview()));
  }

  const updateMenuPosition = () => {
    const { x, y } = player.rig.view.getGlobalPosition();
    menu.setAnchor(x, y, world.scale.x);
  };
  arena.on('destroyed', () => menu.destroy());
  updateMenuPosition();
  openMenu();

  ui.innerHTML = '<a href="?view=wardrobe">garderoba</a> · <a href="?view=lineup">10 zestawów</a> · <a href="?view=faces">twarze</a> · <a href="?view=arena">losuj</a>';
  return (dt: number) => {
    const p = player.rig.view.position;
    const lift = Math.max(0, (player.home.y - p.y) / UNIT);
    shadows[0].position.x = p.x + 0.35 * UNIT;
    shadows[0].alpha = Math.max(0.25, 1 - lift * 0.18);
    shadows[0].width = 5.2 * UNIT * Math.max(0.6, 1 - lift * 0.08);
    updateMenuPosition();
    hud.update(dt);
  };
}
