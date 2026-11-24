/**
 * Fight backdrop: the arena render with a shallow depth of field, so the eye stays on the fighters.
 * The stands (busy crowd, same contrast as the puppets) are blurred, desaturated and darkened; the sand the fighters
 * stand on stays sharp; a soft vignette closes the edges. Baked once per texture into a canvas (no per-frame filters).
 */
import { Texture } from 'pixi.js';

/** y (px of the 1920x1080 backdrop) where the stands' wall meets the sand */
const SAND_TOP = 665;
/** blur, colour and light of the stands; tuned by eye against the paper puppets */
const STANDS_BLUR_PX = 5;
const STANDS_SATURATION = 0.6;
const STANDS_BRIGHTNESS = 0.78;

const cache = new WeakMap<Texture, Texture>();

export function arenaBackdrop(bg: Texture): Texture {
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
  s.filter = `blur(${STANDS_BLUR_PX}px) saturate(${STANDS_SATURATION}) brightness(${STANDS_BRIGHTNESS})`;
  // draw slightly oversized so the blur does not pull transparent edges in
  s.drawImage(source, -STANDS_BLUR_PX * 2, -STANDS_BLUR_PX * 2, w + STANDS_BLUR_PX * 4, h + STANDS_BLUR_PX * 4);
  s.filter = 'none';
  if (!canFilter) {
    s.globalCompositeOperation = 'multiply';
    s.fillStyle = `rgba(0,0,0,${1 - STANDS_BRIGHTNESS})`;
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
  top.addColorStop(0, 'rgba(30,14,16,0.35)');
  top.addColorStop(1, 'rgba(30,14,16,0.05)');
  g.fillStyle = top;
  g.fillRect(0, 0, w, SAND_TOP);
  const vignette = g.createRadialGradient(w / 2, h * 0.62, h * 0.35, w / 2, h * 0.62, w * 0.72);
  vignette.addColorStop(0, 'rgba(30,14,16,0)');
  vignette.addColorStop(1, 'rgba(30,14,16,0.55)');
  g.fillStyle = vignette;
  g.fillRect(0, 0, w, h);

  const tex = Texture.from(c);
  cache.set(bg, tex);
  return tex;
}
