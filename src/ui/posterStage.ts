/// <reference types="vite/client" />
/**
 * The paper poster screens (main menu, pre-fight): a 1280x720 DOM stage over the Pixi world, scaled and centred the
 * same way, and the pieces of a torn sheet nailed to a post. Styles in posterStage.css.
 */
import { addFonts } from './counter';
import './posterStage.css';

const STAGE = { w: 1280, h: 720 } as const;
/** a file under assets/ui */
export const uiArt = (path: string) => `${import.meta.env.BASE_URL}ui/${path}`;

/** gives `el` the cream card paper the sheets are printed on (--paper) */
export function usePaper(el: HTMLElement) {
  el.style.setProperty('--paper', `url("${uiArt('weapon-card.jpg')}")`);
}

/** the torn sheet with its print and two nails: `print` goes on the paper, `extra` lies over it */
export function posterSheet(cls: string, print: string, extra = ''): string {
  return `<div class="poster ${cls}">
    <div class="poster__sheet" aria-hidden="true"></div>
    <div class="poster__print ${cls}__print">${print}</div>
    <div aria-hidden="true">${extra}<i class="poster__nail poster__nail--left"></i><i class="poster__nail poster__nail--right"></i></div>
  </div>`;
}

/** Puts a stage with `html` on the page; `remove` takes it away again. */
export function posterStage(cls: string, html: string): { stage: HTMLElement; remove: () => void } {
  addFonts();
  const stage = document.createElement('div');
  stage.className = `poster-stage ${cls}`;
  usePaper(stage);
  stage.innerHTML = html;
  document.body.append(stage);
  const listening = new AbortController();
  const fit = () => {
    const s = Math.min(window.innerWidth / STAGE.w, window.innerHeight / STAGE.h);
    stage.style.transform = `translate(${(window.innerWidth - STAGE.w * s) / 2}px, ${(window.innerHeight - STAGE.h * s) / 2}px) scale(${s})`;
  };
  window.addEventListener('resize', fit, { signal: listening.signal });
  fit();
  return { stage, remove: () => { listening.abort(); stage.remove(); } };
}
