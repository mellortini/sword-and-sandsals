/**
 * CombatPresenter: plays the events returned by `performAction` (src/core) on the arena.
 * Each step waits for its animation, so the next action can start only after `present()` resolves.
 * The hit result (damage number, BLOCK shield, MISS) appears on the clip's `hit` event frame, as in the reference.
 */
import type { Animator } from '../anim/Animator';
import type { CombatEvent, CombatState, Fighter, FighterSide, MoveKind } from '../core/types';
import { BlockShield, DamageSplat, FxLayer, MissText } from '../ui/fx';
import { forwardDelta, planSteps, screenX } from './combatPlan';
import type { Layout, Step } from './combatPlan';

export type { Layout } from './combatPlan';

type Fighters = Record<FighterSide, Fighter>;
type AttackEvent = Extract<CombatEvent, { type: 'attack' }>;
type CrowdGiftEvent = Extract<CombatEvent, { type: 'crowd_gift' }>;

/** core move kind -> clip name */
const MOVE_CLIP: Record<MoveKind, string> = {
  step_forward: 'walk_fwd', step_back: 'walk_back', jump: 'jump', charge: 'charge', knockback: 'knockback',
};

export interface PresenterOptions {
  fighters: Record<FighterSide, Animator>;
  fx: FxLayer;
  /** px per rig unit (the scene's UNIT) */
  unit: number;
  layout: Layout;
  /**
   * called whenever the shown health/energy/crowd change (feed it to CombatHud.setState);
   * `gifts` lists what the crowd threw during the action that just ended
   */
  onState?: (state: { fighters: Fighters; gifts?: readonly CrowdGiftEvent[] }) => void;
}

const other = (side: FighterSide): FighterSide => (side === 'player' ? 'enemy' : 'player');

export class CombatPresenter {
  private readonly o: PresenterOptions;
  private shown: Fighters | null = null;
  private running = false;
  private cancelled = false;
  private pending = new Set<() => void>();

  constructor(options: PresenterOptions) { this.o = options; }

  get busy() { return this.running; }

  /** stop the current `present()` (e.g. the scene is reset): pending animations stop being awaited */
  cancel() {
    this.cancelled = true;
    for (const resolve of [...this.pending]) resolve();
    this.pending.clear();
  }

  /** place both fighters at their logical positions without animation (start of a fight) */
  reset(state: CombatState) {
    this.shown = { player: { ...state.fighters.player }, enemy: { ...state.fighters.enemy } };
    for (const side of ['player', 'enemy'] as const) {
      const a = this.o.fighters[side];
      a.home.x = screenX(this.o.layout, side, state.fighters[side].position);
      a.play('idle', { blend: 0 });
    }
    this.o.fx.clear();
    this.emit();
  }

  /** play one action's events; `after` is the state performAction returned (used for the final HUD values) */
  async present(events: readonly CombatEvent[], after: CombatState): Promise<void> {
    if (!this.shown) this.reset(after);
    this.running = true;
    this.cancelled = false;
    try {
      // energy is paid before the move starts
      for (const e of events) if (e.type === 'energy' && e.to < e.from) this.setShown(e.fighter, { energy: e.to });
      for (const step of planSteps(events)) {
        if (this.cancelled) return;
        await this.play(step);
      }
      // rest refills energy at the end of its clip; also snap every value (crowd favour too) to the core's truth
      this.shown = { player: { ...after.fighters.player }, enemy: { ...after.fighters.enemy } };
      for (const side of ['player', 'enemy'] as const) {
        this.o.fighters[side].home.x = screenX(this.o.layout, side, after.fighters[side].position);
      }
      // the crowd reacts once the action has played out; a bouquet's health is already in `after`
      const gifts = events.filter((e): e is CrowdGiftEvent => e.type === 'crowd_gift');
      this.emit(gifts.length ? gifts : undefined);
    } finally {
      this.running = false;
    }
  }

  private emit(gifts?: readonly CrowdGiftEvent[]) {
    if (this.shown) this.o.onState?.(gifts ? { fighters: this.shown, gifts } : { fighters: this.shown });
  }

  private setShown(side: FighterSide, patch: Partial<Fighter>) {
    if (!this.shown) return;
    this.shown = { ...this.shown, [side]: { ...this.shown[side], ...patch } };
    this.emit();
  }

  private clip(anim: Animator, name: string, opts: Parameters<Animator['play']>[1] = {}): Promise<void> {
    // Another play() on the same Animator replaces this clip and its onEnd; cancel() releases such waits.
    return new Promise((resolve) => {
      const done = () => { this.pending.delete(done); resolve(); };
      this.pending.add(done);
      anim.play(name, { ...opts, onEnd: () => { opts.onEnd?.(); done(); } });
    });
  }

  private head(side: FighterSide) {
    const r = this.o.fighters[side].rig;
    return { x: r.view.x + 0.3 * this.o.unit * r.facing, y: r.view.y - 8.9 * this.o.unit };
  }

  /** defender's reaction on the attacker's hit frame; resolves when the reaction clip ends */
  private react(a: AttackEvent, fatal: boolean): Promise<void> {
    const def = this.o.fighters[a.target];
    const slot = a.target === 'player' ? 'p' : 'e';
    const h = this.head(a.target);
    const facingDef = def.rig.facing;
    if (!a.hit) {
      this.o.fx.show(slot, new MissText(), h.x + 34 * facingDef, h.y);
      return Promise.resolve();
    }
    if (a.blocked) {
      this.o.fx.show(slot + 'b', new BlockShield(), h.x - 30 * facingDef, h.y + 6);
      return this.clip(def, 'block');
    }
    this.o.fx.show(slot, new DamageSplat(a.damage, a.crit), h.x + 34 * facingDef, h.y);
    if (this.shown) this.setShown(a.target, { health: Math.max(0, this.shown[a.target].health - a.damage) });
    if (fatal) return this.clip(def, 'death', { then: null });
    // a charge pushes the defender back with its own move step (knockback), so only flinch here
    return a.kind === 'charge' ? Promise.resolve() : this.clip(def, 'hit');
  }

  private async play(step: Step): Promise<void> {
    const { fighters, unit } = this.o;
    switch (step.kind) {
      case 'move': {
        const anim = fighters[step.side];
        const px = (step.to - step.from) * this.o.layout.px;
        const distance = (forwardDelta(step.side, step.from, step.to) * this.o.layout.px) / unit;
        const target = anim.home.x + px;
        let reaction: Promise<void> = Promise.resolve();
        const strike = step.strike;
        await this.clip(anim, MOVE_CLIP[step.move], {
          commit: true, distance,
          onEvent: strike ? (e) => { if (e.type === 'hit') reaction = this.react(strike, step.fatal ?? false); } : undefined,
        });
        anim.home.x = target; // root motion is scaled to land here; snap away rounding drift
        await reaction;
        return;
      }
      case 'attack': {
        const anim = fighters[step.attack.actor];
        let reaction: Promise<void> = Promise.resolve();
        await this.clip(anim, `attack_${step.attack.kind}`, {
          blend: 1,
          onEvent: (e) => { if (e.type === 'hit') reaction = this.react(step.attack, step.fatal); },
        });
        await reaction;
        return;
      }
      case 'pose':
        await this.clip(fighters[step.side], step.clip);
        return;
      case 'death':
        // the loser already fell on the hit frame; the winner celebrates and holds the pose
        await this.clip(fighters[other(step.side)], 'victory', { then: null });
        return;
    }
  }
}
