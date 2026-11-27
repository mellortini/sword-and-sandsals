import { Container, Graphics, Sprite, Text } from 'pixi.js';
import type { CrowdGift } from '../core/crowd';
import { CrowdMeter } from './crowdMeter';
import type { UiKit } from './uiKit';
import { loadUiKit } from './uiKit';

interface HudFighter {
  readonly name: string;
  readonly health: number;
  readonly energy: number;
  readonly stats: {
    readonly maxHealth: number;
    readonly maxEnergy: number;
  };
  /** crowd favour 0-100 (#51); without it the crowd strip stays hidden */
  readonly crowd?: { readonly favour: number };
}

/** a gift the crowd threw during the last action (the core's `crowd_gift` event) */
export interface HudGift {
  readonly fighter: 'player' | 'enemy';
  readonly gift: CrowdGift;
  readonly amount: number;
}

export interface HudState {
  readonly fighters: {
    readonly player: HudFighter;
    readonly enemy: HudFighter;
  };
  readonly gifts?: readonly HudGift[];
}

const PANEL_WIDTH = 382;
const PANEL_HEIGHT = 148;
const SIDE_MARGIN = 44;
const BOTTOM_MARGIN = 22;
const LIQUID_HEIGHT = 71;
const FILL_DURATION = 0.24;
/** the crowd strip sits this far above a panel's origin */
const CROWD_STRIP_TOP = -38;

export class CombatHud extends Container {
  private readonly player = new FighterPanel();
  private readonly enemy = new FighterPanel();
  private panelScale = 0;

  constructor(state: HudState, private readonly stageWidth: number, private readonly stageHeight: number) {
    super();
    this.addChild(this.player, this.enemy);
    this.setPanelScale(1);
    this.player.setState(state.fighters.player, true);
    this.enemy.setState(state.fighters.enemy, true);
    // the paper UI kit (#16) replaces the drawn flasks and name boards once loaded; until then (or without it) they stay
    void loadUiKit().then((kit) => {
      if (!kit || this.destroyed) return;
      this.player.useKit(kit);
      this.enemy.useKit(kit);
    });
  }

  /**
   * Enlarge both panels (1 = as drawn) so they stay readable on a small screen; each keeps its bottom corner.
   * Scenes pass `hudScaleFor(world.scale.x)` from src/ui/phone.ts every frame.
   */
  setPanelScale(scale: number) {
    if (scale === this.panelScale) return;
    this.panelScale = scale;
    const y = this.stageHeight - PANEL_HEIGHT * scale - BOTTOM_MARGIN;
    this.player.scale.set(scale);
    this.enemy.scale.set(scale);
    this.player.position.set(SIDE_MARGIN, y);
    this.enemy.position.set(this.stageWidth - PANEL_WIDTH * scale - SIDE_MARGIN, y);
  }

  /** stage y of the panels' top edge, crowd strip included (the action bar goes above it when it does not fit between the panels) */
  get panelTop(): number {
    return this.player.y + CROWD_STRIP_TOP * this.panelScale;
  }

  /** Stage-space room between the two panels, from the crowd strips' top to the panels' bottom: the action bar's slot (#147). */
  get panelGap(): { left: number; right: number; top: number; bottom: number } {
    return {
      left: this.player.x + PANEL_WIDTH * this.panelScale,
      right: this.enemy.x,
      top: this.panelTop,
      bottom: this.stageHeight - BOTTOM_MARGIN,
    };
  }

  setState(state: HudState) {
    this.player.setState(state.fighters.player);
    this.enemy.setState(state.fighters.enemy);
    for (const g of state.gifts ?? []) (g.fighter === 'player' ? this.player : this.enemy).celebrate(g.gift, g.amount);
  }

  update(dt: number) {
    this.player.update(dt);
    this.enemy.update(dt);
  }
}

class FighterPanel extends Container {
  private readonly nameText = new Text({
    style: { fontFamily: 'Georgia', fontSize: 34, fontWeight: 'bold', fill: '#fff0cb' },
  });
  private readonly health = new Flask('HEALTH', 0xcf493d, 0xff987a);
  private readonly energy = new Flask('ENERGY', 0x377bb1, 0x9adcff);
  private readonly crowd = new CrowdMeter(PANEL_WIDTH - 36);
  /** drawn name board; replaced by the wooden plate sprite once the UI kit has loaded (#242) */
  private readonly header = new Graphics()
    .roundRect(18, 0, PANEL_WIDTH - 36, 46, 6)
    .fill(0x694630)
    .stroke({ color: 0xb58758, width: 3 })
    .moveTo(31, 6).lineTo(PANEL_WIDTH - 31, 6)
    .stroke({ color: 0xd3a675, width: 2, alpha: 0.6 });
  private nameRoom = PANEL_WIDTH - 56;

  constructor() {
    super();
    const plate = new Graphics()
      .roundRect(0, 17, PANEL_WIDTH, PANEL_HEIGHT - 17, 14)
      .fill({ color: 0x332124, alpha: 0.96 })
      .stroke({ color: 0x815a46, width: 3 });

    this.nameText.anchor.set(0.5);
    this.nameText.position.set(PANEL_WIDTH / 2, 22);
    this.health.position.set(44, 104);
    this.energy.position.set(230, 104);
    this.crowd.position.set(18, CROWD_STRIP_TOP);
    this.crowd.visible = false;
    this.addChild(this.crowd, plate, this.header, this.nameText, this.health, this.energy);
  }

  /** swap the drawn name board and flasks for the paper UI kit sprites (#16) */
  useKit(kit: UiKit) {
    const f = kit.frame('plate');
    const board = new Sprite(kit.texture('plate'));
    // a little wider and taller than the drawn board, centred on the name, clear of the crowd strip above
    board.width = PANEL_WIDTH - 20;
    board.height = Math.min(56, board.width * (f.h / f.w));
    board.position.set(10, 22 - board.height / 2);
    this.header.visible = false;
    this.addChildAt(board, this.getChildIndex(this.header));
    // the name sits on the paper label (about 87 % of the board's width)
    this.nameText.style.fill = '#3b2a22';
    this.nameRoom = board.width * 0.8;
    this.fitName();
    this.health.useKit(kit, 'flask_liquid_hp');
    this.energy.useKit(kit, 'flask_liquid_en');
  }

  private fitName() {
    this.nameText.scale.x = 1;
    const width = this.nameText.width;
    if (width > this.nameRoom) this.nameText.scale.x = this.nameRoom / width;
  }

  celebrate(gift: CrowdGift, amount: number) { this.crowd.celebrate(gift, amount); }

  setState(fighter: HudFighter, immediate = false) {
    if (this.nameText.text !== fighter.name) {
      this.nameText.text = fighter.name;
      this.fitName();
    }
    this.health.setValue(fighter.health, fighter.stats.maxHealth, immediate);
    this.energy.setValue(fighter.energy, fighter.stats.maxEnergy, immediate);
    if (fighter.crowd) {
      this.crowd.setFavour(fighter.crowd.favour, immediate || !this.crowd.visible);
      this.crowd.visible = true;
    } else {
      this.crowd.visible = false;
    }
  }

  update(dt: number) {
    this.health.update(dt);
    this.energy.update(dt);
    this.crowd.update(dt);
  }
}

/** height of the kit flask on the panel (px): the drawn bottle with its cork is about this tall */
const KIT_FLASK_HEIGHT = 96;

class Flask extends Container {
  private readonly liquid: Graphics;
  private readonly drawn: Container[] = [];
  private kitMask: Graphics | null = null;
  private kitLiquid: Sprite | null = null;
  private readonly maskShape = new Graphics().rect(-28, -LIQUID_HEIGHT, 56, LIQUID_HEIGHT).fill(0xffffff);
  private readonly valueText = new Text({
    style: { fontFamily: 'Georgia', fontSize: 31, fontWeight: 'bold', fill: '#fff0d6' },
  });
  private shown = 0;
  private from = 0;
  private target = 0;
  private elapsed = FILL_DURATION;

  constructor(name: string, color: number, highlight: number) {
    super();
    const bottle = () => new Graphics().roundRect(-25, -39, 50, LIQUID_HEIGHT, 16);
    const glass = bottle().fill(0x51424a);
    this.liquid = bottle().fill(color)
      .roundRect(-17, -31, 9, 49, 4).fill({ color: highlight, alpha: 0.62 });
    this.maskShape.position.y = 32;
    this.liquid.mask = this.maskShape;

    const outline = bottle().stroke({ color: 0xe7bc99, width: 2.5 })
      .roundRect(-12, -54, 24, 16, 3)
      .fill(0xa87146)
      .stroke({ color: 0xe7bc99, width: 2.5 })
      .moveTo(-17, -27).lineTo(-17, 13)
      .stroke({ color: 0xfaf1d7, width: 2, alpha: 0.6, cap: 'round' });

    const label = new Text({
      text: name,
      style: { fontFamily: 'Georgia', fontSize: 24, fill: '#f4d3a7', fontWeight: 'bold' },
    });
    label.position.set(38, -40);
    this.valueText.position.set(37, -7);
    this.drawn.push(glass, this.liquid, this.maskShape, outline);
    this.addChild(glass, this.liquid, this.maskShape, outline, label, this.valueText);
  }

  /** draw the bottle from the UI kit (#16): back glass, liquid cropped to the level by a mask, front glass and cork */
  useKit(kit: UiKit, liquidKey: string) {
    const f = kit.frame('flask_back');
    const s = KIT_FLASK_HEIGHT / f.h;
    const box = new Container();
    box.scale.set(s);
    // same bottom as the drawn bottle (y 32), centred on x 0
    box.position.set(-(f.w * s) / 2, 34 - f.h * s);
    const fill = kit.fill(liquidKey);
    const liquid = new Sprite(kit.texture(liquidKey));
    const mask = new Graphics().rect(0, -(fill.bottom - fill.top), f.w, fill.bottom - fill.top).fill(0xffffff);
    mask.position.y = fill.bottom;
    liquid.mask = mask;
    box.addChild(new Sprite(kit.texture('flask_back')), liquid, mask, new Sprite(kit.texture('flask_front')));
    for (const d of this.drawn) d.visible = false;
    this.liquid.mask = null;
    this.addChildAt(box, 0);
    this.kitMask = mask;
    this.kitLiquid = liquid;
    this.showFraction(this.shown);
  }

  setValue(value: number, max: number, immediate: boolean) {
    this.valueText.text = `${value} / ${max}`;
    this.valueText.scale.x = 1;
    const width = this.valueText.width;
    if (width > 104) this.valueText.scale.x = 104 / width;
    const fraction = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
    if (immediate) {
      this.target = fraction;
      this.elapsed = FILL_DURATION;
      this.showFraction(fraction);
    } else if (fraction !== this.target) {
      this.from = this.shown;
      this.target = fraction;
      this.elapsed = 0;
    }
  }

  update(dt: number) {
    if (this.elapsed >= FILL_DURATION) return;
    this.elapsed = Math.min(FILL_DURATION, this.elapsed + dt);
    const remaining = 1 - this.elapsed / FILL_DURATION;
    this.showFraction(this.target + (this.from - this.target) * remaining * remaining);
  }

  private showFraction(fraction: number) {
    this.shown = fraction;
    this.maskShape.scale.y = fraction;
    if (this.kitMask && this.kitLiquid) {
      this.kitMask.scale.y = fraction;
      this.kitLiquid.visible = fraction > 0;
    } else {
      this.liquid.visible = fraction > 0;
    }
  }
}
