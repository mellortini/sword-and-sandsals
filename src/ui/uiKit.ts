/** Pixi textures from the paper UI kit sheet (#16, src/ui/uiSheet.ts). */
import { Assets, Rectangle, Texture } from 'pixi.js';
import type { SheetFrame } from './uiSheet';
import { loadUiSheet } from './uiSheet';

export interface UiKit {
  texture(key: string): Texture;
  frame(key: string): SheetFrame;
  fill(key: string): { top: number; bottom: number };
}

let kit: Promise<UiKit | null> | null = null;

export function loadUiKit(): Promise<UiKit | null> {
  kit ??= (async () => {
    const s = await loadUiSheet();
    if (!s) return null;
    try {
      const base = await Assets.load<Texture>(s.url);
      const cache = new Map<string, Texture>();
      return {
        frame: (key) => s.frames[key],
        fill: (key) => s.fill[key],
        texture: (key) => {
          let t = cache.get(key);
          if (!t) {
            const f = s.frames[key];
            t = new Texture({ source: base.source, frame: new Rectangle(f.x, f.y, f.w, f.h) });
            cache.set(key, t);
          }
          return t;
        },
      };
    } catch (e) {
      console.warn('ui kit texture not loaded', e);
      return null;
    }
  })();
  return kit;
}
