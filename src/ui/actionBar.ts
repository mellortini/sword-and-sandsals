/// <reference types="vite/client" />

import { textScale } from './textSize';
import { Tooltip } from './tooltip';
import type { ActionOption, CombatAction } from '../core/types';
import './actionBar.css';

/** The cards in order, grouped as they sit on the bar. Zones (#48) and spell slots (#55) will get groups of their own. */
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
export class ActionBar {
  private readonly element = document.createElement('div');
  private readonly tooltip = new Tooltip();
  private readonly cards = new Map<CombatAction, HTMLButtonElement>();
  private readonly order: CombatAction[] = ACTION_GROUPS.flatMap((g) => g.actions);
  private options = new Map<CombatAction, ActionOption>();
  private readonly listeners = new AbortController();
  private placed = '';

  constructor(private readonly onAction: (action: CombatAction) => void) {
    this.element.className = 'action-bar';
    this.element.setAttribute('role', 'toolbar');
    this.element.setAttribute('aria-label', 'Combat actions');
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
    this.close();
    document.body.append(this.element);
    window.addEventListener('keydown', this.onKey, { signal: this.listeners.signal });
  }

  /** The player's turn: these options can be picked, every other card is faded. */
  open(options: readonly ActionOption[]) {
    this.options = new Map(options.map((o) => [o.action, o]));
    for (const [action, card] of this.cards) this.fill(card, action, this.options.get(action));
    this.element.inert = options.length === 0;
    this.element.dataset.open = String(options.length > 0);
  }

  close() {
    this.tooltip.hide();
    this.options = new Map();
    this.element.inert = true;
    this.element.dataset.open = 'false';
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
    const stamp = card.querySelector<HTMLElement>('.action-card__stamp')!;
    stamp.textContent = option?.hitChance === undefined ? '' : `${option.hitChance}%`;
    stamp.hidden = option?.hitChance === undefined;
    const chance = option?.hitChance === undefined ? '' : `, ${option.hitChance}% to hit`;
    card.setAttribute('aria-label', `${label}${chance}${option ? '' : ', not possible now'}`);
  }

  private pick(action: CombatAction) {
    if (this.element.inert || !this.options.has(action)) return;
    this.close();
    this.onAction(action);
  }

  private readonly onKey = (e: KeyboardEvent) => {
    if (this.element.inert || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target instanceof HTMLElement && e.target.closest('input, textarea, select, [contenteditable="true"]')) return;
    if (/^[0-9]$/.test(e.key)) {
      const action = this.order[(+e.key + 9) % 10];
      if (action && this.options.has(action)) {
        e.preventDefault();
        this.pick(action);
      }
      return;
    }
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const open = this.order.filter((a) => this.options.has(a));
    if (open.length === 0) return;
    e.preventDefault();
    const at = open.findIndex((a) => this.cards.get(a) === document.activeElement);
    const step = e.key === 'ArrowRight' ? 1 : -1;
    const next = at < 0 ? (step > 0 ? 0 : open.length - 1) : (at + step + open.length) % open.length;
    this.cards.get(open[next])!.focus();
  };
}
