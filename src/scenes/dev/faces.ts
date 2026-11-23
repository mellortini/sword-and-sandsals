import { Graphics } from 'pixi.js';
import { DEFAULT_LOOK } from '../../rig/PaperRig';
import type { Look } from '../../rig/PaperRig';
import { label } from '../common';
import type { SceneContext } from '../common';

export async function showFaces({ world, kit, add }: SceneContext) {
  const J = kit.json;
  const rows: [string, (i: number) => Partial<Look>][] = [
    ['Faces', (i) => ({ face: i, skin: 3, hair: 1, hairColor: 1, beard: 0 })],
    ['Hair', (i) => ({ face: 0, skin: 3, hair: i, hairColor: i === 0 ? 1 : i, beard: 0 })],
    ['Facial hair', (i) => ({ face: 0, skin: 3, hair: 1, hairColor: 1, beard: i })],
    ['Skin', (i) => ({ face: i, skin: i, hair: (i + 1) % 10, hairColor: (i * 3) % 10, beard: (i * 7) % 10 })],
  ];
  const S = 46, cw = 186, ch = 268;
  for (let r = 0; r < rows.length; r++) {
    world.addChild(label(rows[r][0], 960, r * ch + 2, 20, '#cdb99a'));
    for (let i = 0; i < 10; i++) {
      const cx = 30 + i * cw + cw / 2, top = r * ch + 28;
      const bg = new Graphics().roundRect(cx - cw / 2 + 4, top, cw - 8, ch - 34, 10).fill(0x3b4558);
      world.addChild(bg);
      const look = { ...DEFAULT_LOOK, ...rows[r][1](i) } as Look;
      // portrait = window of the puppet texture around the head (units relative to the pelvis)
      const wu = (cw - 8) / S, hu = (ch - 34) / S;
      const rig = await add(look, cx - cw / 2 + 4, top, S, 1, world, i * 0.2, true);
      rig.crop(0.3 - wu / 2, 7.3 - hu, 0.3 + wu / 2, 7.3);
      const nm = r === 0 ? J.faces[i].name : r === 1 ? J.hairs[i] : r === 2 ? J.beards[i] : J.skins[i].name;
      const tl = label(nm, cx, top + ch - 62, 17);
      world.addChild(tl);
    }
  }
}
