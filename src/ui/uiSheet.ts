/**
 * The paper UI kit sheet rendered by blender/ui_kit.py (#16): assets/ui/ui.png + ui.json.
 * No Pixi here: the HTML action bar uses it for CSS icons, src/ui/uiKit.ts turns it into Pixi textures.
 */

export interface SheetFrame { x: number; y: number; w: number; h: number }
export interface UiSheet {
  url: string;
  width: number;
  height: number;
  frames: Readonly<Record<string, SheetFrame>>;
  /** flask liquids: px rows inside the frame where the liquid is full (top) and empty (bottom) */
  fill: Readonly<Record<string, { top: number; bottom: number }>>;
}

let sheet: Promise<UiSheet | null> | null = null;

/** loads once; null when the sheet is missing (the drawn fallback UI stays) */
export function loadUiSheet(): Promise<UiSheet | null> {
  sheet ??= (async () => {
    try {
      const base = import.meta.env.BASE_URL;
      const url = `${base}ui/ui.png`;
      const [meta, size] = await Promise.all([
        fetch(`${base}ui/ui.json`).then((r) => r.json() as Promise<Pick<UiSheet, 'frames' | 'fill'>>),
        new Promise<{ width: number; height: number }>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
          img.onerror = reject;
          img.src = url;
        }),
      ]);
      return { url, ...size, frames: meta.frames, fill: meta.fill ?? {} };
    } catch (e) {
      console.warn('ui kit sheet not loaded', e);
      return null;
    }
  })();
  return sheet;
}

/** CSS that shows one frame of the sheet scaled to `size` px wide (background of an element of that size) */
export function frameCss(s: Pick<UiSheet, 'url' | 'width' | 'height' | 'frames'>, key: string, size: number) {
  const f = s.frames[key];
  if (!f) return null;
  const k = size / f.w;
  const px = (v: number) => `${+(v * k).toFixed(2)}px`;
  return {
    width: `${size}px`,
    height: px(f.h),
    backgroundImage: `url("${s.url}")`,
    backgroundSize: `${px(s.width)} ${px(s.height)}`,
    backgroundPosition: `-${px(f.x)} -${px(f.y)}`,
    backgroundRepeat: 'no-repeat',
  };
}

/**
 * CSS that stretches one frame of the sheet over an element of any size (the scroll's body, #34): percentages keep the
 * frame filling the element whatever its width and height, so nothing else of the sheet shows.
 */
export function frameFill(s: Pick<UiSheet, 'url' | 'width' | 'height' | 'frames'>, key: string) {
  const f = s.frames[key];
  if (!f) return null;
  const pct = (v: number) => `${+v.toFixed(4)}%`;
  const at = (offset: number, sheet: number, size: number) => (sheet === size ? 0 : (offset / (sheet - size)) * 100);
  return {
    backgroundImage: `url("${s.url}")`,
    backgroundSize: `${pct((s.width / f.w) * 100)} ${pct((s.height / f.h) * 100)}`,
    backgroundPosition: `${pct(at(f.x, s.width, f.w))} ${pct(at(f.y, s.height, f.h))}`,
    backgroundRepeat: 'no-repeat',
  };
}
