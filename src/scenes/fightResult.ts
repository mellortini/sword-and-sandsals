import { Container, Graphics, Sprite, Text } from 'pixi.js';
import { createCombat, getActionOptions, performAction } from '../core/combat';
import { nextRandom } from '../core/rng';
import type { CombatEvent, CombatState } from '../core/types';
import type { SavedCharacter } from '../core/save';
import { summarizeFight, summaryRows } from '../ui/fightSummary';
import { xpSweeps } from '../ui/levelUpRules';
import type { FightProgress } from '../ui/levelUpRules';
import type { FightSummary } from '../ui/fightSummary';
import { paperButton, screenTitle } from '../ui/paperWidgets';
import { StatPanel } from '../ui/statPanel';
import { XpBar } from '../ui/xpBar';
import { H, W, randomLook } from './common';
import type { SceneContext, SceneUpdate } from './common';
import { PORTRAIT_H, PORTRAIT_W, portraitCard, removeRigs } from './portrait';
import type { PortraitSubject } from './portrait';
import { loadoutFromLook } from './preFight';

export type FightResultChoice = 'again' | 'leave';

export interface FightResult {
  readonly player: PortraitSubject;
  readonly enemy: PortraitSubject;
  /** `summarizeFight(events)` over every event of the fight; its `winner` decides Victory or Defeat */
  readonly summary: FightSummary;
  /** the saved gladiator's XP before and after this fight (#24); without it there is no XP bar */
  readonly progress?: FightProgress;
  /**
   * opens the level-up screen for the gladiator and resolves with it saved (or unchanged on Later);
   * the result screen offers it while the gladiator has unspent attribute points
   */
  readonly spendPoints?: (character: SavedCharacter) => Promise<SavedCharacter>;
}

const PANEL_W = 640;
const TOP = 196;

/**
 * Result screen over the finished arena: VICTORY / DEFEAT, both portraits (the loser dimmed and stamped),
 * the fight's numbers side by side, and Fight again / Leave. Rewards (gold, XP) come with #43.
 * Resolves with the choice and removes everything it added. Keyboard: Enter = Fight again, Escape = Leave.
 */
export async function openFightResult(context: SceneContext, result: FightResult): Promise<FightResultChoice> {
  const { world, rigs, add } = context;
  const { summary } = result;
  const won = summary.winner === 'player';
  const root = new Container();
  world.addChild(root);

  root.addChild(
    new Graphics().rect(0, 0, W, H).fill({ color: 0x1c1013, alpha: 0.72 }),
    screenTitle(won ? 'Victory' : 'Defeat', W / 2, 78, won ? '#f2c14e' : '#d8573f', 76),
    subtitle(`${won ? 'Won in' : 'Fell after'} ${summary.rounds} ${summary.rounds === 1 ? 'round' : 'rounds'}`, W / 2, 140),
  );

  const rigsBefore = rigs.length;
  const sideX = (W - PANEL_W) / 2 - PORTRAIT_W - 60;
  const enemyX = W - sideX - PORTRAIT_W;
  await portraitCard(root, add, result.player, won ? 'Winner' : 'Defeated', sideX, TOP, 1);
  await portraitCard(root, add, result.enemy, won ? 'Defeated' : 'Winner', enemyX, TOP, -1);
  const added = rigs.slice(rigsBefore);
  root.addChild(defeatedStamp(won ? enemyX : sideX, TOP));

  const panel = new StatPanel(summaryRows(summary), PANEL_W);
  panel.position.set((W - PANEL_W) / 2, TOP);
  root.addChild(panel);

  const buttonsY = TOP + PORTRAIT_H + 160;

  // XP bar under the numbers, then a button to place new attribute points once the bar reaches the new level
  let bar: XpBar | null = null;
  let tick: (() => void) | null = null;
  const { progress, spendPoints } = result;
  if (progress) {
    let gladiator = progress.after;
    bar = new XpBar(PANEL_W - 60, xpSweeps(progress.before, progress.after), progress.earned, (level) => `LEVEL ${level}`);
    bar.position.set((W - PANEL_W) / 2 + 30, TOP + panel.panelHeight + 26);
    root.addChild(bar);
    const ticker = context.app.ticker;
    const onTick = () => bar?.update(ticker.deltaMS / 1000);
    ticker.add(onTick);
    tick = () => ticker.remove(onTick);

    const spendY = TOP + panel.panelHeight + 120;
    let spend: Container | null = null;
    const offer = () => {
      spend?.destroy({ children: true });
      spend = null;
      const points = gladiator.attributePoints ?? 0;
      if (!spendPoints || points === 0) return;
      spend = paperButton(`Spend ${points} ${points === 1 ? 'point' : 'points'}`, W / 2, spendY, true, async () => {
        bar?.skip();
        gladiator = await spendPoints(gladiator);
        offer();
      }, 360);
      root.addChild(spend);
    };
    // points left from earlier fights can be spent at once; new ones appear with the LEVEL UP flash
    if ((progress.before.attributePoints ?? 0) > 0 || progress.after.level === progress.before.level) offer();
    bar.onLevelUp = () => offer();
  }

  return new Promise<FightResultChoice>((resolve) => {
    const keys = new AbortController();
    const done = (choice: FightResultChoice) => {
      keys.abort();
      tick?.();
      removeRigs(rigs, added);
      root.destroy({ children: true });
      resolve(choice);
    };
    root.addChild(
      paperButton('Fight again', W / 2 - 160, buttonsY, true, () => done('again'), 280),
      paperButton('Leave', W / 2 + 160, buttonsY, false, () => done('leave'), 280),
    );
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') done('again');
      else if (e.key === 'Escape') done('leave');
    }, { signal: keys.signal });
  });
}

function subtitle(s: string, x: number, y: number) {
  const t = new Text({ text: s, style: { fontFamily: 'Georgia', fontSize: 30, fill: '#f4d3a7', fontStyle: 'italic' } });
  t.anchor.set(0.5);
  t.position.set(x, y);
  return t;
}

/** dims the loser's portrait window and lays a tilted red ink stamp across it */
function defeatedStamp(x: number, y: number) {
  const c = new Container();
  c.addChild(new Graphics().roundRect(x, y, PORTRAIT_W, PORTRAIT_H, 12).fill({ color: 0x1c1013, alpha: 0.5 }));
  const stamp = new Container();
  const t = new Text({ text: 'DEFEATED', style: { fontFamily: 'Georgia', fontSize: 54, fontWeight: 'bold', fill: '#c8432f', letterSpacing: 4 } });
  t.anchor.set(0.5);
  const w = t.width + 44, h = t.height + 18;
  stamp.addChild(new Graphics().roundRect(-w / 2, -h / 2, w, h, 10).stroke({ color: 0xc8432f, width: 5 }), t);
  stamp.position.set(x + PORTRAIT_W / 2, y + PORTRAIT_H * 0.62);
  stamp.rotation = -0.22;
  stamp.alpha = 0.92;
  c.addChild(stamp);
  return c;
}

/** Both sides pick a random available action until someone falls (dev preview only, not the AI of #6). */
export function simulateFight(seed: number, start: CombatState): { state: CombatState; events: CombatEvent[] } {
  let state = start;
  let rng = seed >>> 0;
  const random = () => {
    const r = nextRandom(rng);
    rng = r.state;
    return r.value;
  };
  const events: CombatEvent[] = [];
  for (let i = 0; i < 500 && state.winner === null; i++) {
    const options = getActionOptions(state);
    const attacks = options.filter((o) => o.hitChance !== undefined);
    // lean on attacks so the preview fights end in a sensible number of rounds
    const pool = attacks.length > 0 && random() < 0.7 ? attacks : options;
    const pick = pool[Math.floor(random() * pool.length)];
    const result = performAction(state, pick.action);
    state = result.state;
    events.push(...result.events);
  }
  return { state, events };
}

/**
 * `?view=result[&tier=N][&outcome=victory|defeat][&seed=S]`: the arena with two random gladiators, an automatic core fight
 * (random actions) and the result screen over it. Fight again → a new automatic fight; Leave → the arena view.
 */
export async function showFightResult(context: SceneContext): Promise<SceneUpdate> {
  const { params } = context;
  const tp = params.get('tier');
  const tier = tp ? Math.min(10, Math.max(1, +tp)) : 1 + Math.floor(Math.random() * 10);
  const want = params.get('outcome');
  const player = { name: 'Player', look: randomLook(tier) };
  const enemy = { name: 'Varro the Creased', look: randomLook(tier) };
  // the arena itself now runs a live fight, so the preview only shows its backdrop
  context.world.addChild(new Sprite(context.bgTex));
  context.ui.innerHTML = '<a href="?view=arena">arena</a> · <a href="?view=prefight">przed walką</a> · '
    + '<a href="?view=result&outcome=victory">wygrana</a> · <a href="?view=result&outcome=defeat">przegrana</a>';

  const fight = (seed: number) => simulateFight(seed, createCombat(seed,
    { name: player.name, equipment: loadoutFromLook(player.look) },
    { name: enemy.name, equipment: loadoutFromLook(enemy.look) }));

  let seed = params.has('seed') ? Math.floor(+params.get('seed')!) : Math.floor(Math.random() * 1e9);
  void (async () => {
    for (;;) {
      let run = fight(seed);
      // look for the asked outcome on the next seeds
      for (let i = 0; want && i < 200 && run.state.winner !== (want === 'defeat' ? 'enemy' : 'player'); i++) run = fight(++seed);
      const choice = await openFightResult(context, { player, enemy, summary: summarizeFight(run.events) });
      if (choice === 'leave') {
        location.search = '?view=arena';
        return;
      }
      seed++;
    }
  })();
  return () => {};
}
