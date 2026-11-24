/// <reference types="vite/client" />

import { Tooltip } from './tooltip';
import type { ActionOption, CombatAction } from '../core/types';
import './radialMenu.css';

const ACTION_INFO = {
  step_forward: { label: 'Forward', icon: '→', description: 'Move one step toward the opponent.' },
  step_back: { label: 'Back', icon: '←', description: 'Move one step away from the opponent.' },
  jump: { label: 'Jump', icon: '↑', description: 'Cover more ground than a step.' },
  charge: { label: 'Charge', icon: '»', description: 'Rush the opponent and strike.' },
  quick: { label: 'Quick', icon: '›', description: 'A light attack with a higher chance to hit.' },
  normal: { label: 'Normal', icon: '✦', description: 'An attack with balanced damage and accuracy.' },
  power: { label: 'Power', icon: '✸', description: 'A heavy attack with a lower chance to hit.' },
  block: { label: 'Block', icon: '◈', description: 'Take a defensive stance against the next attack.' },
  rest: { label: 'Rest', icon: '+', description: 'Recover energy for later turns.' },
  taunt: { label: 'Taunt', icon: '!', description: 'Distract the opponent before their next action.' },
} satisfies Record<CombatAction, { label: string; icon: string; description: string }>;

const MENU_GUTTER = 38;
/** half a button (64px, radialMenu.css) plus a small gap: how far a button reaches below its centre */
const BUTTON_REACH = 36;
const clampAnchor = (value: number, radius: number, extent: number) => {
  const inset = Math.min(extent / 2, radius + MENU_GUTTER);
  return Math.max(inset, Math.min(extent - inset, value));
};

export class RadialMenu {
  private readonly element = document.createElement('div');
  private readonly tooltip = new Tooltip();
  private readonly detachTooltips: (() => void)[] = [];
  private buttons: HTMLButtonElement[] = [];
  private radiusX = 0;
  private radiusY = 0;

  constructor(private readonly onAction: (action: CombatAction) => void) {
    this.element.className = 'radial-menu';
    this.element.setAttribute('role', 'group');
    this.element.setAttribute('aria-label', 'Combat actions');
    this.close();
    document.body.append(this.element);
  }

  open(options: readonly ActionOption[]) {
    this.detachButtons();
    this.buttons = options.map((option) => this.makeButton(option));
    this.element.replaceChildren(...this.buttons);
    this.placeButtons();
    this.element.inert = options.length === 0;
    this.element.dataset.open = String(options.length > 0);
  }

  close() {
    this.tooltip.hide();
    this.element.inert = true;
    this.element.dataset.open = 'false';
  }

  /**
   * Centre the ring on (x, y) in page px. `bottom` is the lowest page y the buttons may reach (the top of the HUD
   * panels), so on a short phone screen the ring moves up instead of covering the health and energy flasks.
   */
  setAnchor(x: number, y: number, scale: number, bottom = Infinity) {
    const width = document.documentElement.clientWidth;
    const height = document.documentElement.clientHeight;
    const rx = Math.min(Math.max(0, width / 2 - MENU_GUTTER), Math.max(124, 192 * scale));
    const ry = Math.min(Math.max(0, height / 2 - MENU_GUTTER), Math.max(84, 158 * scale));
    if (rx !== this.radiusX || ry !== this.radiusY) {
      this.radiusX = rx;
      this.radiusY = ry;
      this.placeButtons();
    }
    this.element.style.left = `${clampAnchor(x, rx, width)}px`;
    const top = Math.max(Math.min(ry + MENU_GUTTER, height / 2), Math.min(y, bottom - ry - BUTTON_REACH));
    this.element.style.top = `${clampAnchor(top, ry, height)}px`;
  }

  destroy() {
    this.detachButtons();
    this.tooltip.destroy();
    this.element.remove();
  }

  private detachButtons() {
    for (const detach of this.detachTooltips) detach();
    this.detachTooltips.length = 0;
  }

  private placeButtons() {
    this.buttons.forEach((button, index) => {
      const angle = -Math.PI / 2 + (index + 0.5) * 2 * Math.PI / this.buttons.length;
      button.style.setProperty('--action-x', `${Math.cos(angle) * this.radiusX}px`);
      button.style.setProperty('--action-y', `${Math.sin(angle) * this.radiusY}px`);
    });
  }

  private makeButton({ action, energyCost, hitChance }: ActionOption) {
    const { label, icon, description } = ACTION_INFO[action];
    const button = document.createElement('button');
    button.className = 'radial-menu__button';
    button.type = 'button';

    const symbol = document.createElement('span');
    symbol.className = 'radial-menu__icon';
    symbol.setAttribute('aria-hidden', 'true');
    symbol.textContent = icon;
    const caption = document.createElement('span');
    caption.textContent = hitChance === undefined ? label : `${label} ${hitChance}%`;
    button.append(symbol, caption);
    this.detachTooltips.push(this.tooltip.attach(button, { title: label, description, energyCost, hitChance }));

    button.addEventListener('click', () => {
      if (this.element.inert) return;
      this.close();
      this.onAction(action);
    });
    return button;
  }
}
