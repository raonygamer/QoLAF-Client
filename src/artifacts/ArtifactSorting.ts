import { bound, type Resolve } from '../runtime/As3';
import type { Raw } from '../api/Types';

/** Original ArtifactSorting panel, geometry and controls on the native display tree. */
export function createArtifactSorting(resolve: Resolve): any {
  const Sprite = resolve('starling.display.Sprite');
  const Quad = resolve('starling.display.Quad');
  const Image = resolve('starling.display.Image');
  const TextField = resolve('starling.text.TextField');
  const TextFormat = resolve('starling.text.TextFormat');
  const Verdana = resolve('core.text.VerdanaBitmapFontRegistry');
  const Button = resolve('core.hud.components.Button');
  const ToolTip = resolve('core.hud.components.ToolTip');
  const Scroll = resolve('feathers.controls.ScrollContainer');
  const localize = resolve('generics.Localize');
  const textures = resolve('textures.TextureLocator');
  const objects = resolve('generics.ObjUtils');
  const Artifact = resolve('core.artifact.Artifact');

  class ArtifactSorting extends Sprite {
    static readonly PANEL_WIDTH = 665;
    static readonly PANEL_HEIGHT = 520;
    private nextX = 20;
    private nextY = 0;
    private mainBody: Raw;
    private closed = false;

    constructor(
      private game: Raw,
      private callback: (order: string) => void,
      private closeCallback: ((popup: Raw) => void) | null = null,
      blackTheme = false,
    ) {
      super();
      const background = new Quad(665, 520, blackTheme ? 0x000000 : 0x05080d);
      background.alpha = 0.88;
      this.addChild(background);
      this.drawBorder(1, 1, 663, 518, blackTheme ? 0x707070 : 0x7892aa, 2, 0.95);
      this.drawBorder(5, 5, 655, 510, blackTheme ? 0x282828 : 0x263b4e, 1, 0.8);
      const headline = new TextField(
        485,
        36,
        localize.t('Choose stat type'),
        new TextFormat(Verdana.fontNameForSize(20), 20, 0xfff1a8, 'left', 'center'),
      );
      headline.x = 18;
      headline.y = 14;
      this.addChild(headline);
      const close = new Button(() => this.close(), localize.t('Close'), 'highlight', 12, 'Verdana');
      close.x = 665 - close.width - 14;
      close.y = 14;
      this.addChild(close);
      const panel = new Quad(637, 350, blackTheme ? 0x080808 : 0x101722);
      panel.x = 14;
      panel.y = 60;
      panel.alpha = 0.76;
      this.addChild(panel);
      this.drawBorder(14, 60, 637, 350, blackTheme ? 0x505050 : 0x526c83, 1, 0.8);
      const scroll = new Scroll();
      scroll.x = 20;
      scroll.y = 66;
      scroll.width = 625;
      scroll.height = 338;
      scroll.clipContent = true;
      this.mainBody = new Sprite();
      const types = objects.ToVector(game.dataManager.loadTable('ArtifactTypes'), true, 'name');
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
            localize.t(label),
            'normal',
            12,
            'Verdana',
          );
          button.x = x;
          button.y = 420 + index * 34;
          this.addChild(button);
          x += button.width + 20;
        }
      });
    }

    private addStat(type: Raw): void {
      const icon = new Image(textures.getService().getTextureGUIByKey(type.bitmap));
      icon.scaleX = icon.scaleY = 0.7;
      icon.x = this.nextX;
      icon.y = this.nextY;
      icon.name = type.type;
      this.mainBody.addChild(icon);
      this.nextX += icon.width + 10;
      new ToolTip(this.game, icon, localize.t(type.name), null, 'artifactBox');
      icon.addEventListener('touch', this.onTouch);
      icon.useHandCursor = true;
    }

    @bound
    private onTouch(event: Raw): void {
      const icon = event.currentTarget;
      if (event.getTouch(icon, 'ended')) {
        icon.filter = null;
        this.closeAndSort(icon.name);
      } else icon.alpha = event.interactsWith(icon) ? 0.5 : 1;
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
      else if (this.parent) this.parent.removeChild(this, true);
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
        border.x = left;
        border.y = top;
        border.alpha = alpha;
        this.addChild(border);
      }
    }
  }
  return ArtifactSorting;
}
