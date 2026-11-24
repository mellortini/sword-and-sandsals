import { goToTitle, onEscape } from './backKey';
import './leaveFight.css';

/**
 * Asks before leaving a fight in progress (#174): Leave resolves true, Stay (or Escape, or a click outside) false.
 * Stay has the focus, so a stray Enter keeps the fight going. While open it takes every key, so the action bar's
 * number keys cannot pick an action underneath.
 */
export function askLeaveFight(): Promise<boolean> {
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'leave-fight';
    backdrop.innerHTML = `
      <div class="leave-fight__panel" role="alertdialog" aria-modal="true" aria-labelledby="leaveFightTitle">
        <h3 id="leaveFightTitle">Leave the fight?</h3>
        <p>The bout ends here and you return to the title.</p>
        <div class="leave-fight__actions"><button type="button" data-leave="true">Leave</button><button type="button" class="stay" data-leave="false">Stay</button></div>
      </div>`;
    const keys = new AbortController();
    const close = (leave: boolean) => {
      keys.abort();
      backdrop.remove();
      resolve(leave);
    };
    backdrop.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest('button');
      if (b) close(b.dataset.leave === 'true');
      else if (e.target === backdrop) close(false);
    });
    window.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') {
        e.preventDefault();
        close(false);
      } else if (e.key === 'Tab' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        const buttons = [...backdrop.querySelectorAll('button')];
        buttons[(buttons.indexOf(document.activeElement as HTMLButtonElement) + 1) % buttons.length].focus();
      }
    }, { capture: true, signal: keys.signal });
    document.body.append(backdrop);
    backdrop.querySelector<HTMLButtonElement>('.stay')!.focus();
  });
}

/** Escape during a fight (while `fighting()` holds) asks before leaving; Leave goes to the title. */
export function leaveFightOnEscape(fighting: () => boolean) {
  let asking = false;
  onEscape(() => {
    asking = true;
    void askLeaveFight().then((leave) => {
      asking = false;
      if (leave) goToTitle();
    });
  }, { when: () => fighting() && !asking });
}
