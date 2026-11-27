/// <reference types="vite/client" />

/**
 * PaperRig — modular cut-out gladiator made of Cycles-rendered paper parts (game/assets/chars/kit).
 *
 * - kit.json: skeleton (bones with joint offsets, units, y up), ordered layers (bone + slot + piece), sprites (size, pivot, tint group)
 * - Look = skin / face / hair / hair colour / beard + equipment tier per slot (0 = nothing, 1..10)
 * - skin and hair parts are rendered on neutral paper and coloured here per pixel (gain may exceed 1, unlike sprite.tint)
 * - every part gets a soft paper shadow drawn right before it; 'multiply' is patched so shadows only darken paper that
 *   is already in the puppet texture (like canvas source-atop)
 */
import { EXPRESSION_KEYS, EXPRESSION_PIECES, pieceShown } from './expressions';
import { widthScale } from './builds';
import { SHIELD_TURN, holdShield, isShieldTier, shieldArmInFront } from './shield';
import { boneOffset, forwardKinematics, holdWithBothHands, looseHead } from './twoHand';
import { Assets, Container, Rectangle, Renderer, RenderTexture, Sprite, Texture } from 'pixi.js';

export interface KitJson {
  ppu: number;
  sun_dir: [number, number];
  head_scale: number;
  neutral: number;
  jaw_center: [number, number];
  ref_jaw: [number, number];
  bones: { name: string; parent: string | null; x: number; y: number }[];
  layers: { bone: string; slot: string; piece: string; back?: boolean }[];
  pose_test: Record<string, number>;
  skins: { name: string; color: string }[];
  hair_colors: { name: string; color: string }[];
  faces: { name: string; jaw: [number, number] }[];
  hairs: string[];
  hair_top_back: number[];
  hood_helmets: number[];
  beards: string[];
  sets: string[];
  sprites: Record<string, { w: number; h: number; pivot: [number, number]; tint: 'skin' | 'hair' | null; alpha?: number; grip2?: [number, number]; pair?: boolean; offhand?: string }>;
}

export type Pose = Record<string, number>;
export const EQUIP_SLOTS = ['helmet', 'armor', 'shoulders', 'greaves', 'boots'] as const;
export type EquipSlot = (typeof EQUIP_SLOTS)[number];

export interface Look {
  skin: number; face: number; hair: number; hairColor: number; beard: number;
  helmet: number; armor: number; shoulders: number; greaves: number; boots: number;
  weapon: string;
  /** body build (#27): 0 slim, 1 average (default), 2 heavy - src/rig/builds.ts */
  build?: number;
  /** off-hand shield tier (#38): 0/undefined = none, 1-4 a round parma, 5-10 a scutum - src/rig/shield.ts */
  shield?: number;
}

export const DEFAULT_LOOK: Look = { skin: 3, face: 0, hair: 1, hairColor: 1, beard: 2, helmet: 0, armor: 0, shoulders: 0, greaves: 0, boots: 0, weapon: 'gladius' };

export interface ShadowStyle { enabled: boolean; depth: number; blur: number; strength: number; color: [number, number, number] }
export const DEFAULT_SHADOW: ShadowStyle = { enabled: true, depth: 0.3, blur: 7, strength: 0.5, color: [0.42, 0.2, 0.22] };

const SHADOW_PAD = 24;
const BACK_TINT = 0xdcdcdc;

interface AtlasFrame { page: string; x: number; y: number; w: number; h: number }
interface AtlasManifest { version: number; frames: Record<string, AtlasFrame> }
interface SpritePixels { image: CanvasImageSource; frame: Rectangle }

// ------------------------------------------------------------------ shared kit + texture caches
export class Kit {
  readonly json: KitJson;
  readonly base: string;
  private images = new Map<string, SpritePixels>();
  private atlasPages = new Map<string, Promise<Texture | null>>();
  private tinted = new Map<string, Texture>();
  private shadows = new Map<string, Texture>();
  private plain = new Map<string, Texture>();

  private constructor(base: string, json: KitJson, private readonly frames: Record<string, AtlasFrame> = {}) {
    this.base = base;
    this.json = json;
  }

  static async load(base: string): Promise<Kit> {
    const json: KitJson = await (await fetch(`${base}/kit.json`)).json();
    // The renderer can iterate on individual PNGs in dev without rebuilding atlases.
    if (!import.meta.env.PROD) return new Kit(base, json);

    const manifest = await fetch(`${base}/atlas/manifest.json`)
      .then((response): Promise<AtlasManifest | null> => response.ok ? response.json() : Promise.resolve(null))
      .catch(() => null);
    return new Kit(base, json, manifest?.version === 1 ? manifest.frames : undefined);
  }

  has(key: string) { return key in this.json.sprites; }

  async ensure(keys: string[]) {
    await Promise.all([...new Set(keys)].filter((k) => this.has(k) && !this.images.has(k)).map(async (k) => {
      const tex = await this.atlasTexture(k) ?? await Assets.load<Texture>(`${this.base}/sprites/${k}.png`);
      this.plain.set(k, tex);
      this.images.set(k, { image: tex.source.resource as CanvasImageSource, frame: tex.frame });
    }));
  }

  private async atlasTexture(key: string): Promise<Texture | null> {
    const frame = this.frames[key];
    const sprite = this.json.sprites[key];
    if (!frame || frame.w !== sprite.w || frame.h !== sprite.h) return null;

    let pending = this.atlasPages.get(frame.page);
    if (!pending) {
      pending = Assets.load<Texture>(`${this.base}/atlas/${frame.page}`).catch(() => null);
      this.atlasPages.set(frame.page, pending);
    }
    const page = await pending;
    if (!page || frame.x < 0 || frame.y < 0 || frame.x + frame.w > page.width || frame.y + frame.h > page.height) {
      return null;
    }
    return new Texture({ source: page.source, frame: new Rectangle(frame.x, frame.y, frame.w, frame.h) });
  }

  private drawSprite(key: string, context: CanvasRenderingContext2D, x: number, y: number) {
    const { image, frame } = this.images.get(key)!;
    context.drawImage(image, frame.x, frame.y, frame.width, frame.height, x, y, frame.width, frame.height);
  }

  /** texture for a sprite, coloured for its tint group */
  texture(key: string, color: string | null): Texture {
    if (!color) return this.plain.get(key)!;
    const id = `${key}|${color}`;
    let t = this.tinted.get(id);
    if (t) return t;
    const { frame } = this.images.get(key)!;
    const c = document.createElement('canvas');
    c.width = frame.width; c.height = frame.height;
    const g = c.getContext('2d', { willReadFrequently: true })!;
    this.drawSprite(key, g, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height);
    const n = this.json.neutral;
    const lin = (h: number) => parseInt(color.slice(h, h + 2), 16) / 255 / n;
    const kr = lin(1), kg = lin(3), kb = lin(5);
    const a = d.data;
    for (let i = 0; i < a.length; i += 4) {
      a[i] = Math.min(255, a[i] * kr);
      a[i + 1] = Math.min(255, a[i + 1] * kg);
      a[i + 2] = Math.min(255, a[i + 2] * kb);
    }
    g.putImageData(d, 0, 0);
    t = Texture.from(c);
    this.tinted.set(id, t);
    return t;
  }

  shadow(key: string, blur: number): Texture {
    let t = this.shadows.get(key);
    if (t) return t;
    const { frame } = this.images.get(key)!;
    const c = document.createElement('canvas');
    c.width = frame.width + SHADOW_PAD * 2;
    c.height = frame.height + SHADOW_PAD * 2;
    const g = c.getContext('2d')!;
    g.filter = `blur(${blur}px)`;
    this.drawSprite(key, g, SHADOW_PAD, SHADOW_PAD);
    g.filter = 'none';
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = '#fff';
    g.fillRect(0, 0, c.width, c.height);
    t = Texture.from(c);
    this.shadows.set(key, t);
    return t;
  }

  /** sprite key for a layer under a look (null = nothing drawn) */
  resolve(layer: KitJson['layers'][number], look: Look): string | null {
    const p = layer.piece;
    switch (layer.slot) {
      case 'body': return `body_${p}`;
      case 'cut': return `cut_${p}`;
      case 'face': return `face${look.face}_${p}`;
      case 'hair':
        if (look.helmet > 0) {
          if (p === 'front') return null;
          if (this.json.hood_helmets?.includes(look.helmet) || this.json.hair_top_back?.includes(look.hair)) return null;
        }
        return `hair${look.hair}_${p}`;
      case 'beard': return look.beard > 0 ? `beard${look.beard}` : null;
      case 'weapon': return look.weapon ? `weapon_${look.weapon}` : null;
      case 'shield': return this.shieldShown(look) ? `shield${look.shield}` : null;
      // the back hand holds a paired weapon's second copy (daggers, #47) or the weapon's companion (the trident's net, #254);
      // a shield (#273) takes that hand instead of the second dagger
      case 'weapon_b': {
        const main = look.weapon ? this.json.sprites[`weapon_${look.weapon}`] : undefined;
        if (main?.pair) return this.shieldShown(look) ? null : `weapon_${look.weapon}`;
        return main?.offhand ?? null;
      }
      default: {
        const tier = look[layer.slot as EquipSlot] ?? 0;
        if (!tier) return null;
        return `${layer.slot}${tier}${p ? '_' + p : ''}`;
      }
    }
  }

  /** a shield is drawn when the look has one and the back hand is free (not on the haft of a two-handed weapon) */
  shieldShown(look: Look): boolean {
    return isShieldTier(look.shield) && !this.json.sprites[`weapon_${look.weapon}`]?.grip2;
  }

  keysFor(look: Look): string[] {
    return this.json.layers.map((l) => this.resolve(l, look)).filter((k): k is string => !!k && this.has(k));
  }
}

/** `cut` = drawn only with a torn neck (true) or only with a whole one (false); undefined = always */
/** `face` = a face piece an expression may show or hide (#26) */
interface Part { bone: string; sprite: Sprite; shadow: Sprite; sx: number; sy: number; ox: number; oy: number; flat: boolean; cut?: boolean; face?: string }

/** pose keys beyond the bones that change the picture */
const EXTRA_POSE_KEYS = ['neck_cut', 'head_x', 'head_y', 'head_rot', ...EXPRESSION_KEYS];

interface StillFrame {
  pose: Pose;
  facing: 1 | -1;
  scale: number;
  shadow: ShadowStyle;
}

export class PaperRig {
  readonly view: Sprite;
  readonly kit: Kit;
  pose: Pose;
  facing: 1 | -1;
  scale: number;
  shadow: ShadowStyle;
  look: Look = { ...DEFAULT_LOOK };

  private inner = new Container();
  private parts: Part[] = [];
  private rt: RenderTexture;
  private origin: { x: number; y: number };
  private stillFrame?: StillFrame;
  private lookGen = 0;
  private lookReady: Promise<void> = Promise.resolve();

  constructor(kit: Kit, opts: { scale: number; facing: 1 | -1; shadow?: ShadowStyle }) {
    this.kit = kit;
    this.scale = opts.scale;
    this.facing = opts.facing;
    this.shadow = { ...(opts.shadow ?? DEFAULT_SHADOW) };
    this.pose = { ...kit.json.pose_test };
    // 12.5 units ahead of the pelvis: room for a spear thrust (#36); 9.5 behind it: a fighter fallen on the back with
    // a shield on the arm (#273) used to be cut off at 6.5
    const wU = 22, hU = 18;
    this.origin = { x: 9.5 * this.scale, y: 11.8 * this.scale };
    const resolution = window.matchMedia('(pointer: coarse)').matches ? 1 : 2;
    this.rt = RenderTexture.create({ width: Math.ceil(wU * this.scale), height: Math.ceil(hU * this.scale), resolution, antialias: true });
    this.view = new Sprite(this.rt);
    this.setFacing(opts.facing);
  }

  setFacing(f: 1 | -1) {
    this.facing = f;
    this.view.scale.x = f;
    this.view.anchor.set(this.origin.x / this.rt.width, this.origin.y / this.rt.height);
  }

  /** show only a window of the puppet (units around the pelvis, y up) - portraits without masks */
  crop(x0: number, y0: number, x1: number, y1: number) {
    const k = this.scale;
    const frame = new Rectangle(this.origin.x + x0 * k, this.origin.y - y1 * k, (x1 - x0) * k, (y1 - y0) * k);
    this.view.texture = new Texture({ source: this.rt.source, frame });
    this.view.anchor.set(0, 0);
  }

  /**
   * rebuild the sprite list for a look (loads missing textures).
   * Loading atlas pages can take seconds on a slow network, so calls may overlap. The newest call always wins:
   * an older call that finishes later does not rebuild the puppet, and every call resolves once the newest look is shown.
   */
  setLook(look: Partial<Look>): Promise<void> {
    this.look = { ...this.look, ...look };
    const L = this.look;
    const gen = ++this.lookGen;
    this.lookReady = this.kit.ensure(this.kit.keysFor(L)).then(() => {
      if (gen === this.lookGen) this.build(L);
    });
    return this.lookSettled();
  }

  private async lookSettled() {
    let p: Promise<void>;
    do { p = this.lookReady; await p; } while (p !== this.lookReady);
  }

  private build(L: Look) {
    this.inner.removeChildren();
    this.parts = [];
    const J = this.kit.json;
    const skin = J.skins[L.skin]?.color ?? J.skins[3].color;
    const hair = J.hair_colors[L.hairColor]?.color ?? J.hair_colors[1].color;
    const face = J.faces[L.face] ?? J.faces[0];
    // behind a shield the body stands in a quarter turn (#273): shield arm in front, sword shoulder behind, narrower chest
    const turned = this.kit.shieldShown(L);
    const layers = turned ? shieldArmInFront(J.layers) : J.layers;
    for (const layer of layers) {
      const key = this.kit.resolve(layer, L);
      if (!key || !this.kit.has(key)) continue;
      const m = J.sprites[key];
      const color = m.tint === 'skin' ? skin : m.tint === 'hair' ? hair : null;
      const s = new Sprite(this.kit.texture(key, color));
      s.anchor.set(m.pivot[0] / m.w, m.pivot[1] / m.h);
      if (layer.back) s.tint = BACK_TINT;
      const flat = (m.alpha ?? 1) < 1;
      if (flat) s.alpha = m.alpha!;
      const sh = new Sprite(this.kit.shadow(key, this.shadow.blur));
      sh.anchor.set((m.pivot[0] + SHADOW_PAD) / (m.w + SHADOW_PAD * 2), (m.pivot[1] + SHADOW_PAD) / (m.h + SHADOW_PAD * 2));
      sh.blendMode = 'multiply';
      // beards are drawn on the reference jaw: stretch them to this face's jaw around the jaw centre
      // a build widens the paper across its bone (#27); armour on the bone follows, so every set fits
      let sx = widthScale(L.build, layer.bone) * (turned && layer.bone === 'torso' ? SHIELD_TURN.chestWidth : 1), sy = 1, ox = 0, oy = 0;
      if (layer.slot === 'beard') {
        sx = face.jaw[0] / J.ref_jaw[0];
        sy = face.jaw[1] / J.ref_jaw[1];
        ox = J.jaw_center[0] * (1 - sx);
        oy = J.jaw_center[1] * (1 - sy);
      }
      this.inner.addChild(sh, s);
      const cut = layer.slot === 'cut' ? true : layer.slot === 'body' && layer.piece === 'torso' ? false : undefined;
      const expression = layer.slot === 'face' && layer.piece in EXPRESSION_PIECES ? layer.piece : undefined;
      this.parts.push({ bone: layer.bone, sprite: s, shadow: sh, sx, sy, ox, oy, flat, cut, face: expression });
    }
    this.invalidateStillFrame();
  }

  invalidateStillFrame() { this.stillFrame = undefined; }

  renderStill(renderer: Renderer, pose: Pose) {
    this.pose = pose;
    const frame = this.stillFrame;
    const shadow = this.shadow;
    if (frame && frame.facing === this.facing && frame.scale === this.scale
      && frame.shadow.enabled === shadow.enabled && frame.shadow.depth === shadow.depth
      && frame.shadow.strength === shadow.strength && frame.shadow.color.every((value, index) => value === shadow.color[index])
      && this.kit.json.bones.every(({ name }) => (frame.pose[name] ?? 0) === (pose[name] ?? 0))
      && EXTRA_POSE_KEYS.every((name) => (frame.pose[name] ?? 0) === (pose[name] ?? 0))) return;

    this.render(renderer);
    this.stillFrame = { pose: { ...pose }, facing: this.facing, scale: this.scale, shadow: { ...shadow, color: [...shadow.color] } };
  }

  /** forward kinematics in rig units (y up, pelvis joint at its rest place), rotations in radians CCW */
  fk(pose: Pose): Map<string, { x: number; y: number; r: number }> {
    return forwardKinematics(this.kit.json.bones, pose);
  }

  /** a point given in a bone's own units (y up) in the coordinates of the view's parent, for effects */
  screenPoint(bone: string, x = 0, y = 0): { x: number; y: number } {
    const j = this.fk(this.heldPose()).get(bone)!;
    const root = this.kit.json.bones[0];
    const c = Math.cos(j.r), s = Math.sin(j.r);
    return {
      x: this.view.x + (j.x + x * c - y * s - root.x) * this.scale * this.facing,
      y: this.view.y - (j.y + x * s + y * c - root.y) * this.scale,
    };
  }

  /** lowest point of both soles (heel / toe), rig units */
  soleLow(pose: Pose): number {
    const J = this.fk(pose);
    let low = Infinity;
    for (const f of ['foot_b', 'foot_f']) {
      const t = J.get(f)!;
      const c = Math.cos(t.r), s = Math.sin(t.r);
      for (const [px, py] of [[-0.38, -0.42], [1.05, -0.42]]) low = Math.min(low, t.y + px * s + py * c);
    }
    return low;
  }

  /** is a shield drawn on the back hand (#38)? */
  hasShield(): boolean { return this.kit.shieldShown(this.look); }

  /**
   * The pose as drawn: with a two-handed weapon (sprite meta `grip2`, #36) the back arm is bent so its hand holds the
   * haft, whatever the clip says about the back arm. A shield (#38) is turned to lean with the body instead of the arm.
   */
  heldPose(pose: Pose = this.pose): Pose {
    const key = this.look.weapon ? `weapon_${this.look.weapon}` : null;
    const grip2 = key ? this.kit.json.sprites[key]?.grip2 : undefined;
    if (grip2) return holdWithBothHands(this.kit.json.bones, pose, grip2);
    return this.hasShield() ? holdShield(pose) : pose;
  }

  private solve(): Map<string, { x: number; y: number; r: number }> {
    const out = new Map<string, { x: number; y: number; r: number }>();
    const k = this.scale;
    const pose = this.heldPose();
    for (const b of this.kit.json.bones) {
      const rot = ((pose[b.name] ?? 0) * Math.PI) / 180;
      if (!b.parent) { out.set(b.name, { x: this.origin.x, y: this.origin.y, r: -rot }); continue; }
      if (b.name === 'head' && pose.neck_cut) {
        const h = looseHead(pose), root = this.kit.json.bones[0];
        out.set(b.name, { x: this.origin.x + (h.x - root.x) * k, y: this.origin.y - (h.y - root.y) * k, r: -h.r });
        continue;
      }
      const p = out.get(b.parent)!;
      const o = boneOffset(b, pose);
      const lx = o.x * k, ly = -o.y * k;
      const c = Math.cos(p.r), s = Math.sin(p.r);
      out.set(b.name, { x: p.x + lx * c - ly * s, y: p.y + lx * s + ly * c, r: p.r - rot });
    }
    return out;
  }

  render(renderer: Renderer) {
    this.invalidateStillFrame();
    const W = this.solve();
    const tex = this.scale / this.kit.json.ppu;
    const sh = this.shadow;
    const sun = this.kit.json.sun_dir;
    const ox = sun[0] * sh.depth * this.scale * this.facing;
    const oy = -sun[1] * sh.depth * this.scale;
    const ch = (i: number) => Math.round((1 - sh.strength * (1 - sh.color[i])) * 255);
    const tint = (ch(0) << 16) | (ch(1) << 8) | ch(2);
    const k = this.scale;
    const torn = !!this.pose.neck_cut;
    for (const p of this.parts) {
      const shown = (p.cut === undefined || p.cut === torn) && (!p.face || pieceShown(p.face, this.pose));
      const t = W.get(p.bone)!;
      // local offset (bone units, y up) -> screen
      const lx = p.ox * k, ly = -p.oy * k;
      const c = Math.cos(t.r), s = Math.sin(t.r);
      const x = t.x + lx * c - ly * s, y = t.y + lx * s + ly * c;
      for (const [spr, dx, dy] of [[p.sprite, 0, 0], [p.shadow, ox, oy]] as const) {
        spr.position.set(x + dx, y + dy);
        spr.rotation = t.r;
        spr.scale.set(tex * p.sx, tex * p.sy);
      }
      p.sprite.visible = shown;
      p.shadow.visible = shown && sh.enabled && !p.flat;
      p.shadow.tint = tint;
    }
    renderer.render({ container: this.inner, target: this.rt, clear: true });
  }
}

/** make 'multiply' keep destination alpha (srcA*0 + dstA*1): shadows only darken paper already drawn */
export function patchShadowBlend(renderer: Renderer) {
  const r = renderer as unknown as { gl?: WebGL2RenderingContext; state?: { blendModesMap: Record<string, number[]> } };
  if (!r.gl || !r.state) return false;
  const gl = r.gl;
  r.state.blendModesMap.multiply = [gl.DST_COLOR, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE];
  return true;
}
