/// <reference types="vite/client" />

import './tooltip.css';

export interface TooltipContent {
  title: string;
  description: string;
  energyCost?: number;
  hitChance?: number;
  /** the Block card (#274) */
  blockChance?: number;
  /** Rhythm a Master's technique spends (#295) */
  rhythmCost?: number;
}

const HOVER_DELAY = 300;
const HOLD_DELAY = 450;
const TOUCH_SLOP = 10;
const VIEWPORT_MARGIN = 8;
const ANCHOR_GAP = 8;
let nextId = 0;

export class Tooltip {
  private readonly element = document.createElement('div');
  private readonly title = document.createElement('strong');
  private readonly description = document.createElement('div');
  private readonly details = document.createElement('div');
  private readonly listeners = new AbortController();
  private readonly bindings = new Set<() => void>();
  private trigger: HTMLElement | null = null;
  private pending: { trigger: HTMLElement; timer: number } | null = null;

  constructor() {
    this.element.id = `paper-tooltip-${++nextId}`;
    this.element.className = 'paper-tooltip';
    this.element.setAttribute('role', 'tooltip');
    this.element.hidden = true;
    this.details.className = 'paper-tooltip__details';
    this.element.append(this.title, this.description, this.details);
    document.body.append(this.element);

    const { signal } = this.listeners;
    document.addEventListener('pointerdown', (event) => {
      const owner = this.pending?.trigger ?? this.trigger;
      if (owner && event.target instanceof Node && !owner.contains(event.target)) this.hide();
    }, { capture: true, signal });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') this.hide();
    }, { signal });
    window.addEventListener('resize', this.position, { signal });
    window.addEventListener('scroll', this.position, { capture: true, signal });
    window.visualViewport?.addEventListener('resize', this.position, { signal });
    window.visualViewport?.addEventListener('scroll', this.position, { signal });
  }

  attach(trigger: HTMLElement, content: TooltipContent | (() => TooltipContent)): () => void {
    const controller = new AbortController();
    const { signal } = controller;
    const show = () => this.show(trigger, typeof content === 'function' ? content() : content);
    let touch: { id: number; x: number; y: number } | null = null;
    let suppressClick = false;

    const cancelTouch = () => {
      touch = null;
      this.cancelPending(trigger);
    };

    trigger.addEventListener('pointerenter', (event) => {
      if (event.pointerType !== 'touch' && this.trigger !== trigger) this.schedule(trigger, HOVER_DELAY, show);
    }, { signal });
    trigger.addEventListener('pointerleave', (event) => {
      if (event.pointerType !== 'touch' && !trigger.matches(':focus-visible')) this.hideFor(trigger);
    }, { signal });
    trigger.addEventListener('focus', () => {
      if (trigger.matches(':focus-visible')) show();
    }, { signal });
    trigger.addEventListener('blur', () => this.hideFor(trigger), { signal });

    trigger.addEventListener('pointerdown', (event) => {
      if (event.pointerType === 'touch' && !event.isPrimary) return;
      suppressClick = false;
      if (event.pointerType !== 'touch') return;
      // A subsequent tap dismisses a visible tooltip while leaving its normal click available.
      if (this.trigger === trigger) {
        this.hideFor(trigger);
        return;
      }
      touch = { id: event.pointerId, x: event.clientX, y: event.clientY };
      this.schedule(trigger, HOLD_DELAY, () => {
        suppressClick = true;
        show();
      });
    }, { signal });
    trigger.addEventListener('pointermove', (event) => {
      if (touch?.id === event.pointerId && Math.hypot(event.clientX - touch.x, event.clientY - touch.y) > TOUCH_SLOP) {
        const wasPending = this.pending?.trigger === trigger;
        cancelTouch();
        if (!wasPending) this.hideFor(trigger);
      }
    }, { signal });
    trigger.addEventListener('pointerup', (event) => {
      if (touch?.id === event.pointerId) cancelTouch();
    }, { signal });
    trigger.addEventListener('pointercancel', (event) => {
      if (touch?.id !== event.pointerId) return;
      cancelTouch();
      this.hideFor(trigger);
    }, { signal });
    trigger.addEventListener('contextmenu', (event) => {
      if (touch || suppressClick) event.preventDefault();
    }, { signal });
    trigger.addEventListener('click', (event) => {
      if (!suppressClick || event.detail === 0) return;
      suppressClick = false;
      event.preventDefault();
      event.stopImmediatePropagation();
    }, { capture: true, signal });

    const detach = () => {
      controller.abort();
      this.hideFor(trigger);
      this.bindings.delete(detach);
    };
    this.bindings.add(detach);
    return detach;
  }

  hide() {
    this.cancelPending();
    if (this.trigger) this.describe(this.trigger, false);
    this.trigger = null;
    this.element.hidden = true;
  }

  destroy() {
    this.hide();
    this.listeners.abort();
    for (const detach of this.bindings) detach();
    this.element.remove();
  }

  private schedule(trigger: HTMLElement, delay: number, show: () => void) {
    this.hide();
    const timer = window.setTimeout(() => {
      this.pending = null;
      if (trigger.isConnected) show();
    }, delay);
    this.pending = { trigger, timer };
  }

  private cancelPending(trigger?: HTMLElement) {
    if (!this.pending || (trigger && this.pending.trigger !== trigger)) return;
    window.clearTimeout(this.pending.timer);
    this.pending = null;
  }

  private hideFor(trigger: HTMLElement) {
    this.cancelPending(trigger);
    if (this.trigger === trigger) this.hide();
  }

  private show(trigger: HTMLElement, content: TooltipContent) {
    this.hide();
    this.trigger = trigger;
    this.title.textContent = content.title;
    this.description.textContent = content.description;
    const details = [];
    if (content.energyCost !== undefined) details.push(`Energy: ${content.energyCost}`);
    if (content.hitChance !== undefined) details.push(`Hit chance: ${content.hitChance}%`);
    if (content.blockChance !== undefined) details.push(`Block chance: ${content.blockChance}%`);
    if (content.rhythmCost !== undefined) details.push(`Rhythm: ${content.rhythmCost}`);
    this.details.textContent = details.join(' · ');
    this.details.hidden = details.length === 0;
    this.element.hidden = false;
    this.position();
    this.describe(trigger, true);
  }

  private describe(trigger: HTMLElement, add: boolean) {
    const ids = new Set((trigger.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean));
    if (add) ids.add(this.element.id);
    else ids.delete(this.element.id);
    if (ids.size) trigger.setAttribute('aria-describedby', [...ids].join(' '));
    else trigger.removeAttribute('aria-describedby');
  }

  private readonly position = () => {
    if (!this.trigger) return;
    if (!this.trigger.isConnected) {
      this.hide();
      return;
    }

    const viewport = window.visualViewport;
    const left = viewport?.offsetLeft ?? 0;
    const top = viewport?.offsetTop ?? 0;
    const width = viewport?.width ?? document.documentElement.clientWidth;
    const height = viewport?.height ?? document.documentElement.clientHeight;
    this.element.style.maxWidth = `min(16rem, ${Math.max(0, width - VIEWPORT_MARGIN * 2)}px)`;
    this.element.style.maxHeight = `${Math.max(0, height - VIEWPORT_MARGIN * 2)}px`;

    const anchor = this.trigger.getBoundingClientRect();
    const { width: tooltipWidth, height: tooltipHeight } = this.element.getBoundingClientRect();
    const minX = left + VIEWPORT_MARGIN;
    const maxX = left + width - VIEWPORT_MARGIN - tooltipWidth;
    const minY = top + VIEWPORT_MARGIN;
    const maxY = top + height - VIEWPORT_MARGIN - tooltipHeight;
    const centerX = anchor.left + (anchor.width - tooltipWidth) / 2;
    const above = anchor.top - ANCHOR_GAP - tooltipHeight;
    const below = anchor.bottom + ANCHOR_GAP;
    const y = above >= minY ? above : below <= maxY ? below : (maxY - below > above - minY ? below : above);

    this.element.style.left = `${Math.max(minX, Math.min(maxX, centerX))}px`;
    this.element.style.top = `${Math.max(minY, Math.min(maxY, y))}px`;
  };
}
