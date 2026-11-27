/// <reference types="vite/client" />

import { textScale } from './textSize';
import { Tooltip } from './tooltip';
import type { TargetedAttack } from '../core/hitZones';
import type { CombatSlotAction, CombatSlotOption } from '../core/spells';
import { AIMS, AIM_INFO, aimDescription, aimedChance, aimedCommand } from './aimRules';
import type { Aim, AimInfo } from './aimRules';
import type { ActionOption, CombatAction } from '../core/types';
import { frameCss, loadUiSheet } from './uiSheet';
import type { UiSheet } from './uiSheet';
import './actionBar.css';

/** The cards in order, grouped as they sit on the bar. Aim (#195) and slot items (#191) have groups of their own. */
export const ACTION_GROUPS: readonly { title: string; actions: readonly CombatAction[] }[] = [
  { title: 'Move', actions: ['step_back', 'step_forward', 'jump', 'charge'] },
  { title: 'Attack', actions: ['quick', 'normal', 'power'] },
  { title: 'Other', actions: ['block', 'rest', 'taunt'] },
];

const ACTION_INFO = {
  step_forward: { label: 'Forward', description: 'Move one step toward the opponent.' },
  step_back: { label: 'Back', description: 'Move one step away from the opponent.' },
  jump: { label: 'Jump', description: 'Cover more ground than a step.' },
  charge: { label: 'Charge', description: 'Rush the opponent and strike.' },
  quick: { label: 'Quick', description: 'A light attack with a higher chance to hit.' },
  normal: { label: 'Normal', description: 'An attack with balanced damage and accuracy.' },
  power: { label: 'Power', description: 'A heavy attack with a lower chance to hit.' },
  block: { label: 'Block', description: 'Take a defensive stance against the next attack.' },
  rest: { label: 'Rest', description: 'Recover energy for later turns.' },
  taunt: { label: 'Taunt', description: 'Distract the opponent before their next action.' },
} satisfies Record<CombatAction, { label: string; description: string }>;

/** What each combat-slot item does, for its card's tooltip (numbers from core/spells.ts). */
const ITEM_INFO: Readonly<Record<CombatSlotOption['id'], string>> = {
  'glue-tonic': 'Drink to restore 12 health.',
  'repair-tape': 'Tape yourself up against the next blows.',
  staples: 'Restore 4 health and close a tear.',
  ember: 'Set the opponent on fire.',
  drench: 'Soak the opponent.',
};
const UNAVAILABLE_TEXT = { energy: 'Not enough energy.', arcana: 'Needs more Arcana.' } as const;

/** Keyboard key of the n-th card: 1–9, then 0. */
export const cardKey = (index: number) => String((index + 1) % 10);

/**
 * Where the bar may go, in CSS pixels: the gap between the HUD panels (`left`, `right`, `bottom`), or else the band
 * over the fighters' heads, from `ceiling` (below the top links) down to `floor` (the top of the tallest fighter).
 */
export interface BarSlot { left: number; right: number; bottom: number; ceiling: number; floor: number }

/** The bar's anchor point (bottom centre or top centre, by `edge`) and its scale. */
export interface BarPlace { x: number; y: number; edge: 'bottom' | 'top'; scale: number }

const SLOT_MARGIN = 10;
const MAX_SCALE = 1.25;
/** Below this the cards would be too small between the panels, so the bar moves over the fighters' heads. */
const MIN_SCALE_BETWEEN = 0.8;

/**
 * Where the bar goes and how large: between the HUD panels when it fits there; otherwise (a phone held sideways)
 * at the top, over the stands, as large as the screen width and the room above the fighters' heads allow.
 * Never over the fighters. A larger text size (#77) lets the cards grow as far as the room allows.
 */
export function placeBar(barWidth: number, barHeight: number, slot: BarSlot, screenWidth: number, textScale = 1): BarPlace {
  const between = (slot.right - slot.left - 2 * SLOT_MARGIN) / barWidth;
  if (between >= MIN_SCALE_BETWEEN) {
    return { x: (slot.left + slot.right) / 2, y: slot.bottom, edge: 'bottom', scale: Math.min(MAX_SCALE * textScale, between) };
  }
  const scale = Math.min(textScale, (screenWidth - 2 * SLOT_MARGIN) / barWidth, Math.max(0, slot.floor - slot.ceiling) / barHeight);
  return { x: screenWidth / 2, y: slot.ceiling, edge: 'top', scale: Math.max(0.5, scale) };
}

/**
 * The player's combat actions as a row of paper cards at the bottom of the screen (#147), between the HUD panels,
 * so nothing covers the fighters. Every action always has its card; ones the core does not allow now are faded.
 * Keys 1–9 and 0 pick a card, arrows move between cards, Enter picks the focused one.
 */
/** px width of the badge icon on a card (#16) */
const ICON_SIZE = 26;

export class ActionBar {
  private readonly element = document.createElement('div');
  private readonly tooltip = new Tooltip();
  private readonly cards = new Map<CombatAction, HTMLButtonElement>();
  private readonly order: CombatAction[] = ACTION_GROUPS.flatMap((g) => g.actions);
  private options = new Map<CombatAction, ActionOption>();
  private readonly listeners = new AbortController();
  private placed = '';
  /** the potions and spells in the fighter's combat slots (#191); the group is hidden when there are none */
  private readonly items = document.createElement('div');
  private readonly itemRow = document.createElement('div');
  private slots: readonly CombatSlotOption[] = [];
  /** where attacks go (#195); stays chosen from turn to turn */
  private aim: Aim = 'body';
  private aimInfo?: AimInfo;
  private readonly aimButtons = new Map<Aim, HTMLButtonElement>();
  /** the paper UI kit (#16) for the card icons; until it loads the cards show their names only */
  private sheet: UiSheet | null = null;

  constructor(private readonly onAction: (action: CombatAction | CombatSlotAction | TargetedAttack) => void) {
    this.element.className = 'action-bar';
    this.element.setAttribute('role', 'toolbar');
    this.element.setAttribute('aria-label', 'Combat actions');
    this.element.append(this.makeAimGroup());
    let index = 0;
    for (const group of ACTION_GROUPS) {
      const box = document.createElement('div');
      box.className = 'action-bar__group';
      const title = document.createElement('div');
      title.className = 'action-bar__title';
      title.textContent = group.title;
      const row = document.createElement('div');
      row.className = 'action-bar__row';
      for (const action of group.actions) row.append(this.makeCard(action, index++));
      box.append(title, row);
      this.element.append(box);
    }
    this.items.className = 'action-bar__group action-bar__group--items';
    this.itemRow.className = 'action-bar__row';
    const itemTitle = document.createElement('div');
    itemTitle.className = 'action-bar__title';
    itemTitle.textContent = 'Items';
    this.items.append(itemTitle, this.itemRow);
    this.items.hidden = true;
    this.element.append(this.items);
    this.close();
    document.body.append(this.element);
    window.addEventListener('keydown', this.onKey, { signal: this.listeners.signal });
    void loadUiSheet().then((s) => {
      this.sheet = s;
      for (const icon of this.element.querySelectorAll<HTMLElement>('.action-card__icon')) this.paintIcon(icon);
    });
  }

  /** an icon span gets its badge from the sheet (data-icon = frame key) once the sheet is there */
  private paintIcon(icon: HTMLElement) {
    const css = this.sheet && frameCss(this.sheet, icon.dataset.icon ?? '', ICON_SIZE);
    if (!css) return;
    Object.assign(icon.style, css);
    icon.hidden = false;
  }

  /**
   * The player's turn: these options can be picked, every other card is faded. `slots` are the items in the combat
   * slots; an unavailable one (energy, Arcana) is shown faded with the reason.
   */
  open(options: readonly ActionOption[], slots: readonly CombatSlotOption[] = [], aim?: AimInfo) {
    this.options = new Map(options.map((o) => [o.action, o]));
    this.aimInfo = aim;
    this.fillAim();
    for (const [action, card] of this.cards) this.fill(card, action, this.options.get(action));
    this.slots = slots;
    this.fillItems();
    const any = options.length > 0 || slots.some((s) => !s.unavailable);
    this.element.inert = !any;
    this.element.dataset.open = String(any);
  }

  close() {
    this.tooltip.hide();
    this.options = new Map();
    this.slots = [];
    this.element.inert = true;
    this.element.dataset.open = 'false';
  }

  /** Hide the whole bar between bouts, so it never lies over the result screen (#187). */
  setVisible(visible: boolean) {
    this.element.hidden = !visible;
  }

  /** Fit the bar between the HUD panels or over the fighters (screen pixels); cheap to call every frame. */
  place(slot: BarSlot) {
    const { x, y, edge, scale } = placeBar(this.element.offsetWidth, this.element.offsetHeight, slot, document.documentElement.clientWidth, textScale());
    const key = `${x.toFixed(1)} ${y.toFixed(1)} ${edge} ${scale.toFixed(3)}`;
    if (key === this.placed) return;
    this.placed = key;
    this.element.dataset.edge = edge;
    this.element.style.left = `${x}px`;
    this.element.style.top = `${y}px`;
    this.element.style.setProperty('--bar-scale', scale.toFixed(3));
  }

  destroy() {
    this.listeners.abort();
    this.tooltip.destroy();
    this.element.remove();
  }

  private makeCard(action: CombatAction, index: number) {
    const { label, description } = ACTION_INFO[action];
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'action-card';
    card.dataset.action = action;
    card.style.setProperty('--tilt', `${[-1.2, 0.8, -0.4, 1, -0.8, 0.5, -1, 0.7, -0.5, 1.1][index % 10]}deg`);
    card.innerHTML = `<span class="action-card__key" aria-hidden="true">${cardKey(index)}</span>`
      + `<span class="action-card__icon" data-icon="icon_${action}" aria-hidden="true" hidden></span>`
      + `<span class="action-card__label">${label}</span>`
      + '<span class="action-card__cost"></span><span class="action-card__stamp" aria-hidden="true"></span>';
    this.tooltip.attach(card, () => {
      const option = this.options.get(action);
      if (!option) return { title: label, description: `${description} Not possible now.` };
      return {
        title: option.counter ? `${label} · counter` : label,
        description: option.counter ? `${description} A counter-attack costs no energy.` : description,
        energyCost: option.energyCost, hitChance: option.hitChance,
      };
    });
    card.addEventListener('click', () => this.pick(action));
    this.cards.set(action, card);
    this.fill(card, action, undefined);
    return card;
  }

  private fill(card: HTMLButtonElement, action: CombatAction, option: ActionOption | undefined) {
    const { label } = ACTION_INFO[action];
    card.setAttribute('aria-disabled', String(!option));
    card.classList.toggle('counter', option?.counter === true);
    const cost = card.querySelector('.action-card__cost')!;
    cost.textContent = option ? (option.energyCost > 0 ? `${option.energyCost} EN` : 'free') : '';
    const hitChance = aimedChance(action, option, this.aim, this.aimInfo);
    const aimed = typeof aimedCommand(action, this.aim, this.aimInfo) !== 'string';
    card.classList.toggle('aimed', aimed);
    const stamp = card.querySelector<HTMLElement>('.action-card__stamp')!;
    stamp.textContent = hitChance === undefined ? '' : `${hitChance}%`;
    stamp.hidden = hitChance === undefined;
    const at = aimed ? ` at the ${AIM_INFO[this.aim].label.toLowerCase()}` : '';
    const chance = hitChance === undefined ? '' : `, ${hitChance}% to hit${at}`;
    card.setAttribute('aria-label', `${label}${chance}${option ? '' : ', not possible now'}`);
  }

  /** Body / Head / Torso / Legs: one is always pressed; keys B, H, T, L. */
  private makeAimGroup() {
    const box = document.createElement('div');
    box.className = 'action-bar__group action-bar__group--aim';
    const title = document.createElement('div');
    title.className = 'action-bar__title';
    title.textContent = 'Aim';
    const row = document.createElement('div');
    row.className = 'action-bar__row action-bar__aims';
    row.setAttribute('role', 'radiogroup');
    row.setAttribute('aria-label', 'Aim attacks at');
    for (const aim of AIMS) {
      const { label, key } = AIM_INFO[aim];
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'aim-toggle';
      b.dataset.aim = aim;
      b.setAttribute('role', 'radio');
      b.innerHTML = `<span class="aim-toggle__key" aria-hidden="true">${key}</span><span>${label}</span>`;
      this.tooltip.attach(b, () => ({
        title: aim === 'body' ? 'Body · no aim' : `Aim at the ${label.toLowerCase()}`,
        description: aimDescription(aim, this.aimInfo),
      }));
      b.addEventListener('click', () => this.setAim(aim));
      this.aimButtons.set(aim, b);
      row.append(b);
    }
    box.append(title, row);
    return box;
  }

  private setAim(aim: Aim) {
    if (this.element.inert) return;
    this.aim = aim;
    this.fillAim();
    for (const [action, card] of this.cards) this.fill(card, action, this.options.get(action));
  }

  private fillAim() {
    for (const [aim, b] of this.aimButtons) {
      b.setAttribute('aria-checked', String(aim === this.aim));
      b.tabIndex = aim === this.aim ? 0 : -1;
    }
  }

  /** One card per filled slot, in slot order; rebuilt each turn because quantities change. */
  private fillItems() {
    this.itemRow.replaceChildren();
    this.items.hidden = this.slots.length === 0;
    for (const option of this.slots) {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'action-card action-card--item';
      card.dataset.slot = String(option.slot);
      card.style.setProperty('--tilt', `${[0.9, -0.7, 1.1, -1][option.slot]}deg`);
      const usable = !option.unavailable;
      card.setAttribute('aria-disabled', String(!usable));
      const count = option.quantity === undefined ? '' : `×${option.quantity}`;
      card.innerHTML = '<span class="action-card__icon" data-icon="icon_item" aria-hidden="true" hidden></span>'
        + `<span class="action-card__label"></span><span class="action-card__cost">${usable ? (option.energyCost > 0 ? `${option.energyCost} EN` : 'free') : ''}</span>`
        + `<span class="action-card__stamp" aria-hidden="true"${count ? '' : ' hidden'}>${count}</span>`;
      card.querySelector('.action-card__label')!.textContent = option.name;
      this.paintIcon(card.querySelector<HTMLElement>('.action-card__icon')!);
      card.setAttribute('aria-label', `${option.name}${count ? `, ${option.quantity} left` : ''}${usable ? '' : `, ${UNAVAILABLE_TEXT[option.unavailable!].toLowerCase()}`}`);
      this.tooltip.attach(card, () => ({
        title: option.name,
        description: `${ITEM_INFO[option.id]}${count ? ` ${option.quantity} left.` : ''}${usable ? '' : ` ${UNAVAILABLE_TEXT[option.unavailable!]}`}`,
        energyCost: option.energyCost,
      }));
      card.addEventListener('click', () => this.pickItem(option));
      this.itemRow.append(card);
    }
  }

  private pickItem(option: CombatSlotOption) {
    if (this.element.inert || option.unavailable || !this.slots.includes(option)) return;
    this.close();
    this.onAction({ slot: option.slot, target: option.target });
  }

  private pick(action: CombatAction) {
    if (this.element.inert || !this.options.has(action)) return;
    const command = aimedCommand(action, this.aim, this.aimInfo);
    this.close();
    this.onAction(command);
  }

  private readonly onKey = (e: KeyboardEvent) => {
    if (this.element.inert || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target instanceof HTMLElement && e.target.closest('input, textarea, select, [contenteditable="true"]')) return;
    const aim = AIMS.find((a) => AIM_INFO[a].key.toLowerCase() === e.key.toLowerCase());
    if (aim) {
      e.preventDefault();
      this.setAim(aim);
      return;
    }
    if (/^[0-9]$/.test(e.key)) {
      const action = this.order[(+e.key + 9) % 10];
      if (action && this.options.has(action)) {
        e.preventDefault();
        this.pick(action);
      }
      return;
    }
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    // action cards, then item cards (they have no number key), skipping faded ones
    const open = [...this.element.querySelectorAll<HTMLButtonElement>('.action-card:not([aria-disabled="true"])')];
    if (open.length === 0) return;
    e.preventDefault();
    const at = open.indexOf(document.activeElement as HTMLButtonElement);
    const step = e.key === 'ArrowRight' ? 1 : -1;
    const next = at < 0 ? (step > 0 ? 0 : open.length - 1) : (at + step + open.length) % open.length;
    open[next].focus();
  };
}
