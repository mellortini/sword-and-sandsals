import { Container, Graphics } from 'pixi.js';
import { FPS } from '../../anim/Animator';
import { sample } from '../../anim/clip';
import { PaperRig } from '../../rig/PaperRig';
import type { Look } from '../../rig/PaperRig';
import { H, PELVIS_ABOVE_FEET, W, label, randomLook } from '../common';
import type { SceneContext } from '../common';

const c0 = (n: string) => n.split('@')[0];

export async function showStrip({ world, kit, clips, params, add, rigs }: SceneContext) {
  const name = params.get('clip') ?? 'attack_normal';
  const weapon = params.get('weapon');   // e.g. &weapon=sword7 (#184); the clip's variant for that weapon family when it has one (#36)
  const variant = `${c0(name)}@${(weapon ?? '').replace(/\d+$/, '')}`;
  const c = clips[variant] ?? clips[name];
  const every = +(params.get('every') ?? 1);
  const frames: number[] = [];
  for (let f = 0; f <= c.length; f += every) frames.push(f);
  const cols = Math.min(9, frames.length), rows = Math.ceil(frames.length / cols);
  const cw = W / cols, ch = (H - 50) / rows;
  const S = Math.min(cw / 10, ch / 14.5);
  const bgs = new Container();
  world.addChild(bgs);
  world.addChild(label(`${c.name}: ${c.length} frames @ ${FPS} fps` + (every > 1 ? ` (every ${every})` : ''), W / 2, 8, 26));
  const tier = +(params.get('tier') ?? 6);
  const look: Look = { ...randomLook(tier), helmet: tier, armor: tier, shoulders: tier, greaves: tier, boots: tier, ...(weapon ? { weapon } : {}) };
  const probe = new PaperRig(kit, { scale: S, facing: 1 });
  const baseLow = probe.soleLow(kit.json.pose_test);
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i];
    const col = i % cols, row = Math.floor(i / cols);
    const x0 = col * cw, y0 = 50 + row * ch;
    bgs.addChild(new Graphics().rect(x0 + 3, y0 + 3, cw - 6, ch - 6).fill(0x3b4558));
    const s = sample(c, f);
    const rig = await add(look, 0, 0, S, 1, world, 0, true);
    rigs[rigs.length - 1].fixed = s.pose;
    const lift = s.air ? s.y : s.y + baseLow - probe.soleLow(s.pose);
    rig.view.position.set(x0 + cw * 0.36 + s.x * S * 0.4, y0 + ch - 10 - PELVIS_ABOVE_FEET * S - lift * S);
    const ev = (c.events ?? []).filter((e) => e.f === f).map((e) => ' ' + e.type).join('');
    world.addChild(label(`${f}${ev}`, x0 + 30, y0 + 6, 16, ev ? '#e8be4c' : '#cdb99a'));
  }
}
