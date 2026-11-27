import { Sprite, Text } from 'pixi.js';
import { BUILDS, DEFAULT_BUILD } from '../rig/builds';
import { saveGame } from '../core/save';
import { deriveStats } from '../core/stats';
import { DEFAULT_LOOK } from '../rig/PaperRig';
import { statureFor } from '../rig/stature';
import type { Look } from '../rig/PaperRig';
import '../ui/creator.css';
import {
  ATTRIBUTE_BASE, ATTRIBUTE_INFO, NAME_MAX, canLower, canRaise, lower, nameProblem, newCharacter, raise, randomSpread, startSpread,
} from '../ui/creatorRules';
import type { Appearance, AttributeKey, PointSpread } from '../ui/creatorRules';
import { goToTitle, onEscape } from '../ui/backKey';
import { inkName } from '../ui/inkName';
import { PELVIS_ABOVE_FEET } from './common';
import type { SceneContext } from './common';
import { loadSavedGladiator } from './savedGladiator';

const APPEARANCE_KEYS = ['skin', 'face', 'hair', 'hairColor', 'beard', 'build'] as const;
/** how many choices each appearance row cycles through (#27: three builds) */
const CHOICES: Partial<Record<(typeof APPEARANCE_KEYS)[number], number>> = { build: BUILDS.length };
const SCALE = 58;

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const rnd = (n: number) => Math.floor(Math.random() * n);

/**
 * `?view=creator`: name, appearance and the starting attribute points of a new gladiator.
 * Begin saves it (IndexedDB, #10) and opens the first bout; it replaces an existing save.
 */
export async function showCreator({ world, bgTex, kit, ui, add }: SceneContext) {
  const J = kit.json;
  const bg = new Sprite(bgTex);
  bg.tint = 0x8a7a70;
  world.addChild(bg);
  const heading = new Text({
    text: 'A NEW GLADIATOR',
    style: { fontFamily: 'Georgia', fontSize: 52, fill: '#e8be4c', letterSpacing: 6 },
  });
  heading.anchor.set(0.5);
  heading.position.set(640, 70);
  world.addChild(heading);

  const appearance: Required<Appearance> = { skin: DEFAULT_LOOK.skin, face: DEFAULT_LOOK.face, hair: DEFAULT_LOOK.hair, hairColor: DEFAULT_LOOK.hairColor, beard: DEFAULT_LOOK.beard, build: DEFAULT_BUILD };
  const look = (): Look => ({ ...DEFAULT_LOOK, ...appearance });
  const rig = await add(look(), 640, 1040 - PELVIS_ABOVE_FEET * SCALE, SCALE, 1, world, 0);

  let spread: PointSpread = startSpread();
  let name = '';
  let touchedName = false;
  const replacing = await loadSavedGladiator();

  const looks: { key: (typeof APPEARANCE_KEYS)[number]; title: string; name: (v: number) => string }[] = [
    { key: 'skin', title: 'Skin', name: (v) => J.skins[v].name },
    { key: 'face', title: 'Face', name: (v) => J.faces[v].name },
    { key: 'hair', title: 'Hair', name: (v) => J.hairs[v] },
    { key: 'hairColor', title: 'Hair colour', name: (v) => J.hair_colors[v].name },
    { key: 'beard', title: 'Facial hair', name: (v) => J.beards[v] },
    { key: 'build', title: 'Build', name: (v) => BUILDS[v].name },
  ];

  ui.className = 'creator';
  ui.innerHTML = `
    <h3>Gladiator</h3>
    <div class="section">Name</div>
    <input id="cName" aria-label="Gladiator name" placeholder="Write a name in ink…" autocomplete="off" spellcheck="false">
    <div class="problem" id="cProblem"></div>
    <div class="section">Appearance</div>
    ${looks.map((r) => `<div class="look-row"><span>${r.title}</span><button data-look="${r.key}" data-d="-1" aria-label="previous ${r.title}">◀</button><span class="v" id="look_${r.key}"></span><button data-look="${r.key}" data-d="1" aria-label="next ${r.title}">▶</button></div>`).join('')}
    <div class="section points"><span>Attributes</span><span>points left <b id="cFree"></b></span></div>
    ${ATTRIBUTE_INFO.map((a) => `<div class="attr-row" title="${a.hint}"><span>${a.label}</span><button data-attr="${a.key}" data-d="-1" aria-label="lower ${a.label}">−</button><span class="v" id="attr_${a.key}"></span><button data-attr="${a.key}" data-d="1" aria-label="raise ${a.label}">+</button><span class="hint">${a.hint}</span></div>`).join('')}
    <div class="derived" id="cDerived"></div>
    ${replacing ? `<div class="warn">Begin replaces your saved gladiator ${escape(replacing.name)} (level ${replacing.level}).</div>` : ''}
    <div class="actions"><button id="cRandom">Random</button><button id="cReset">Reset points</button><button class="begin" id="cBegin">Begin</button></div>
    <div class="small"><a href="?view=title">back to title</a> <span class="key">(Esc)</span></div>`;

  const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  const nameInput = $<HTMLInputElement>('cName');
  const begin = $<HTMLButtonElement>('cBegin');
  inkName(nameInput, NAME_MAX);

  const refresh = () => {
    for (const r of looks) $(`look_${r.key}`).textContent = r.name(appearance[r.key]);
    for (const { key } of ATTRIBUTE_INFO) {
      const v = $(`attr_${key}`);
      v.textContent = String(spread.attributes[key]);
      v.classList.toggle('up', spread.attributes[key] > ATTRIBUTE_BASE);
      (ui.querySelector(`[data-attr="${key}"][data-d="-1"]`) as HTMLButtonElement).disabled = !canLower(spread, key);
      (ui.querySelector(`[data-attr="${key}"][data-d="1"]`) as HTMLButtonElement).disabled = !canRaise(spread, key);
    }
    const free = $('cFree');
    free.textContent = String(spread.free);
    free.classList.toggle('done', spread.free === 0);
    rig.setStature(statureFor(spread.attributes.might));
    const stats = deriveStats(spread.attributes);
    $('cDerived').innerHTML = `Health <b>${stats.maxHealth}</b> · Energy <b>${stats.maxEnergy}</b>`;
    const problem = nameProblem(name);
    $('cProblem').textContent = touchedName && problem ? problem
      : spread.free > 0 && !problem ? `Spend ${spread.free} more point${spread.free === 1 ? '' : 's'}.` : '';
    begin.disabled = problem !== null || spread.free !== 0;
  };
  const showLook = () => { void rig.setLook(look()); };

  nameInput.addEventListener('input', () => { name = nameInput.value; touchedName = true; refresh(); });
  ui.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest('button');
    if (!b || b.disabled) return;
    if (b.dataset.look) {
      const key = b.dataset.look as (typeof APPEARANCE_KEYS)[number];
      const n = CHOICES[key] ?? 10;
      appearance[key] = (appearance[key] + +b.dataset.d! + n) % n;
      showLook();
    } else if (b.dataset.attr) {
      const key = b.dataset.attr as AttributeKey;
      spread = +b.dataset.d! > 0 ? raise(spread, key) : lower(spread, key);
    } else if (b.id === 'cRandom') {
      for (const k of APPEARANCE_KEYS) appearance[k] = rnd(CHOICES[k] ?? 10);
      spread = randomSpread();
      showLook();
    } else if (b.id === 'cReset') {
      spread = startSpread();
    } else if (b.id === 'cBegin') {
      void start();
      return;
    }
    refresh();
  });

  const start = async () => {
    begin.disabled = true;
    try {
      await saveGame(newCharacter(name, appearance, spread));
      location.search = '?view=prefight';
    } catch (err) {
      console.error('saving the new gladiator failed', err);
      $('cProblem').textContent = 'Could not save the gladiator. Try again.';
      begin.disabled = false;
    }
  };

  refresh();
  nameInput.focus();
  onEscape(goToTitle);
}
