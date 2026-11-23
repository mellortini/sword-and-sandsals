import { Container, Graphics, Text } from 'pixi.js';

interface HudFighter {
  readonly name: string;
  readonly health: number;
  readonly energy: number;
  readonly stats: {
    readonly maxHealth: number;
    readonly maxEnergy: number;
  };
}

export interface HudState {
  readonly fighters: {
    readonly player: HudFighter;
    readonly enemy: HudFighter;
  };
}

const PANEL_WIDTH = 382;
const PANEL_HEIGHT = 148;
const SIDE_MARGIN = 44;
const BOTTOM_MARGIN = 22;
const LIQUID_HEIGHT = 71;
const FILL_DURATION = 0.24;

export class CombatHud extends Container {
  private readonly player = new FighterPanel();
  private readonly enemy = new FighterPanel();

  constructor(state: HudState, width: number, height: number) {
    super();
    const y = height - PANEL_HEIGHT - BOTTOM_MARGIN;
    this.player.position.set(SIDE_MARGIN, y);
    this.enemy.position.set(width - PANEL_WIDTH - SIDE_MARGIN, y);
    this.addChild(this.player, this.enemy);
    this.player.setState(state.fighters.player, true);
    this.enemy.setState(state.fighters.enemy, true);
  }

  setState(state: HudState) {
    this.player.setState(state.fighters.player);
    this.enemy.setState(state.fighters.enemy);
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

  constructor() {
    super();
    const plate = new Graphics()
      .roundRect(0, 17, PANEL_WIDTH, PANEL_HEIGHT - 17, 14)
      .fill({ color: 0x332124, alpha: 0.96 })
      .stroke({ color: 0x815a46, width: 3 })
      .roundRect(18, 0, PANEL_WIDTH - 36, 46, 6)
      .fill(0x694630)
      .stroke({ color: 0xb58758, width: 3 })
      .moveTo(31, 6).lineTo(PANEL_WIDTH - 31, 6)
      .stroke({ color: 0xd3a675, width: 2, alpha: 0.6 });

    this.nameText.anchor.set(0.5);
    this.nameText.position.set(PANEL_WIDTH / 2, 22);
    this.health.position.set(44, 104);
    this.energy.position.set(230, 104);
    this.addChild(plate, this.nameText, this.health, this.energy);
  }

  setState(fighter: HudFighter, immediate = false) {
    if (this.nameText.text !== fighter.name) {
      this.nameText.text = fighter.name;
      this.nameText.scale.x = 1;
      const width = this.nameText.width;
      if (width > PANEL_WIDTH - 56) this.nameText.scale.x = (PANEL_WIDTH - 56) / width;
    }
    this.health.setValue(fighter.health, fighter.stats.maxHealth, immediate);
    this.energy.setValue(fighter.energy, fighter.stats.maxEnergy, immediate);
  }

  update(dt: number) {
    this.health.update(dt);
    this.energy.update(dt);
  }
}

class Flask extends Container {
  private readonly liquid: Graphics;
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
    this.addChild(glass, this.liquid, this.maskShape, outline, label, this.valueText);
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
    this.liquid.visible = fraction > 0;
  }
}
