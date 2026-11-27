/// <reference types="vite/client" />
/**
 * The vendor's counter (#267): one frame for every building's screen. The room (#35) fills the screen, the vendor's bust
 * (#33) stands big at the bottom left and talks in a speech bubble at the top left, the goods are on a paper board on the
 * right with tabs above it, the gold is on a plaque in the corner and a round door button leaves. The gladiator is not
 * shown. Headings in Cinzel (Roman capitals), text in Alegreya (assets/fonts, OFL).
 */
import { VENDOR_AT, loadNpcs, mouthOpen, npcUrl } from './npcs';
import { ROOM_AT, roomUrl } from './shopRooms';
import './counter.css';

let fontsAdded = false;
/** the two type faces, from the game's own files (works under any base path and offline) */
export function addFonts() {
  if (fontsAdded) return;
  fontsAdded = true;
  const dir = `${import.meta.env.BASE_URL}fonts/`;
  const style = document.createElement('style');
  style.textContent = `
    @font-face { font-family: 'Cinzel'; src: url('${dir}Cinzel.woff2') format('woff2'); font-weight: 400 900; font-display: swap; }
    @font-face { font-family: 'Alegreya'; src: url('${dir}Alegreya.woff2') format('woff2'); font-weight: 400 900; font-display: swap; }
    @font-face { font-family: 'Alegreya'; src: url('${dir}Alegreya-Italic.woff2') format('woff2'); font-weight: 400 900; font-style: italic; font-display: swap; }`;
  document.head.append(style);
}

/** seconds a line keeps the vendor's mouth moving: a little per letter, never too short or long */
const talkTime = (text: string) => Math.min(3, Math.max(0.8, text.length * 0.035));

export interface CounterTab { id: string; label: string }

export interface CounterOptions {
  /** town building id (src/ui/town.ts BUILDINGS): picks the room and the vendor */
  building: string;
  /** heading on the board */
  title: string;
  /** gold on the plaque; leave out to hide the plaque */
  gold?: number;
  tabs?: readonly CounterTab[];
}

const DOOR_SVG = `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M14 58V24a18 18 0 0 1 36 0v34z" fill="#5c3a24"/>
  <path d="M19 58V25a13 13 0 0 1 26 0v33z" fill="#f1d9a4"/><path d="M19 58V40l26-6v24z" fill="#e8b66f"/>
  <path d="M24 58V27a8 8 0 0 1 8-8l6 2v37z" fill="#8a5a34"/><circle cx="34" cy="41" r="2" fill="#e2b64a"/></svg>`;

export class Counter {
  readonly root: HTMLElement;
  /** the paper board: screens put their goods here */
  readonly board: HTMLElement;
  private readonly bubble: HTMLElement;
  private readonly bust: HTMLElement;
  private talking = 0;
  private closed = false;
  private readonly still = matchMedia('(prefers-reduced-motion: reduce)').matches;

  constructor(o: CounterOptions) {
    addFonts();
    const room = ROOM_AT[o.building] ?? 'training';
    this.root = document.createElement('div');
    this.root.className = `counter counter--${o.building}`;
    this.root.style.setProperty('--room', `url("${roomUrl(room)}")`);
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-modal', 'true');
    this.root.setAttribute('aria-label', o.title);
    this.root.innerHTML = `
      <div class="counter__vendor" aria-hidden="true"><img class="counter__face" alt=""><img class="counter__face counter__face--talk" alt=""></div>
      <div class="counter__bubble" role="status"><p class="counter__say"></p><div class="counter__who"></div></div>
      ${o.tabs?.length ? `<div class="counter__tabs" role="tablist">${o.tabs.map((t) => `<button type="button" role="tab" data-tab="${t.id}" aria-selected="false">${t.label}</button>`).join('')}</div>` : ''}
      <section class="counter__board"><h2 class="counter__title">${o.title}</h2><div class="counter__goods"></div></section>
      ${o.gold === undefined ? '' : '<div class="counter__gold"><span class="counter__coins" aria-hidden="true"><i></i><i></i><i></i></span><b></b><span class="sr">gold</span></div>'}
      <button type="button" class="counter__exit" data-act="exit" title="Leave (Esc)" aria-label="Leave">${DOOR_SVG}</button>`;
    document.body.append(this.root);
    this.board = this.root.querySelector<HTMLElement>('.counter__goods')!;
    this.bubble = this.root.querySelector<HTMLElement>('.counter__say')!;
    this.bust = this.root.querySelector<HTMLElement>('.counter__vendor')!;
    if (o.gold !== undefined) this.setGold(o.gold);

    const vendor = VENDOR_AT[o.building];
    if (!vendor) this.root.classList.add('counter--empty');
    else {
      void loadNpcs().then((npcs) => {
        const npc = npcs?.[vendor];
        if (!npc || this.closed) return;
        const [shut, open] = this.bust.querySelectorAll('img');
        shut.src = npcUrl(npc);
        open.src = npcUrl(npc, true);
        this.root.querySelector('.counter__who')!.innerHTML = `${npc.name} <small>${npc.role}</small>`;
      });
    }
  }

  /** the vendor says a line (the mouth moves while it lasts); `quiet` shows the text without talking */
  say(text: string, quiet = false) {
    this.bubble.textContent = text;
    if (quiet || this.still) return;
    const id = ++this.talking, start = performance.now(), length = talkTime(text);
    const flap = (now: number) => {
      if (id !== this.talking || this.closed) return;
      const t = (now - start) / 1000;
      this.bust.classList.toggle('talking', mouthOpen(t, length));
      if (t < length) requestAnimationFrame(flap);
      else this.bust.classList.remove('talking');
    };
    requestAnimationFrame(flap);
  }

  setGold(gold: number) {
    const b = this.root.querySelector('.counter__gold b');
    if (b) b.textContent = String(gold);
  }

  selectTab(id: string) {
    for (const t of this.root.querySelectorAll<HTMLButtonElement>('[role="tab"]')) t.setAttribute('aria-selected', String(t.dataset.tab === id));
  }

  close() {
    this.closed = true;
    this.root.remove();
  }
}

/** what each vendor says when a building's own screen opens in the counter frame */
const GREETING: Readonly<Record<string, string>> = {
  enchanter: 'Fire, water, ink or wind. Hand me the blade, and mind the drips.',
  temple: 'Every tear can be mended, child. Sit, and let the glue set.',
  forge: 'Bring me scraps and glue, and I’ll fold your gear stronger.',
  trainer: 'Sweat first, glory later. Where do the points go today?',
};

/**
 * Puts a building's own screen (enchanter, temple, forge, trainer, skills, leagues, trophies, gear) in the counter's
 * frame (#267): its room behind, the vendor big at the bottom left with a greeting, its panel turned into the paper
 * board on the right and the round door to leave. The door presses the screen's own Keep when it can, else Later/Close,
 * so every screen keeps its rules. Call it right after the screen adds its backdrop to the page.
 */
export function dressRoom(backdrop: HTMLElement, building: string) {
  addFonts();
  backdrop.classList.add('counter-room', `counter--${building}`);
  backdrop.style.setProperty('--room', `url("${roomUrl(ROOM_AT[building] ?? 'training')}")`);
  const vendor = VENDOR_AT[building];
  const parts = document.createElement('div');
  parts.className = 'counter-room__parts';
  parts.innerHTML = `${vendor ? `<div class="counter__vendor" aria-hidden="true"><img class="counter__face" alt=""><img class="counter__face counter__face--talk" alt=""></div>
    <div class="counter__bubble" role="status"><p class="counter__say">${GREETING[building] ?? ''}</p><div class="counter__who"></div></div>` : ''}
    <button type="button" class="counter__exit" title="Leave (Esc)" aria-label="Leave">${DOOR_SVG}</button>`;
  backdrop.prepend(parts);
  if (vendor) {
    void loadNpcs().then((npcs) => {
      const npc = npcs?.[vendor];
      if (!npc) return;
      const [shut, open] = parts.querySelectorAll('img');
      shut.src = npcUrl(npc);
      open.src = npcUrl(npc, true);
      parts.querySelector('.counter__who')!.innerHTML = `${npc.name} <small>${npc.role}</small>`;
    });
    // the greeting moves the mouth once
    const bust = parts.querySelector<HTMLElement>('.counter__vendor')!;
    const start = performance.now(), length = talkTime(GREETING[building] ?? '');
    const flap = (now: number) => {
      if (!bust.isConnected) return;
      const t = (now - start) / 1000;
      bust.classList.toggle('talking', mouthOpen(t, length));
      if (t < length) requestAnimationFrame(flap);
    };
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) requestAnimationFrame(flap);
  }
  parts.querySelector('.counter__exit')!.addEventListener('click', (e) => {
    e.stopPropagation();
    const keep = backdrop.querySelector<HTMLButtonElement>('[data-act="keep"]:not(:disabled)');
    const leave = backdrop.querySelector<HTMLButtonElement>('[data-act="later"], [data-act="close"], [data-act="leave"]');
    (keep ?? leave)?.click();
  });
}
