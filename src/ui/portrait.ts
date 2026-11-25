import { Container, Graphics } from 'pixi.js';
import type { Renderer } from 'pixi.js';
import { PaperRig } from '../rig/PaperRig';
import type { Kit, Look } from '../rig/PaperRig';

export interface PortraitOptions {
  /** window size in px */
  width: number;
  height: number;
  /** puppet size in px per rig unit (default: the window holds head and shoulders) */
  scale?: number;
  /** top edge of the window in rig units above the pelvis: room for crests and plumes (default 8.6) */
  top?: number;
  /** 1 looks right, -1 looks left (default 1) */
  facing?: 1 | -1;
  /** paper frame around the window (default true) */
  frame?: boolean;
}

/** Rig units across the window's centre line: the head sits a little in front of the pelvis. */
const CENTRE_X = 0.3;
const DEFAULT_TOP = 8.6;

/**
 * Head-and-shoulders cut of a still puppet (#25), for the comparison and result screens, shops and saves.
 * The puppet is drawn once into its texture and again only when the look changes (or the GPU context comes back),
 * never every frame: it does not join the scene's animated puppets.
 */
export class Portrait extends Container {
  readonly rig: PaperRig;
  private readonly options: Required<PortraitOptions>;
  private readonly listening = new AbortController();

  private constructor(kit: Kit, private readonly renderer: Renderer, options: PortraitOptions) {
    super();
    const { width, height } = options;
    this.options = {
      scale: height / 8.9, top: DEFAULT_TOP, facing: 1, frame: true, ...options,
    };
    const { scale, top, facing, frame } = this.options;
    if (frame) {
      this.addChild(new Graphics()
        .roundRect(-10, -10, width + 20, height + 20, 18)
        .fill({ color: 0x332124, alpha: 0.94 })
        .stroke({ color: 0x815a46, width: 3 })
        .roundRect(0, 0, width, height, 12)
        .fill(0x4b3a44));
    }
    this.rig = new PaperRig(kit, { scale, facing });
    const wu = width / scale;
    const hu = height / scale;
    this.rig.crop(CENTRE_X - wu / 2, top - hu, CENTRE_X + wu / 2, top);
    // a mirrored sprite grows to the left of its position, so a left-facing portrait hangs from the right edge
    this.rig.view.position.set(facing === 1 ? 0 : width, 0);
    this.addChild(this.rig.view);
    (renderer as { canvas?: HTMLCanvasElement }).canvas?.addEventListener('webglcontextrestored', () => {
      this.rig.invalidateStillFrame();
      this.draw();
    }, { signal: this.listening.signal });
  }

  /** A portrait of `look`, drawn and ready to add to the stage. */
  static async create(kit: Kit, renderer: Renderer, look: Look, options: PortraitOptions): Promise<Portrait> {
    const p = new Portrait(kit, renderer, options);
    await p.setLook(look);
    return p;
  }

  /** Show another look (one redraw once its textures are loaded). */
  async setLook(look: Look) {
    await this.rig.setLook(look);
    if (!this.destroyed) this.draw();
  }

  override destroy(options?: Parameters<Container['destroy']>[0]) {
    this.listening.abort();
    const texture = this.rig.view.texture;
    super.destroy(options);
    // the cropped texture shares the puppet's render texture: free both
    texture.destroy(true);
  }

  private draw() {
    this.rig.renderStill(this.renderer, this.rig.kit.json.pose_test);
  }
}
