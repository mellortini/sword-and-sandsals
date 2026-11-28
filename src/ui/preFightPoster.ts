/**
 * The pre-fight screen's poster: who fights whom and the comparison printed on the torn sheet (posterStage.ts), the
 * champion's line in a speech bubble, the prize, and two ways on: Fight, or back. The gladiators stand in the Pixi
 * scene under it (src/scenes/preFight.ts). Keyboard (#77): ←/→ choose, Enter presses (Fight first), Escape goes back.
 */
import { moveSelection } from './menuNav';
import { posterSheet, posterStage, uiArt } from './posterStage';
import type { StatRow } from './statRows';
import './preFightPoster.css';

export type PreFightChoice = 'fight' | 'leave';

export interface PreFightPrize {
  readonly name: string;
  readonly damage: number;
  /** a picture under assets/ui */
  readonly picture: string;
}

export interface PreFightPoster {
  /** the kind of bout: "Arena bout", "Champion bout"… */
  readonly title: string;
  readonly player: string;
  readonly enemy: string;
  /** a line under the opponent's name: the feud with a nemesis */
  readonly enemyNote?: string;
  /** what the opponent says before the bout */
  readonly quote?: string;
  readonly prize?: PreFightPrize;
  readonly rows: readonly StatRow[];
  /** where the way back leads, on its button */
  readonly back: string;
}

const escapeHtml = (text: string) => text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

function tableHtml(rows: readonly StatRow[]): string {
  const cell = (value: string, better: boolean, who: string) =>
    `<td class="bout-poster__value${better ? ' bout-poster__value--better' : ''}" data-who="${who}"><span>${escapeHtml(value)}</span></td>`;
  return `<table><tbody>${rows.map((r) =>
    `<tr>${cell(r.player, r.edge === 'player', 'player')}<th scope="row">${r.label}</th>${cell(r.enemy, r.edge === 'enemy', 'enemy')}</tr>`).join('')}</tbody></table>`;
}

/** Shows the poster and resolves with the player's choice; the poster is gone by then. */
export function showPreFightPoster(bout: PreFightPoster): Promise<PreFightChoice> {
  const print = `
    <p class="bout-poster__kicker">${escapeHtml(bout.title)}</p>
    <h1>${escapeHtml(bout.player)}</h1>
    <p class="bout-poster__against">against</p>
    <h1>${escapeHtml(bout.enemy)}</h1>
    ${bout.enemyNote ? `<p class="bout-poster__note">${escapeHtml(bout.enemyNote)}</p>` : ''}
    ${tableHtml(bout.rows)}`;
  const { stage, remove } = posterStage(`bout-stage${bout.enemyNote ? ' bout-stage--note' : ''}`, `
    <div class="poster-post" aria-hidden="true"></div>
    ${posterSheet('bout-poster', print)}
    ${bout.quote ? `<blockquote class="bout-quote"><p>${escapeHtml(bout.quote)}</p><cite>${escapeHtml(bout.enemy)}</cite></blockquote>` : ''}
    ${bout.prize ? `<div class="bout-prize"><img src="${uiArt(bout.prize.picture)}" alt="">
      <span>Prize for the win · damage ${bout.prize.damage}<b>${escapeHtml(bout.prize.name)}</b></span></div>` : ''}
    <div class="bout-actions">
      <button type="button" class="bout-back" data-choice="leave">← ${escapeHtml(bout.back)}</button>
      <button type="button" class="bout-fight" data-choice="fight">Fight</button>
    </div>`);
  const buttons = [...stage.querySelectorAll<HTMLButtonElement>('.bout-actions button')];
  const enabled = buttons.map((b) => ({ label: b.textContent!, enabled: true }));
  let selected = buttons.findIndex((b) => b.dataset.choice === 'fight');

  return new Promise((resolve) => {
    const keys = new AbortController();
    const done = (choice: PreFightChoice) => {
      keys.abort();
      remove();
      resolve(choice);
    };
    buttons.forEach((b, i) => {
      b.addEventListener('focus', () => { selected = i; });
      b.addEventListener('pointerenter', () => b.focus({ preventScroll: true }));
      b.addEventListener('click', () => done(b.dataset.choice as PreFightChoice));
    });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        selected = moveSelection(enabled, selected, e.key === 'ArrowRight' ? 1 : -1);
        buttons[selected].focus({ preventScroll: true });
      } else if (e.key === 'Enter' && !e.repeat) done(buttons[selected].dataset.choice as PreFightChoice);
      else if (e.key === 'Escape') done('leave');
      else return;
      e.preventDefault();
    }, { signal: keys.signal });
    buttons[selected].focus({ preventScroll: true });
  });
}
