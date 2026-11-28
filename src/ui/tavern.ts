/// <reference types="vite/client" />
import {
  BET_STAKES, QUESTS, acceptQuest, betCard, claimQuest, placeBet, questReward, questState, tavernRumours,
} from '../core/quests';
import type { BetFighter, QuestId } from '../core/quests';
import type { SavedCharacter } from '../core/save';
import type { FighterSide } from '../core/types';
import { dressRoom } from './counter';
import './forge.css';
import './tavern.css';

/** 'trident4' -> 'trident' */
const family = (weapon: string) => weapon.replace(/\d+$/, '');

/**
 * The tavern "The Crooked Fredi" (#65, docs/SCENARIUSZ.md): rumours, three side tasks (taken here, done in the arena, paid here) and bets on
 * tonight's bout between two other gladiators, fought out at once by the combat core. Every choice is saved at once:
 * a lost bet cannot be taken back by leaving, so the screen has only Leave (and Escape).
 */
export function openTavern(character: SavedCharacter, save: (character: SavedCharacter) => Promise<void>): Promise<SavedCharacter> {
  const backdrop = document.createElement('div');
  backdrop.className = 'forge tavern';
  backdrop.innerHTML = `
    <div class="forge__panel tavern__panel" role="dialog" aria-modal="true" aria-labelledby="tvTitle">
      <div class="forge__head">
        <h3 id="tvTitle">The Crooked Fredi</h3>
        <div class="forge__name">${escapeHtml(character.name)} · level ${character.level}</div>
        <div class="tavern__gold">Gold <b id="tvGold"></b></div>
      </div>
      <section aria-label="Rumours"><h4>Overheard</h4><ul class="tavern__rumours" id="tvRumours"></ul></section>
      <section aria-label="Side tasks"><h4>Asked of you</h4><div class="tavern__quests" id="tvQuests"></div></section>
      <section aria-label="Bets"><h4>Adi’s book: tonight’s bout</h4><div class="tavern__bet" id="tvBet"></div>
        <div class="tavern__result" id="tvResult" role="status"></div></section>
      <div class="forge__problem" id="tvProblem" role="status"></div>
      <div class="forge__actions"><button type="button" data-act="leave">Leave</button></div>
    </div>`;
  document.body.append(backdrop);
  // the building's counter frame: room and door (#267); the tavern has no vendor of its own yet
  dressRoom(backdrop, 'tavern');

  const $ = (id: string) => backdrop.querySelector<HTMLElement>(`#${id}`)!;
  let current = character;
  let busy = false;

  const questCard = (id: QuestId) => {
    const q = QUESTS.find((x) => x.id === id)!;
    const state = questState(current, id);
    const button = state === 'open' ? `<button type="button" class="tavern__do" data-act="take" data-quest="${id}">Take it</button>`
      : state === 'accepted' ? '<button type="button" class="tavern__do" aria-disabled="true">In the arena…</button>'
        : state === 'completed' ? `<button type="button" class="tavern__do" data-act="claim" data-quest="${id}">Collect ${questReward(current.level)} gold</button>`
          : '<button type="button" class="tavern__do" aria-disabled="true">Paid</button>';
    return `<section class="forge-item tavern-quest tavern-quest--${state}" style="--glow:${state === 'completed' ? 0.6 : 0}" aria-label="${q.title}">
      <div class="forge-item__title"><span class="forge-item__name">${q.title}</span></div>
      <div class="tavern-quest__giver">${q.giver}:</div>
      <div>“${q.text}”</div>
      <div class="tavern-quest__goal">${q.goal}</div>
      <div class="tavern-quest__buttons">${button}</div>
    </section>`;
  };

  const side = (s: FighterSide, f: BetFighter) => `<section class="forge-item tavern-side" style="--glow:0" aria-label="${escapeHtml(f.name)}">
      <div class="forge-item__title"><span class="forge-item__name">${escapeHtml(f.name)}</span><span class="forge-item__tier">level ${f.level}</span></div>
      <div class="tavern-side__line">${f.profile === 'aggressor' ? 'Presses hard' : 'Waits and counters'} · ${family(f.weapon)}</div>
      <div>Pays <b>×${f.odds.toFixed(1)}</b></div>
      <div class="tavern-side__stakes">${BET_STAKES.map((stake) => `<button type="button" class="tavern__do" data-act="bet" data-side="${s}"
        data-stake="${stake}" aria-disabled="${current.gold < stake}" aria-label="Bet ${stake} gold on ${escapeHtml(f.name)}">${stake}</button>`).join('')}</div>
    </section>`;

  const refresh = (focus?: string) => {
    $('tvGold').textContent = String(current.gold);
    $('tvRumours').innerHTML = tavernRumours(current).map((r) => `<li>${escapeHtml(r)}</li>`).join('');
    $('tvQuests').innerHTML = QUESTS.map((q) => questCard(q.id)).join('');
    const card = betCard(current);
    $('tvBet').innerHTML = `${side('player', card.fighters.player)}<span class="tavern__vs">vs</span>${side('enemy', card.fighters.enemy)}`;
    if (focus) backdrop.querySelector<HTMLElement>(focus)?.focus();
  };

  /** keep a change: saved at once, then shown */
  const commit = async (next: SavedCharacter, focus: string): Promise<boolean> => {
    busy = true;
    try {
      await save(next);
      current = next;
      $('tvProblem').textContent = '';
      refresh(focus);
      return true;
    } catch {
      $('tvProblem').textContent = 'The game could not be saved. Try again.';
      return false;
    } finally {
      busy = false;
    }
  };

  return new Promise((resolve) => {
    const keys = new AbortController();
    const close = () => {
      keys.abort();
      backdrop.remove();
      resolve(current);
    };
    backdrop.addEventListener('click', async (e) => {
      const button = (e.target as HTMLElement).closest('button');
      if (!button || busy || button.getAttribute('aria-disabled') === 'true') return;
      const act = button.dataset.act;
      const quest = button.dataset.quest as QuestId | undefined;
      if (act === 'leave') close();
      else if (act === 'take' && quest) await commit(acceptQuest(current, quest), '#tvQuests .tavern__do:not([aria-disabled="true"])');
      else if (act === 'claim' && quest) {
        const { character: paid, gold } = claimQuest(current, quest);
        if (await commit(paid, '#tvQuests .tavern__do:not([aria-disabled="true"])')) $('tvResult').textContent = `The task is paid: ${gold} gold.`;
      } else if (act === 'bet') {
        const s = button.dataset.side as FighterSide;
        const stake = Number(button.dataset.stake);
        const names = betCard(current).fighters;
        const bet = placeBet(current, s, stake);
        if (!bet.ok) {
          $('tvProblem').textContent = bet.reason === 'insufficient-gold' ? 'Not enough gold.' : 'The bookmaker does not take that stake.';
          return;
        }
        if (await commit(bet.character, `[data-side="${s}"][data-stake="${stake}"]`)) {
          $('tvResult').textContent = `${names[bet.winner].name} won. `
            + (bet.won ? `You collect ${bet.payout} gold.` : `Your ${stake} gold stays with Adi. “Trust Adi.”`);
        }
      }
    });
    window.addEventListener('keydown', (e) => {
      e.stopImmediatePropagation();
      if (e.key === 'Escape') close();
      else if (e.key.startsWith('Arrow')) {
        e.preventDefault();
        const buttons = [...backdrop.querySelectorAll<HTMLButtonElement>('.tavern__do:not([aria-disabled="true"]), [data-act="leave"]')];
        const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
        const step = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : -1;
        buttons[at < 0 ? 0 : Math.max(0, Math.min(buttons.length - 1, at + step))]?.focus();
      }
    }, { capture: true, signal: keys.signal });
    refresh('.tavern__do:not([aria-disabled="true"])');
  });
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
