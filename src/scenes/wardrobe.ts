import { Sprite } from 'pixi.js';
import { ITEMS, SET_BONUS, item } from '../data/equipment';
import { DEFAULT_LOOK, EQUIP_SLOTS } from '../rig/PaperRig';
import type { Look } from '../rig/PaperRig';
import { PELVIS_ABOVE_FEET, randomLook } from './common';
import type { SceneContext } from './common';
import { goToTitle, onEscape } from '../ui/backKey';
import { WEAPON_FAMILIES, WEAPON_TIERS, familyName, shownWeapon, tierForSet, weaponName } from '../ui/weaponLooks';
import { weapon } from '../data/weapons';

export async function showWardrobe({ world, bgTex, kit, ui, add }: SceneContext) {
  const J = kit.json;
  const bg = new Sprite(bgTex);
  bg.tint = 0x8a7a70;
  world.addChild(bg);
  const BIG = 58;
  const look: Look = { ...DEFAULT_LOOK };
  const rig = await add({ ...look }, 700, 1040 - PELVIS_ABOVE_FEET * BIG, BIG, 1, world, 0);
  ui.classList.add('wardrobe');
  const rows: { key: string; title: string; count: number; name: (v: number) => string }[] = [
    { key: 'skin', title: 'Skin', count: 10, name: (v) => J.skins[v].name },
    { key: 'face', title: 'Face', count: 10, name: (v) => J.faces[v].name },
    { key: 'hair', title: 'Hair', count: 10, name: (v) => J.hairs[v] },
    { key: 'hairColor', title: 'Hair colour', count: 10, name: (v) => J.hair_colors[v].name },
    { key: 'beard', title: 'Facial hair', count: 10, name: (v) => J.beards[v] },
    { key: 'set', title: 'Full set', count: 11, name: (v) => (v ? `${v}. ${J.sets[v - 1]}` : 'none') },
    ...EQUIP_SLOTS.map((s) => ({ key: s as string, title: s[0].toUpperCase() + s.slice(1), count: 11, name: (v: number) => (v ? item(s, v)!.name : '—') })),
    // #182, #185: weapon family and tier (0 = the gladius); the art comes with #184 / #36, until then the gladius stands in
    { key: 'family', title: 'Weapon', count: WEAPON_FAMILIES.length, name: (v: number) => familyName(WEAPON_FAMILIES[v]) },
    { key: 'tier', title: 'Weapon tier', count: WEAPON_TIERS + 1,
      name: (v: number) => weaponName(choice(v)) },
  ];
  const vals: Record<string, number> = { ...(look as unknown as Record<string, number>), set: 0, family: 0, tier: 0 };
  const choice = (tier = vals.tier) => ({ family: WEAPON_FAMILIES[vals.family], tier });
  const showWeapon = () => { look.weapon = shownWeapon(choice(), (k) => kit.has(k)).weapon; };
  const html = rows.map((r) => `<div class="row"><span class="t">${r.title}</span><button data-k="${r.key}" data-d="-1">◀</button><span class="v" id="v_${r.key}"></span><button data-k="${r.key}" data-d="1">▶</button></div>`).join('');
  ui.innerHTML = `<h3>Gladiator</h3>${html}<div class="row"><button id="rand">Random</button></div><div id="stats"></div><div class="row small"><a href="?view=title">back to title</a> (Esc) · <a href="?view=arena">arena</a> · <a href="?view=lineup">10 sets</a> · <a href="?view=faces">faces</a></div>`;
  onEscape(goToTitle);
  const refresh = async () => {
    for (const r of rows) document.getElementById(`v_${r.key}`)!.textContent = r.name(vals[r.key]);
    const its = EQUIP_SLOTS.map((s) => item(s, look[s])).filter(Boolean) as (typeof ITEMS)[number][];
    const full = its.length === 5 && its.every((i) => i.tier === its[0].tier);
    const armor = Math.round(its.reduce((a, i) => a + i.armor, 0) * (full ? 1.1 : 1));
    document.getElementById('stats')!.innerHTML =
      `<div>Armour <b>${armor}</b> · Weight <b>${its.reduce((a, i) => a + i.weight, 0).toFixed(1)}</b> · Value <b>${its.reduce((a, i) => a + i.price, 0).toLocaleString('en')} g</b></div>` +
      its.map((i) => `<div class="it">${i.name} <i>(+${i.armor}, ${i.price.toLocaleString('en')} g, lvl ${i.minLevel})</i></div>`).join('') +
      (vals.tier ? weaponLine(WEAPON_FAMILIES[vals.family], vals.tier, shownWeapon(choice(), (k) => kit.has(k)).missing) : '') +
      (full ? `<div class="it gold">${SET_BONUS}${its[0].bonus ? ' · ' + its[0].bonus : ''}</div>` : '');
    await rig.setLook(look);
  };
  ui.addEventListener('click', (e) => {
    const b = e.target as HTMLElement;
    if (b.id === 'rand') {
      Object.assign(look, randomLook());
      Object.assign(vals, look, { set: 0, family: 0, tier: 0 });
      void refresh();
      return;
    }
    const k = b.dataset.k;
    if (!k) return;
    const r = rows.find((x) => x.key === k)!;
    vals[k] = (vals[k] + +b.dataset.d! + r.count) % r.count;
    if (k === 'set') {
      for (const s of EQUIP_SLOTS) { look[s] = vals.set; vals[s] = vals.set; }
      // a full set brings the weapon of its tier, in the chosen family (#182, #185)
      vals.tier = tierForSet(vals.set);
      showWeapon();
    } else if (k === 'family' || k === 'tier') showWeapon();
    else (look as unknown as Record<string, number>)[k] = vals[k];
    void refresh();
  });
  await refresh();
}

/** The chosen weapon's catalogue line in the stats under the rows. */
function weaponLine(family: (typeof WEAPON_FAMILIES)[number], tier: number, missingArt: boolean) {
  const w = weapon(family, tier);
  if (w && missingArt) return `<div class="it">${w.name} <i>(damage ${w.damage}, ${w.price.toLocaleString('en')} g) — art soon, the gladius stands in</i></div>`;
  return w ? `<div class="it">${w.name} <i>(damage ${w.damage}, ${w.price.toLocaleString('en')} g)</i></div>` : '';
}
