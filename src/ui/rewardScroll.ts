/// <reference types="vite/client" />
/**
 * The reward scroll after a won career fight (#43): gold, XP and forge materials (already paid), and a champion's weapon
 * to take or leave. Resolves true when the weapon is taken. Take has the focus; Escape closes the scroll only when there
 * is no weapon, so a prize is never left by accident. While open it takes every key.
 */
import type { FightReward } from '../core/rewards';
import type { Weapon } from '../data/weapons';
import { addFonts } from './counter';
import { materialsLine } from './rewardRules';
import './rewardScroll.css';

export function openRewardScroll(reward: FightReward, offer?: Weapon): Promise<boolean> {
  addFonts();
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'reward';
    const materials = materialsLine(reward.forgeMaterials);
    backdrop.innerHTML = `
      <div class="reward__scroll" role="dialog" aria-modal="true" aria-labelledby="rewardTitle">
        <h3 id="rewardTitle">Spoils</h3>
        <p class="reward__gold">+${reward.gold} gold</p>
        <p class="reward__line">+${reward.experience} XP</p>
        ${materials ? `<p class="reward__line">${materials}</p>` : ''}
        ${offer ? `<div class="reward__prize">
          <img src="${import.meta.env.BASE_URL}ui/weapons/${offer.family}${offer.tier}.png" alt="">
          <p class="reward__name">${offer.name}</p>
          <p class="reward__line">The champion's weapon · ${offer.damage} damage · level ${offer.minLevel}, ${offer.minMight} Might</p>
        </div>` : ''}
        <div class="reward__actions">${offer
          ? '<button type="button" class="main" data-take="true">Take</button><button type="button" data-take="false">Leave it</button>'
          : '<button type="button" class="main" data-take="false">Continue</button>'}</div>
      </div>`;
    const keys = new AbortController();
    const close = (take: boolean) => {
      keys.abort();
      backdrop.remove();
      resolve(take);
    };
    backdrop.addEventListener('click', (e) => {
      const button = (e.target as HTMLElement).closest('button');
      if (button) close(button.dataset.take === 'true');
    });
    window.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') {
        e.preventDefault();
        if (!offer) close(false);
      } else if (e.key === 'Tab' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        const buttons = [...backdrop.querySelectorAll('button')];
        buttons[(buttons.indexOf(document.activeElement as HTMLButtonElement) + 1) % buttons.length].focus();
      }
    }, { capture: true, signal: keys.signal });
    document.body.append(backdrop);
    backdrop.querySelector<HTMLButtonElement>('.main')!.focus();
  });
}
