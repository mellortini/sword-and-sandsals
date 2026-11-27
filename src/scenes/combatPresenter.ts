/**
 * CombatPresenter: plays the events returned by `performAction` (src/core) on the arena.
 * Each step waits for its animation, so the next action can start only after `present()` resolves.
 * The hit result (damage number, BLOCK shield, MISS) appears on the clip's `hit` event frame, as in the reference.
 */
import type { Animator } from '../anim/Animator';
import type { ClipEvent } from '../anim/clip';
import type { CombatEvent, CombatState, Fighter, FighterSide, MoveKind } from '../core/types';
import { BlockShield, DamageSplat, FxLayer, MissText } from '../ui/fx';
import { goreMode } from '../ui/gore';
import { woundStage } from '../rig/wounds';
import { PaperScraps } from '../ui/scraps';
import type { CrowdFx } from '../ui/crowdFx';
import type { CameraJuice } from '../ui/cameraJuice';
import { attachGroundFx } from '../ui/groundFx';
import { attachFoley, blowSound, playFoley } from '../audio/foley';
import type { CrowdAmbience } from '../audio/crowd';
import { playSever } from '../audio/sever';
import { MIN_LUNGE, STRIKE_GAP, forwardDelta, planSteps, screenX } from './combatPlan';
import type { Layout, Step } from './combatPlan';

export type { Layout } from './combatPlan';

type Fighters = Record<FighterSide, Fighter>;
type AttackEvent = Extract<CombatEvent, { type: 'attack' }>;
type MoveEvent = Extract<CombatEvent, { type: 'move' }>;
type CrowdGiftEvent =Extract<CombatEvent, { type: 'crowd_gift' }>;

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
  /** screen y of the sand: set it and landings, falls and blows kick up paper bits (#17) */
  floorY?: number;
  /** play the paper foley (#18): footsteps, swings, landings from the clips, and each blow's result */
  sound?: boolean;
  /** the crowd cheers a critical blow and the end of a bout */
  crowd?: CrowdAmbience;
  /** the painted stands come alive (#52): arms go up on a crit and a finishing blow, gifts fly onto the sand */
  crowdFx?: CrowdFx;
  /** the camera's juice (#75): a micro-zoom on a crit, a shake when a charge or a body hits the sand */
  camera?: CameraJuice;
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

  constructor(options: PresenterOptions) {
    this.o = options;
    if (options.floorY !== undefined) {
      for (const side of ['player', 'enemy'] as const) attachGroundFx(options.fighters[side], options.fx.ground, options.floorY);
    }
    if (options.sound) for (const side of ['player', 'enemy'] as const) attachFoley(options.fighters[side]);
    // statuses show on the bodies (#50): flames, wet stains, stars, tape
    for (const side of ['player', 'enemy'] as const) options.fx.status.attach(side, options.fighters[side].rig);
    if (options.camera) {
      const cam = options.camera;
      for (const side of ['player', 'enemy'] as const) {
        options.fighters[side].listeners.add((e, clip) => {
          if (e.type === 'impact') cam.shake(clip.startsWith('charge') ? 1 : 0.55);
        });
      }
    }
  }

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
      // a shield broken in the last bout is whole again (#273), and a cut-off arm is back (#275)
      const shield = state.fighters[side].shield;
      if (a.rig.look.armCut) void a.rig.setLook({ armCut: false });
      if (shield && a.rig.look.shield !== shield.tier) void a.rig.setLook({ shield: shield.tier });
      a.home.x = screenX(this.o.layout, side, state.fighters[side].position);
      a.play('idle', { blend: 0 });
    }
    this.o.fx.clear();
    this.o.crowdFx?.clear();
    this.showStatuses(state);
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
        // the guard ended with no blow (the opponent rested, moved, …): lower it now
        const anim = this.o.fighters[side];
        if (!after.fighters[side].guarding && anim.clip.startsWith('guard')) anim.play('idle');
      }
      // the crowd reacts once the action has played out; a bouquet's health is already in `after`
      const gifts = events.filter((e): e is CrowdGiftEvent => e.type === 'crowd_gift');
      this.showStatuses(after);
      this.showCrowd(after, gifts);
      this.emit(gifts.length ? gifts : undefined);
    } finally {
      this.running = false;
    }
  }

  /** the stands (#52): fans wave as the favour grows; a gift from the crowd flies to the fighter it is for */
  private showCrowd(state: CombatState, gifts: readonly CrowdGiftEvent[]) {
    const fx = this.o.crowdFx;
    if (!fx) return;
    fx.mood = Math.max(state.fighters.player.crowd.favour, state.fighters.enemy.crowd.favour) / 100;
    if (this.o.floorY === undefined) return;
    for (const g of gifts) fx.throw(g.gift, g.gift === 'coin' ? 3 : 1, this.o.fighters[g.fighter].rig.view.x, this.o.floorY);
  }

  private showStatuses(state: CombatState) {
    for (const side of ['player', 'enemy'] as const) this.o.fx.status.set(side, state.fighters[side].statuses);
  }

  /** the bodies show the health the bars show (#284); with gore off they stay unmarked */
  private showWounds() {
    if (!this.shown) return;
    for (const side of ['player', 'enemy'] as const) {
      const { health, stats } = this.shown[side];
      const stage = goreMode() === 'off' ? 1 : woundStage(health, stats.maxHealth);
      const rig = this.o.fighters[side].rig;
      if ((rig.look.wounds ?? 1) !== stage) void rig.setLook({ wounds: stage });
    }
  }

  private emit(gifts?: readonly CrowdGiftEvent[]) {
    this.showWounds();
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

  /** play a move clip so that its root motion carries the fighter from `from` to `to` */
  private move(side: FighterSide, move: MoveKind, from: number, to: number, onEvent?: (e: ClipEvent) => void): Promise<void> {
    const anim = this.o.fighters[side];
    const target = anim.home.x + (to - from) * this.o.layout.px;
    const distance = (forwardDelta(side, from, to) * this.o.layout.px) / this.o.unit;
    // root motion is scaled to land on the target; snap away rounding drift (only when the clip really ends)
    return this.clip(anim, MOVE_CLIP[move], { commit: true, distance, onEvent, onEnd: () => { anim.home.x = target; } });
  }

  /** defender's reaction on the attacker's hit frame; resolves when the reaction clip ends */
  private react(a: AttackEvent, fatal: boolean, push?: MoveEvent): Promise<void> {
    const def = this.o.fighters[a.target];
    const slot = a.target === 'player' ? 'p' : 'e';
    const h = this.head(a.target);
    const facingDef = def.rig.facing;
    if (this.o.sound) playFoley(blowSound(a, this.shown?.[a.actor].weapon?.family));
    if (a.hit && !a.blocked && (a.crit || fatal)) {
      this.o.crowd?.cheer(fatal ? 1.4 : 0.8);
      // a crit brings half the stands up, a finishing blow all of it, and they throw flowers and coins at the winner
      this.o.crowdFx?.cheer(fatal ? 1 : 0.5, h.x);
      this.o.camera?.punch(h.x, h.y, fatal ? 1.6 : 1);
      if (fatal && this.o.floorY !== undefined) {
        const winner = this.o.fighters[other(a.target)].rig.view.x;
        this.o.crowdFx?.throw('bouquet', 6, winner, this.o.floorY);
        this.o.crowdFx?.throw('coin', 5, winner, this.o.floorY);
      }
    }
    if (!a.hit) {
      this.o.fx.show(slot, new MissText(), h.x + 34 * facingDef, h.y);
      // the blow passes: the defender leans away from it and steps back in (#13)
      return this.clip(def, 'dodge');
    }
    const knockback = () => this.move(push!.fighter, push!.kind, push!.from, push!.to);
    if (a.blocked) {
      // a real shield (#273): what it lost, and at 0 it breaks and leaves the puppet's arm
      const s = a.shield;
      this.o.fx.show(slot + 'b', new BlockShield(s && { lost: s.from - s.to, broken: s.to === 0 }), h.x - 30 * facingDef, h.y + 6);
      if (s && this.shown?.[a.target].shield) {
        this.setShown(a.target, { shield: { ...this.shown[a.target].shield!, health: s.to } });
        if (s.to === 0) void def.rig.setLook({ shield: 0 });
      }
      return push ? knockback() : this.clip(def, 'block');
    }
    this.o.fx.show(slot, new DamageSplat(a.damage, a.crit), h.x + 34 * facingDef, h.y);
    if (a.severed) this.sever(a.target);
    if (this.shown) this.setShown(a.target, { health: Math.max(0, this.shown[a.target].health - a.damage) });
    if (fatal) return this.clip(def, 'death', { then: null });
    return push ? knockback() : this.clip(def, 'hit');
  }

  /**
   * The shield arm comes off (#275). With gore on, the forearm, hand and shield are gone at the elbow in a burst of
   * paper shreds (or red ink); with gore off the arm stays and the shield is knocked out of the hand.
   */
  private sever(side: FighterSide) {
    const rig = this.o.fighters[side].rig;
    const mode = goreMode();
    const elbow = rig.screenPoint('arm_b_lo');
    // the wet tear of the arm coming off; with gore off playSever stays silent
    if (this.o.sound) playSever(mode);
    if (this.o.floorY !== undefined) {
      const scraps = new PaperScraps(mode, this.o.floorY);
      this.o.fx.addScraps(scraps);
      scraps.burst({ ...elbow, count: mode === 'off' ? 18 : 30, angle: -Math.PI / 2 - 0.5 * rig.facing, spread: 1.3, speed: 22 });
      if (mode !== 'off') scraps.spray(() => rig.screenPoint('arm_b_up', 0, -1.7), 18);
    }
    if (mode === 'off') {
      const h = this.head(side);
      this.o.fx.show((side === 'player' ? 'p' : 'e') + 'b', new BlockShield({ lost: 0, broken: true }), h.x - 30 * rig.facing, h.y + 6);
      void rig.setLook({ shield: 0 });
    } else {
      void rig.setLook({ armCut: true, shield: 0 });
    }
    if (this.shown?.[side].shield) this.setShown(side, { shield: { ...this.shown[side].shield!, health: 0 } });
  }

  private async play(step: Step): Promise<void> {
    const { fighters, unit } = this.o;
    switch (step.kind) {
      case 'move': {
        let reaction: Promise<void> = Promise.resolve();
        const strike = step.strike;
        await this.move(step.side, step.move, step.from, step.to,
          strike ? (e) => { if (e.type === 'hit') reaction = this.react(strike, step.fatal ?? false, step.push); } : undefined);
        await reaction;
        return;
      }
      case 'attack': {
        const anim = fighters[step.attack.actor];
        let reaction: Promise<void> = Promise.resolve();
        // reach the same strike point from any melee distance (#151)
        const gap = Math.abs(fighters.enemy.home.x - fighters.player.home.x) / unit;
        await this.clip(anim, `attack_${step.attack.kind}`, {
          blend: 1,
          lunge: Math.max(MIN_LUNGE, gap - STRIKE_GAP[step.attack.kind]),
          onEvent: (e) => { if (e.type === 'hit') reaction = this.react(step.attack, step.fatal, step.push); },
        });
        await reaction;
        return;
      }
      case 'pose':
        // a raised guard is held (`guard`, looping) until a blow's reaction or the end of the guard lowers it (#273)
        await this.clip(fighters[step.side], step.clip, step.clip === 'guard_up' ? { then: 'guard' } : {});
        return;
      case 'item':
        // no own clip or pop-up yet: the user pauses as when resting and the target's bar moves when it ends
        await this.clip(fighters[step.side], step.side === step.target ? 'rest' : 'taunt');
        if (this.shown) this.setShown(step.target, { health: Math.max(0, this.shown[step.target].health + step.healthDelta) });
        return;
      case 'death':
        // the loser already fell on the hit frame; the winner celebrates and holds the pose
        await this.clip(fighters[other(step.side)], 'victory', { then: null });
        return;
    }
  }
}
