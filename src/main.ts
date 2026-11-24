import { Application, Assets, Container } from 'pixi.js';
import { Kit, patchShadowBlend } from './rig/PaperRig';
import { showArena } from './scenes/arena';
import { H, W, createRigCollection, startRigTicker } from './scenes/common';
import type { Scene, SceneContext } from './scenes/common';
import { showAnimLab } from './scenes/dev/animLab';
import { showFaces } from './scenes/dev/faces';
import { showLineup } from './scenes/dev/lineup';
import { showStrip } from './scenes/dev/strip';
import { showPreFight } from './scenes/preFight';
import { showWardrobe } from './scenes/wardrobe';

const scenes = new Map<string, Scene>([
  ['arena', showArena],
  ['prefight', showPreFight],
  ['wardrobe', showWardrobe],
  ['lineup', showLineup],
  ['faces', showFaces],
  ['anim', showAnimLab],
  ['strip', showStrip],
]);

async function main() {
  const app = new Application();
  await app.init({ width: W, height: H, background: '#2e1b20', antialias: true, preference: 'webgl', resolution: Math.min(2, window.devicePixelRatio || 1), autoDensity: true });
  document.getElementById('stage')!.appendChild(app.canvas);
  patchShadowBlend(app.renderer);

  const world = new Container();
  app.stage.addChild(world);
  const fit = () => {
    const s = Math.min(window.innerWidth / W, window.innerHeight / H);
    app.renderer.resize(window.innerWidth, window.innerHeight);
    world.scale.set(s);
    world.position.set((window.innerWidth - W * s) / 2, (window.innerHeight - H * s) / 2);
  };
  window.addEventListener('resize', fit);
  fit();

  const params = new URLSearchParams(location.search);
  const kit = await Kit.load('/chars/kit');
  const context: SceneContext = {
    app, world, params, kit,
    ui: document.getElementById('ui')!,
    ...createRigCollection(kit),
    bgTex: await Assets.load('/bg/arena.png'),
  };
  const update = await scenes.get(params.get('view') ?? 'arena')?.(context);
  startRigTicker(context, update ?? undefined);

  (window as unknown as { __game: unknown }).__game = { app, kit, rigs: context.rigs };

  const shot = params.get('shot');
  if (shot) {
    let n = 0;
    const grab = () => { if (++n >= 45) { app.ticker.remove(grab); save().catch((e) => console.error('shot failed', e)); } };
    const save = async () => {
      const s = { sx: world.scale.x, x: world.position.x, y: world.position.y };
      world.scale.set(1); world.position.set(0, 0);
      const c = app.renderer.extract.canvas({ target: world, resolution: 1 }) as HTMLCanvasElement;
      world.scale.set(s.sx); world.position.set(s.x, s.y);
      const blob: Blob = await new Promise((r) => c.toBlob((b) => r(b!), 'image/png'));
      await fetch(`/__shot?name=${encodeURIComponent(shot)}`, { method: 'POST', body: blob });
      document.title = 'SHOT_DONE';
      console.log('SHOT_DONE', shot);
    };
    app.ticker.add(grab);
  }
}

main();
