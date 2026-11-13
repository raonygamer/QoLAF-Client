import { bound, type Resolve } from '../runtime/HaxeInterop';
import {
  Artifact,
  Sprite,
  Quad,
  Image,
  StarlingTextField as TextField,
  TextFormat,
  Localize,
  TextureLocator,
  ToolTip,
  type GameScene,
} from '../game/Bindings';
import type { Game } from '../game/Game';
import { VerdanaBitmapFontRegistry as Verdana } from '../ui/VerdanaBitmapFontRegistry';

interface ArtifactType {
  type: string;
  name: string;
  bitmap: string;
}

function artifactTypes(value: unknown): ArtifactType[] {
  if (!value || typeof value !== 'object') throw new Error('ArtifactTypes table is unavailable');
  const entries: unknown[] = Object.values(value);
  const types = entries.map((entry): ArtifactType => {
    if (
      !entry ||
      typeof entry !== 'object' ||
      !('type' in entry) ||
      typeof entry.type !== 'string' ||
      !('name' in entry) ||
      typeof entry.name !== 'string' ||
      !('bitmap' in entry) ||
      typeof entry.bitmap !== 'string'
    )
      throw new Error('Invalid ArtifactTypes record');
    return { type: entry.type, name: entry.name, bitmap: entry.bitmap };
  });
  // ObjUtils.ToVector uses this exact name comparison, not locale collation.
  return types.sort((left, right) => (left.name > right.name ? 1 : -1));
}

/** Original ArtifactSorting panel, geometry and controls on the native display tree. */
export function createArtifactSorting(resolve: Resolve) {
  // These two source controls are adapters around native Button and ScrollBox.
  const Button = resolve('core.hud.components.Button') as new (
    callback: () => void,
    text: string,
    style: string,
    size: number,
    family: string,
  ) => Game.core.hud.components.Button;
  const Scroll = resolve(
    'feathers.controls.ScrollContainer',
  ) as new () => Game.core.hud.components.ui.ScrollBox & { clipContent: boolean };

  class ArtifactSorting extends Sprite {
    static readonly PANEL_WIDTH = 665;
    static readonly PANEL_HEIGHT = 520;
    private nextX = 20;
    private nextY = 0;
    private mainBody: Sprite;
    private closed = false;

    constructor(
      private game: GameScene,
      private callback: (order: string) => void,
      private closeCallback: ((popup: ArtifactSorting) => void) | null = null,
      blackTheme = false,
    ) {
      super();
      const background = new Quad(665, 520, blackTheme ? 0x000000 : 0x05080d);
      background.set_alpha(0.88);
      this.addChild(background);
      this.drawBorder(1, 1, 663, 518, blackTheme ? 0x707070 : 0x7892aa, 2, 0.95);
      this.drawBorder(5, 5, 655, 510, blackTheme ? 0x282828 : 0x263b4e, 1, 0.8);
      const headline = new TextField(
        485,
        36,
        Localize.t('Choose stat type'),
        new TextFormat(Verdana.fontNameForSize(20), 20, 0xfff1a8, 'left', 'center'),
      );
      headline.set_x(18);
      headline.set_y(14);
      this.addChild(headline);
      const close = new Button(() => this.close(), Localize.t('Close'), 'highlight', 12, 'Verdana');
      close.set_x(665 - close.get_width() - 14);
      close.set_y(14);
      this.addChild(close);
      const panel = new Quad(637, 350, blackTheme ? 0x080808 : 0x101722);
      panel.set_x(14);
      panel.set_y(60);
      panel.set_alpha(0.76);
      this.addChild(panel);
      this.drawBorder(14, 60, 637, 350, blackTheme ? 0x505050 : 0x526c83, 1, 0.8);
      const scroll = new Scroll();
      scroll.set_x(20);
      scroll.set_y(66);
      scroll.set_width(625);
      scroll.set_height(338);
      scroll.clipContent = true;
      this.mainBody = new Sprite();
      const types = artifactTypes(game.dataManager.loadTable('ArtifactTypes'));
      const rows = [
        ['health', 'convShield'],
        ['armor'],
        ['shield', 'convHp'],
        ['power', 'all', Artifact.TYPE_INCREASE_RECYCLE_RATE],
        ['kinetic'],
        ['energy'],
        ['corrosive'],
        ['speed', 'refire', 'cooldown'],
      ];
      for (const subsets of rows) {
        for (const subset of subsets) {
          for (const type of types) {
            if (type.type.includes(subset) && !/[23]/.test(type.type)) this.addStat(type);
          }
        }
        this.nextX = 20;
        this.nextY += 60;
      }
      scroll.addChild(this.mainBody);
      this.addChild(scroll);
      const orders = [
        [
          ['Strength high', 'levelhigh'],
          ['Strength low', 'levellow'],
          ['Fitness high', 'fitnesshigh'],
          ['Fitness low', 'fitnesslow'],
        ],
        [
          ['Potential high', 'potentialhigh'],
          ['Potential low', 'potentiallow'],
          ['Adequacy high', 'adequacyhigh'],
          ['Adequacy low', 'adequacylow'],
        ],
        [
          ['Modifiers high', 'modifiershigh'],
          ['Modifiers low', 'modifierslow'],
        ],
      ];
      orders.forEach((row, index) => {
        let x = 14;
        for (const [label, order] of row) {
          const button = new Button(
            () => this.closeAndSort(order),
            Localize.t(label),
            'normal',
            12,
            'Verdana',
          );
          button.set_x(x);
          button.set_y(420 + index * 34);
          this.addChild(button);
          x += button.get_width() + 20;
        }
      });
    }

    private addStat(type: ArtifactType): void {
      const icon = new Image(TextureLocator.getService().getTextureGUIByKey(type.bitmap));
      icon.set_scaleX(0.7);
      icon.set_scaleY(0.7);
      icon.set_x(this.nextX);
      icon.set_y(this.nextY);
      icon.set_name(type.type);
      this.mainBody.addChild(icon);
      this.nextX += icon.get_width() + 10;
      new ToolTip(this.game, icon, Localize.t(type.name), null, 'artifactBox');
      icon.addEventListener('touch', this.onTouch);
      icon.set_useHandCursor(true);
    }

    @bound
    private onTouch(event: Game.starling.events.TouchEvent): void {
      const icon: unknown = event.currentTarget;
      if (!(icon instanceof Image)) return;
      if (event.getTouch(icon, 'ended')) {
        icon.set_filter(null);
        this.closeAndSort(icon.get_name());
      } else icon.set_alpha(event.interactsWith(icon) ? 0.5 : 1);
    }

    public closeAndSort(order: string): void {
      if (this.closed) return;
      this.callback(order);
      this.close();
    }

    public close(): void {
      if (this.closed) return;
      this.closed = true;
      const handler = this.closeCallback;
      this.closeCallback = null;
      if (handler) handler(this);
      else this.removeFromParent(true);
    }

    private drawBorder(
      x: number,
      y: number,
      width: number,
      height: number,
      color: number,
      thickness: number,
      alpha: number,
    ): void {
      for (const [left, top, w, h] of [
        [x, y, width, thickness],
        [x, y + height - thickness, width, thickness],
        [x, y, thickness, height],
        [x + width - thickness, y, thickness, height],
      ]) {
        const border = new Quad(w, h, color);
        border.set_x(left);
        border.set_y(top);
        border.set_alpha(alpha);
        this.addChild(border);
      }
    }
  }
  return ArtifactSorting;
}
