import { Text, Texture } from 'pixi.js';
import type { Application, Container } from 'pixi.js';
import { Animator } from '../anim/Animator';
import { bakeAll } from '../anim/clips';
import { DEFAULT_LOOK, EQUIP_SLOTS, PaperRig } from '../rig/PaperRig';
import type { Kit, Look, Pose } from '../rig/PaperRig';
// every scene applies the player's text size (#77)
import '../ui/textSize';

export const W = 1920, H = 1080;
export const UNIT = 38;
export const FEET_Y = 890;
export const PELVIS_ABOVE_FEET = 5.2;

interface SceneRig {
  rig: PaperRig;
  phase: number;
  still?: boolean;
  anim?: Animator;
  fixed?: Pose;
}

export function createRigCollection(kit: Kit) {
  const clips = bakeAll(kit.json.pose_test);
  const rigs: SceneRig[] = [];

  const add = async (look: Look, x: number, y: number, scale: number, facing: 1 | -1, parent: Container, phase = Math.random() * 2, still = false) => {
    const rig = new PaperRig(kit, { scale, facing });
    await rig.setLook(look);
    rig.view.position.set(x, y);
    parent.addChild(rig.view);
    let anim: Animator | undefined;
    if (!still) {
      anim = new Animator(rig, clips, scale);
      anim.home = { x, y };
      anim.play('idle', { blend: 0 });
      anim.update(phase);
    }
    rigs.push({ rig, phase, still, anim });
    return rig;
  };

  return { clips, rigs, add };
}

export type SceneContext = ReturnType<typeof createRigCollection> & {
  app: Application;
  world: Container;
  params: URLSearchParams;
  ui: HTMLElement;
  kit: Kit;
  bgTex: Texture;
};

export type SceneUpdate = (dt: number) => void;
export type Scene = (context: SceneContext) => Promise<void | SceneUpdate>;

export function startRigTicker({ app, kit, rigs }: SceneContext, updateScene?: SceneUpdate) {
  const stance = kit.json.pose_test;
  app.canvas.addEventListener('webglcontextrestored', () => {
    for (const { rig } of rigs) rig.invalidateStillFrame();
  });
  let t = 0;
  app.ticker.add((tk) => {
    const dt = Math.min(0.1, tk.deltaMS / 1000);
    t += dt;
    for (const r of rigs) {
      if (r.still && !r.anim) {
        r.rig.renderStill(app.renderer, r.fixed ?? stance);
        continue;
      }
      if (r.anim) r.anim.update(dt);
      else r.rig.pose = r.fixed ?? idle(stance, t, r.phase);
      r.rig.render(app.renderer);
    }
    updateScene?.(dt);
  });
}

export function groundShadowTexture(): Texture {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(128, 32, 4, 128, 32, 124);
  grd.addColorStop(0, 'rgba(255,255,255,0.75)');
  grd.addColorStop(0.55, 'rgba(255,255,255,0.35)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.setTransform(1, 0, 0, 0.25, 0, 24);
  g.fillStyle = grd;
  g.fillRect(0, -100, 256, 300);
  return Texture.from(c);
}

function idle(base: Pose, t: number, phase = 0): Pose {
  const s = Math.sin((t + phase) * Math.PI);
  const s2 = Math.sin((t + phase) * Math.PI + 0.9);
  return {
    ...base,
    torso: (base.torso ?? 0) + 1.4 * s, head: (base.head ?? 0) - 1.0 * s2,
    arm_f_up: (base.arm_f_up ?? 0) + 2.0 * s2, arm_f_lo: (base.arm_f_lo ?? 0) + 1.5 * s, weapon: (base.weapon ?? 0) - 2.5 * s2,
    arm_b_up: (base.arm_b_up ?? 0) - 1.6 * s, arm_b_lo: (base.arm_b_lo ?? 0) + 2.0 * s2,
  };
}

const rnd = (n: number) => Math.floor(Math.random() * n);

export function randomLook(tier?: number): Look {
  const t = tier ?? 1 + rnd(10);
  const L: Look = { ...DEFAULT_LOOK, skin: rnd(10), face: rnd(10), hair: rnd(10), hairColor: rnd(10), beard: rnd(10) };
  for (const s of EQUIP_SLOTS) L[s] = Math.random() < 0.85 ? t : 0;
  return L;
}

export function label(s: string, x: number, y: number, size = 28, color = '#f3e6d6') {
  const t = new Text({ text: s, style: { fill: color, fontSize: size, fontFamily: 'Georgia', align: 'center' } });
  t.anchor.set(0.5, 0);
  t.position.set(x, y);
  return t;
}
