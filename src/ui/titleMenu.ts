/// <reference types="vite/client" />
/**
 * The title screen's fight poster: the game's name and the main menu printed on a torn sheet nailed to a post
 * (posterStage.ts), over the live arena (src/scenes/title.ts). Mouse, touch or keyboard (↑/↓, Enter). Also the Credits
 * sheet the menu opens.
 */
import { moveSelection } from './menuNav';
import { posterSheet, posterStage, uiArt, usePaper } from './posterStage';
import type { TitleEntry } from './titleRules';
import './titleMenu.css';

export function showTitleMenu(entries: readonly TitleEntry[], choose: (entry: TitleEntry) => Promise<void> | void): void {
  const sword = (side: string) => `<img class="title-poster__sword title-poster__sword--${side}" src="${uiArt('weapons/sword8.png')}" alt="">`;
  const { stage } = posterStage('title-stage', `<div class="poster-post" aria-hidden="true"></div>${posterSheet('title-poster', `
      <p class="title-poster__kicker">The arena presents</p>
      <h1>Folded<br>Glory</h1>
      <p class="title-poster__tag">The road of the Seventh Step</p>
      <nav aria-label="Main menu">${entries.map((_, i) =>
        `<button type="button" class="title-entry" data-entry="${i}"><b></b><small></small></button>`).join('')}</nav>`,
    sword('left') + sword('right'))}`);
  const buttons = [...stage.querySelectorAll<HTMLButtonElement>('.title-entry')];
  buttons.forEach((b, i) => {
    b.querySelector('b')!.textContent = entries[i].label;
    b.querySelector('small')!.textContent = entries[i].note;
  });

  let selected = 0;
  let busy = false;
  const select = (i: number, focus = false) => {
    selected = i;
    buttons.forEach((b, j) => b.classList.toggle('title-entry--on', j === i));
    if (focus) buttons[i].focus({ preventScroll: true });
  };
  const activate = async (i: number) => {
    if (busy) return;
    busy = true;
    select(i);
    await choose(entries[i]);
    busy = false;
    select(i, true);
  };
  buttons.forEach((b, i) => {
    b.addEventListener('pointerenter', () => { if (!busy) select(i, true); });
    b.addEventListener('focus', () => select(i));
    b.addEventListener('click', () => void activate(i));
  });

  const enabled = entries.map((e) => ({ label: e.label, enabled: true }));
  // Settings and Credits catch the keys themselves (capture phase) while they are open
  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') select(moveSelection(enabled, selected, e.key === 'ArrowDown' ? 1 : -1), true);
    else if (e.key === 'Enter') void activate(selected);
    else return;
    e.preventDefault();
  });
  select(0, true);
}

const CREDITS: readonly (readonly [string, string])[] = [
  ['A game by', 'Mateusz · lkaelek · goloburda05-hue'],
  ['Lettering', 'Cinzel by Natanael Gama and Alegreya by Juan Pablo del Peral, SIL Open Font License 1.1'],
  ['Paper', 'Paper and cardboard scans from the free BlenderKit library'],
];

/** The Credits sheet; resolves when it is closed (button, Escape or a click outside). */
export function openCredits(): Promise<void> {
  const backdrop = document.createElement('div');
  backdrop.className = 'credits';
  usePaper(backdrop);
  backdrop.innerHTML = `<div class="credits__sheet" role="dialog" aria-modal="true" aria-labelledby="creditsTitle">
    <h2 id="creditsTitle">Credits</h2>
    <dl>${CREDITS.map(([what, who]) => `<dt>${what}</dt><dd>${who}</dd>`).join('')}</dl>
    <button type="button">Back</button></div>`;
  document.body.append(backdrop);
  const button = backdrop.querySelector('button')!;
  button.focus();
  return new Promise((resolve) => {
    const keys = new AbortController();
    const close = () => {
      keys.abort();
      backdrop.remove();
      resolve();
    };
    button.addEventListener('click', close);
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
    window.addEventListener('keydown', (e) => {
      e.stopImmediatePropagation();
      e.preventDefault();
      if (e.key === 'Escape' || e.key === 'Enter') close();
    }, { capture: true, signal: keys.signal });
  });
}
