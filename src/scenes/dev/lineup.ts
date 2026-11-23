import { item } from '../../data/equipment';
import { DEFAULT_LOOK, EQUIP_SLOTS } from '../../rig/PaperRig';
import type { Look } from '../../rig/PaperRig';
import { PELVIS_ABOVE_FEET, W, label } from '../common';
import type { SceneContext } from '../common';

export async function showLineup({ world, kit, add }: SceneContext) {
  const J = kit.json;
  world.addChild(label('Armour sets: tier 1 → 10', W / 2, 18, 34));
  for (let t = 1; t <= 10; t++) {
    const col = (t - 1) % 5, row = Math.floor((t - 1) / 5);
    const x = 230 + col * 365, feet = 500 + row * 520;
    const look: Look = { ...DEFAULT_LOOK, skin: (t * 3) % 10, face: t - 1, hair: (t + 2) % 10, hairColor: (t * 7) % 10, beard: (t * 3) % 10 };
    for (const s of EQUIP_SLOTS) look[s] = t;
    await add(look, x, feet - PELVIS_ABOVE_FEET * 32, 32, 1, world, t * 0.3, true);
    const sum = EQUIP_SLOTS.reduce((a, s) => a + (item(s, t)?.armor ?? 0), 0);
    const price = EQUIP_SLOTS.reduce((a, s) => a + (item(s, t)?.price ?? 0), 0);
    world.addChild(label(`${t}. ${J.sets[t - 1]}`, x + 40, feet + 2, 24));
    world.addChild(label(`armour ${sum} · ${price.toLocaleString('en')} g`, x + 40, feet + 32, 18, '#cdb99a'));
  }
}
