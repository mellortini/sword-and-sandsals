/**
 * Fight backdrop: the arena render with a shallow depth of field, so the eye stays on the fighters.
 * The stands (busy crowd, same contrast as the puppets) are blurred, desaturated and darkened; the sand the fighters
 * stand on stays sharp; a soft vignette closes the edges. Baked once per texture into a canvas (no per-frame filters).
 */
import { Texture } from 'pixi.js';

/** y (px of the 1920x1080 backdrop) where the stands' wall meets the sand */
const SAND_TOP = 665;
/** how the stands are softened; `shade` scales the darkening at the top and the vignette */
export interface StandsLook {
  readonly blur: number;
  readonly saturation: number;
  readonly brightness: number;
  readonly shade: number;
}
/** blur, colour and light of the stands; tuned by eye against the paper puppets */
export const SUNNY: StandsLook = { blur: 5, saturation: 0.6, brightness: 0.78, shade: 1 };

/**
 * How much of its light a point of the stands keeps under the top shade and the vignette below, 0..1: the spectator
 * sprites (src/ui/crowdFx.ts) are drawn over the finished backdrop, so they take the same light as a tint.
 */
export function standsLight(x: number, y: number, look: StandsLook, w = 1920, h = 1080): number {
  const top = look.shade * (0.35 - 0.3 * Math.min(1, Math.max(0, y / SAND_TOP)));
  const r = Math.hypot(x - w / 2, y - h * 0.62);
  const edge = Math.min(1, Math.max(0, (r - h * 0.35) / (w * 0.72 - h * 0.35)));
  return (1 - top) * (1 - edge * 0.55 * (0.5 + look.shade / 2));
}

const cache = new WeakMap<Texture, Texture>();

export function arenaBackdrop(bg: Texture, look: StandsLook = SUNNY): Texture {
  const hit = cache.get(bg);
  if (hit) return hit;
  const w = bg.width, h = bg.height;
  const source = bg.source.resource as CanvasImageSource;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d')!;

  // 1) sharp render (the sand)
  g.drawImage(source, 0, 0, w, h);

  // 2) soft stands on top, fading out into the sharp sand just above the floor line
  const soft = document.createElement('canvas');
  soft.width = w; soft.height = h;
  const s = soft.getContext('2d')!;
  // Canvas filters are missing in some older browsers; then the stands are only dimmed, never broken.
  const canFilter = typeof (s as { filter?: unknown }).filter === 'string';
  s.filter = `blur(${look.blur}px) saturate(${look.saturation}) brightness(${look.brightness})`;
  // draw slightly oversized so the blur does not pull transparent edges in
  s.drawImage(source, -look.blur * 2, -look.blur * 2, w + look.blur * 4, h + look.blur * 4);
  s.filter = 'none';
  if (!canFilter) {
    s.globalCompositeOperation = 'multiply';
    s.fillStyle = `rgba(0,0,0,${1 - look.brightness})`;
    s.fillRect(0, 0, w, h);
  }
  s.globalCompositeOperation = 'destination-in';
  const fade = s.createLinearGradient(0, 0, 0, h);
  fade.addColorStop(0, 'rgba(0,0,0,1)');
  fade.addColorStop((SAND_TOP - 40) / h, 'rgba(0,0,0,1)');
  fade.addColorStop((SAND_TOP + 70) / h, 'rgba(0,0,0,0)');
  fade.addColorStop(1, 'rgba(0,0,0,0)');
  s.fillStyle = fade;
  s.fillRect(0, 0, w, h);
  g.drawImage(soft, 0, 0);

  // 3) light: a little darker at the top (the stands recede), vignette on the sides and corners
  const top = g.createLinearGradient(0, 0, 0, SAND_TOP);
  top.addColorStop(0, `rgba(30,14,16,${0.35 * look.shade})`);
  top.addColorStop(1, `rgba(30,14,16,${0.05 * look.shade})`);
  g.fillStyle = top;
  g.fillRect(0, 0, w, SAND_TOP);
  const vignette = g.createRadialGradient(w / 2, h * 0.62, h * 0.35, w / 2, h * 0.62, w * 0.72);
  vignette.addColorStop(0, 'rgba(30,14,16,0)');
  vignette.addColorStop(1, `rgba(30,14,16,${0.55 * (0.5 + look.shade / 2)})`);
  g.fillStyle = vignette;
  g.fillRect(0, 0, w, h);

  const tex = Texture.from(c);
  cache.set(bg, tex);
  return tex;
}
