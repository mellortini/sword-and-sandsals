/**
 * Plays clips on a PaperRig: 30 fps sampling, blend-in from the previous pose, root motion, events, ground contact.
 * The fighter's world position is `home` (where its pelvis stands); root motion moves the view relative to it.
 * Clips that end with `commit` root x move `home` (walks / jumps / charges really travel).
 */
import type { PaperRig, Pose } from '../rig/PaperRig';
import { BLINK } from '../rig/expressions';
import { Baked, ClipEvent, lerpPose, sample } from './clip';
import { poseWithLooseHead } from './decap';

export const FPS = 30;
/** how far an attack may step back when the enemy stands inside the weapon's reach (units) */
const MAX_GIVE_GROUND = 1.2;

export interface PlayOpts {
  blend?: number;              // frames to blend from the current pose
  speed?: number;
  then?: string | null;        // clip after this one ends (default: idle)
  distance?: number;           // scales the clip's authored root x to travel exactly this far (units)
  lunge?: number;              // for clips that step in and back (attacks): the deepest forward x becomes this (units)
  commit?: boolean;            // keep the final root x (the fighter moved)
  onEvent?: (e: ClipEvent) => void;
  onEnd?: () => void;
}

export class Animator {
  readonly rig: PaperRig;
  clips: Record<string, Baked>;
  home = { x: 0, y: 0 };      // display px of the pelvis at rest
  unit: number;
  speed = 1;
  /** called for every event of every clip this Animator plays (effects that follow the fighter, e.g. ground fx #17) */
  readonly listeners = new Set<(e: ClipEvent, clip: string) => void>();
  /** blink now and then (#26); never during a held pose such as death */
  blinks = true;
  private blinkIn = BLINK.min + Math.random() * (BLINK.max - BLINK.min);
  private blinkLeft = 0;
  private cur: Baked;
  private frame = 0;
  private opts: PlayOpts = {};
  private from: { pose: Pose; x: number; y: number } | null = null;
  private last: { pose: Pose; x: number; y: number } = { pose: {}, x: 0, y: 0 };
  private fired = new Set<string>();
  private done = false;
  private baseLow: number;
  private xScale = 1;

  constructor(rig: PaperRig, clips: Record<string, Baked>, unit: number) {
    this.rig = rig;
    this.clips = clips;
    this.unit = unit;
    this.cur = clips.idle;
    this.baseLow = rig.soleLow(rig.kit.json.pose_test);
  }

  get clip() { return this.cur.name; }
  get busy() { return !this.cur.loop && !this.cur.hold; }

  /** weapon family of the rig's look ('sword3' -> 'sword', 'gladius' -> 'gladius') */
  private family(): string { return (this.rig.look.weapon ?? '').replace(/\d+$/, ''); }

  /** a clip, or its variant for the held weapon family (`attack_power@hammer`, #36) when there is one */
  clipFor(name: string): Baked | undefined {
    return this.clips[`${name}@${this.family()}`]
      ?? (this.rig.hasShield() ? this.clips[`${name}@shield`] : undefined)   // #38: block behind the shield
      ?? this.clips[name];
  }

  play(name: string, opts: PlayOpts = {}) {
    const c = this.clipFor(name);
    if (!c) throw new Error(`no clip ${name}`);
    this.from = { ...this.last };
    this.cur = c;
    this.frame = 0;
    this.opts = { blend: 3, then: 'idle', ...opts };
    this.fired.clear();
    this.done = false;
    const authored = c.full[c.full.length - 1].x;
    this.xScale = opts.distance !== undefined && Math.abs(authored) > 1e-6 ? opts.distance / authored : 1;
    if (opts.lunge !== undefined) {
      // a longer weapon (clip `reach`, e.g. the spear) hits from further away, so the body steps in that much less;
      // an enemy already inside that reach makes it thrust while giving a little ground instead of running him through
      const deepest = Math.max(...c.full.map((k) => k.x));
      if (deepest > 1e-6) this.xScale = Math.max(-MAX_GIVE_GROUND, opts.lunge - (c.reach ?? 0)) / deepest;
    }
  }

  /** advance by dt seconds and pose the rig */
  update(dt: number) {
    this.frame += dt * FPS * this.speed * (this.opts.speed ?? 1);
    const c = this.cur;
    let f = this.frame;
    if (c.loop) f = f % c.length;
    else if (f >= c.length) f = c.length;
    // events
    for (const e of c.events ?? []) {
      const id = `${e.f}:${e.type}`;
      if (f >= e.f && !this.fired.has(id)) {
        this.fired.add(id);
        this.opts.onEvent?.(e);
        for (const l of this.listeners) l(e, c.name);
      }
    }
    const s = sample(c, f);
    let x = s.x * this.xScale, y = s.y;
    let pose = s.pose;
    if (this.from && this.opts.blend && this.frame < this.opts.blend) {
      const t = this.frame / this.opts.blend;
      const k = t * t * (3 - 2 * t);
      pose = lerpPose(this.from.pose, pose, k);
      x = this.from.x + (x - this.from.x) * k;
      y = this.from.y + (y - this.from.y) * k;
    }
    this.last = { pose, x, y };
    // a blink shuts the lids for a few frames every 2-6 s, over whatever the clip does with the face
    this.blinkIn -= dt * this.speed;
    if (this.blinkIn <= 0) {
      this.blinkLeft = BLINK.shut;
      this.blinkIn = BLINK.min + Math.random() * (BLINK.max - BLINK.min);
    }
    if (this.blinkLeft > 0) {
      this.blinkLeft -= dt * this.speed;
      if (this.blinks && !c.hold) pose = { ...pose, eyes: 1 };
    }
    // grounded frames: lift / lower the pelvis so the lowest sole rests on the floor
    const yPos = s.air ? y : y + this.baseLow - this.rig.soleLow(pose);
    this.rig.pose = s.head ? poseWithLooseHead(pose, s.head, x, yPos, this.baseLow) : pose;
    const k = this.unit;
    this.rig.view.position.set(this.home.x + x * k * this.rig.facing, this.home.y - yPos * k);
    if (!c.loop && this.frame >= c.length && !this.done) { this.done = true; this.finish(); }
  }

  private finish() {
    const o = this.opts;
    if (o.commit) {
      this.home.x += this.last.x * this.unit * this.rig.facing;
      this.last = { ...this.last, x: 0 };
    }
    o.onEnd?.();
    if (this.cur.hold) return;
    if (o.then) this.play(o.then, { blend: 4, then: null });
  }
}
