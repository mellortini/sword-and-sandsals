import { ColorMatrixFilter, Container, Graphics, Sprite, Text } from 'pixi.js';
import type { Texture } from 'pixi.js';
import { saveGame } from '../core/save';
import type { SavedCharacter } from '../core/save';
import { lookPreview } from '../ui/lookPreview';
import { BUILDINGS, visitBuilding } from '../ui/town';
import { townNote } from '../ui/townRules';
import { DEFAULT_LOOK } from '../rig/PaperRig';
import { drawableLook, groundShadowTexture } from './common';
import type { SceneContext } from './common';
import { loadSavedGladiator } from './savedGladiator';
import { TownBackdrop } from './townBackdrop';

/** where the gladiator stands: on the road below the arena steps, small enough to fit the forum */
const PLAYER = { x: 960, feet: 1000, scale: 21 };
const PELVIS_ABOVE_FEET = 5.2;

/**
 * An alpha hit test for a building layer: the rectangles in town.json overlap a lot (the tholos stands in front of the
 * arch), so the pointer belongs to the topmost building whose paper is really under it.
 */
function alphaHitArea(tex: Texture) {
  const w = Math.round(tex.frame.width), h = Math.round(tex.frame.height);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.drawImage(tex.source.resource as CanvasImageSource, -tex.frame.x, -tex.frame.y);
  const alpha = g.getImageData(0, 0, w, h).data;
  return { contains: (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && alpha[(Math.floor(y) * w + Math.floor(x)) * 4 + 3] > 100 };
}

/** paper tag with the building's name, what it is for and the gladiator's state there */
class PlaceTag extends Container {
  private readonly paper = new Graphics();
  private readonly title = new Text({ text: '', style: { fontFamily: 'Georgia', fontSize: 34, fontWeight: 'bold', fill: '#3a2320' } });
  private readonly purpose = new Text({ text: '', style: { fontFamily: 'Georgia', fontSize: 22, fontStyle: 'italic', fill: '#5c3a24' } });
  private readonly note = new Text({ text: '', style: { fontFamily: 'Georgia', fontSize: 22, fill: '#8b3324' } });

  constructor() {
    super();
    this.addChild(this.paper, this.title, this.purpose, this.note);
    for (const t of [this.title, this.purpose, this.note]) t.anchor.set(0.5, 0);
    this.visible = false;
  }

  show(name: string, purpose: string, note: string, cx: number, top: number) {
    this.title.text = name;
    this.purpose.text = purpose;
    this.note.text = note;
    const w = Math.max(this.title.width, this.purpose.width, this.note.width) + 48;
    const h = 30 + this.title.height + this.purpose.height + (note ? this.note.height + 4 : 0);
    this.title.position.set(0, 12);
    this.purpose.position.set(0, 14 + this.title.height);
    this.note.position.set(0, 18 + this.title.height + this.purpose.height);
    this.note.visible = !!note;
    this.paper.clear()
      .roundRect(-w / 2 + 5, 7, w, h, 10).fill({ color: 0x3a2320, alpha: 0.35 })
      .roundRect(-w / 2, 0, w, h, 10).fill(0xf6ecd6).stroke({ color: 0xb98350, width: 3 })
      .poly([-12, h, 12, h, 0, h + 14]).fill(0xf6ecd6);
    // above the building, kept on the screen
    this.position.set(Math.max(w / 2 + 12, Math.min(1920 - w / 2 - 12, cx)), Math.max(12, top - h - 22));
    this.visible = true;
  }
}

/**
 * `?view=town`: Pulpport as the game's hub (#30). The animated town (#29) with the saved gladiator on the road;
 * pointing at a building lights it up and shows what it is for, a click (or ←/→ and Enter) opens its screen, and the
 * arena opens the leagues, from where a bout goes to the arena and back here. Gear (the pack) and the menu are
 * buttons, they have no building. Escape goes back to the title.
 * Dev: `&time=0..1` start phase, `&day=<s>` length of a day, `&freeze` stops the clock.
 */
export async function showTown({ app, world, params, add, kit, ui }: SceneContext) {
  const saved = await loadSavedGladiator();
  if (!saved && !params.has('preview')) {
    location.search = '?view=creator';
    return;
  }
  let gladiator: SavedCharacter | null = saved;

  const time = Number(params.get('time'));
  const day = Number(params.get('day'));
  const town = await TownBackdrop.load(import.meta.env.BASE_URL, {
    phase: params.has('time') && Number.isFinite(time) ? time : undefined,
    daySeconds: day > 0 ? day : undefined,
    frozen: params.has('freeze'),
  });
  world.addChild(town);
  (window as unknown as { __town: TownBackdrop }).__town = town;

  // the gladiator on the road, with a soft shadow under the feet
  const people = new Container();
  world.addChild(people);
  const shadow = new Sprite(groundShadowTexture());
  shadow.anchor.set(0.5);
  shadow.blendMode = 'multiply';
  shadow.tint = 0x8a5a48;
  shadow.width = 5 * PLAYER.scale;
  shadow.height = 1.3 * PLAYER.scale;
  shadow.position.set(PLAYER.x + 6, PLAYER.feet);
  people.addChild(shadow);
  const hero = await add(gladiator?.look ?? DEFAULT_LOOK, PLAYER.x, PLAYER.feet - PELVIS_ABOVE_FEET * PLAYER.scale, PLAYER.scale, 1, people, 0.3);

  const tag = new PlaceTag();
  world.addChild(tag);

  // the buildings that open screens, left to right for the arrow keys
  const places = town.manifest.buildings
    .filter((b) => BUILDINGS.some((p) => p.id === b.id))
    .sort((a, b) => a.x + a.w / 2 - (b.x + b.w / 2));
  const bright = new ColorMatrixFilter();
  bright.brightness(1.18, false);
  let hovered: string | null = null;
  let busy = false;

  const highlight = (id: string | null) => {
    if (hovered) town.buildings.get(hovered)!.filters = null;
    hovered = id;
    if (!id) { tag.visible = false; return; }
    const sprite = town.buildings.get(id)!;
    sprite.filters = [bright];
    const b = town.manifest.buildings.find((q) => q.id === id)!;
    const place = BUILDINGS.find((p) => p.id === id)!;
    tag.show(b.name, place.purpose, gladiator ? place.note(gladiator) : '', b.x + b.w / 2, b.y);
  };

  const tryOn = lookPreview(kit, app.renderer);
  const visit = async (id: string) => {
    if (busy || !gladiator) return;
    busy = true;
    highlight(null);
    bar.hidden = true;
    const before = gladiator;
    gladiator = await visitBuilding(id, gladiator, saveGame, tryOn);
    if (gladiator.look !== before.look) await hero.setLook(drawableLook(kit, gladiator.look));
    hud();
    bar.hidden = false;
    busy = false;
  };

  for (const b of places) {
    const sprite = town.buildings.get(b.id)!;
    sprite.eventMode = 'static';
    sprite.cursor = 'pointer';
    sprite.hitArea = alphaHitArea(sprite.texture);
    sprite.on('pointerover', () => { if (!busy) highlight(b.id); });
    sprite.on('pointerout', () => { if (hovered === b.id) highlight(null); });
    sprite.on('pointertap', () => void visit(b.id));
  }

  // top bar: who is in town, the gold, and the places without a building
  ui.innerHTML = '';
  const bar = document.createElement('div');
  bar.className = 'town-bar';
  bar.innerHTML = `<span class="town-bar__who"></span>
    <button type="button" data-act="gear">Gear</button><button type="button" data-act="menu">Menu</button>`;
  Object.assign(bar.style, {
    position: 'fixed', top: '12px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '12px', alignItems: 'center',
    padding: '8px 16px', background: 'rgba(246,236,214,0.92)', border: '2px solid #b98350', borderRadius: '10px',
    fontFamily: 'Georgia, serif', color: '#3a2320', fontSize: '18px', zIndex: '5',
  });
  document.body.append(bar);
  const hud = () => {
    bar.querySelector('.town-bar__who')!.textContent = gladiator ? `${gladiator.name} · level ${gladiator.level} · ${gladiator.gold} gold` : 'Preview';
    bar.title = gladiator ? townNote(gladiator) : '';
  };
  hud();
  bar.addEventListener('click', (e) => {
    const act = (e.target as HTMLElement).closest('button')?.dataset.act;
    if (act === 'gear') void visit('gear');
    else if (act === 'menu') location.search = '?view=title';
  });

  window.addEventListener('keydown', (e) => {
    if (busy) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      const at = places.findIndex((p) => p.id === hovered);
      const next = at < 0 ? (e.key === 'ArrowRight' ? 0 : places.length - 1) : (at + (e.key === 'ArrowRight' ? 1 : -1) + places.length) % places.length;
      highlight(places[next].id);
    } else if (e.key === 'Enter' && hovered) void visit(hovered);
    else if (e.key === 'Escape') location.search = '?view=title';
    else return;
    e.preventDefault();
  });

  return (dt: number) => {
    town.update(dt);
    // the gladiator takes the light of the hour like the paper town around them
    hero.view.tint = town.state.tint;
    shadow.alpha = 0.35 + 0.65 * (1 - town.state.lights);
  };
}
