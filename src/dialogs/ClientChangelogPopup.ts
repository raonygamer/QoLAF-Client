import { read } from '../api/Types';
import { bound, type Resolve } from '../runtime/As3';
import { ClientChangelogContent } from './ClientChangelogContent';
import { ClientChangelogTextChunks } from './ClientChangelogTextChunks';

/** Source changelog geometry, archive and reflow on the game's native display tree. */
export function createClientChangelogPopup(resolve: Resolve): any {
  const Popup = resolve('core.hud.components.dialogs.PopupMessage');
  const Text = resolve('core.hud.components.Text');
  const Button = resolve('core.hud.components.Button');
  const Sprite = resolve('starling.display.Sprite');
  const Quad = resolve('starling.display.Quad');
  const Scroll = resolve('feathers.controls.ScrollContainer');
  const PressButton = resolve('core.hud.components.ui.PressButton');
  const Verdana = resolve('core.text.VerdanaBitmapFontRegistry');
  const catalog = new ClientChangelogContent().createReleases();
  class ClientChangelogPopup extends Popup {
    private releases: any;
    private reading: any;
    private divider: any;
    private releaseLabels: any[] = [];
    private ownedSkins: any[] = [];
    private blocks: any[] = [];
    private selectedIndex = -1;
    private observedStage: any = null;
    private destroyed = false;

    constructor() {
      super('Close');
      this.closeButton.removeFromParent(true);
      this.closeButton = new Button(this.close, 'Close');
      this.box.addChild(this.closeButton);
      this.textField.x = 4;
      this.textField.y = 2;
      this.textField.wordWrap = false;
      this.textField.size = 18;
      this.textField.color = 0xfff1a8;
      this.textField.text = 'Changelog';
      this.releases = new Scroll();
      this.reading = new Scroll();
      this.divider = new Quad(1, 1, 0x444444);
      this.divider.touchable = false;
      this.box.addChild(this.releases);
      this.box.addChild(this.divider);
      this.box.addChild(this.reading);
      for (let index = 0; index < catalog.length; index++) {
        const row = new PressButton('plain');
        row.labelFont = Verdana.fontNameForSize(12);
        row.labelSize = 12;
        row.labelColor = 0xb0b0b0;
        row.labelPadding = 10;
        row.alignLeft = false;
        const states: Record<string, [number, number]> = {
          up: [0x080808, 0x505050],
          hover: [0x181818, 0x707070],
          down: [0x282828, 0x707070],
          disabled: [0x080808, 0x282828],
          selectedUp: [0x282828, 0x707070],
          selectedHover: [0x303030, 0x707070],
          selectedDown: [0x383838, 0x707070],
          selectedDisabled: [0x080808, 0x282828],
        };
        for (const [state, [fillColor, borderColor]] of Object.entries(states)) {
          const old = row.skins.h[state];
          const skin = new Sprite();
          skin.touchable = false;
          skin.addChild(new Quad(172, 64, borderColor));
          const fill = new Quad(170, 62, fillColor);
          fill.x = fill.y = 1;
          skin.addChild(fill);
          row.setSkin(state, skin);
          old?.dispose();
          this.ownedSkins.push(skin);
        }
        row.set_label(catalog[index].label);
        row.textField.set_wordWrap(true);
        row.width = 172;
        row.height = 64;
        row.y = index * 64 + 1;
        row.x = 1;
        row.addEventListener('triggered', () => this.selectRelease(index));
        this.releaseLabels.push(row);
        this.releases.addChild(row);
      }
      this.layoutPanels(840, 540);
      this.selectRelease(0);
    }

    @bound
    private selectRelease(index: number): void {
      if (index === this.selectedIndex || !catalog[index]) return;
      this.selectedIndex = index;
      for (let i = 0; i < this.releaseLabels.length; i++) {
        const row = this.releaseLabels[i];
        row.set_isSelected(i === index);
        row.labelColor = i === index ? 0xfff1a8 : 0xb0b0b0;
        row.textField.get_format().set_color(row.labelColor);
      }
      this.reading.removeChildren(0, -1, true);
      this.blocks = [];
      for (const chunk of ClientChangelogTextChunks.split(catalog[index].content)) {
        const block = new Text(8, 0, true, 'Verdana');
        block.size = 12;
        block.bold = false;
        block.width = this.reading.width - 30;
        block.htmlText = chunk;
        this.blocks.push(block);
        this.reading.addChild(block);
      }
      this.layoutContent();
      this.reading.scrollToPosition(0, 0);
    }
    private layoutContent(): void {
      let top = 6;
      for (const block of this.blocks) {
        block.width = this.reading.width - 30;
        block.y = top;
        top += block.height + 8;
      }
      this.reading.arrange();
    }
    private layoutPanels(width: number, height: number): void {
      this.box.width = width;
      this.box.height = height;
      const readingHeight = height - 40 - 58;
      this.releases.x = 0;
      this.releases.y = 40;
      this.releases.width = 174;
      this.releases.height = readingHeight;
      this.divider.x = 182;
      this.divider.y = 40;
      this.divider.height = readingHeight;
      this.reading.x = 192;
      this.reading.y = 40;
      this.reading.width = width - 192;
      this.reading.height = readingHeight;
      this.closeButton.x = Math.round(width / 2 - this.closeButton.width / 2);
      this.closeButton.y = height - this.closeButton.height - 8;
      this.layoutContent();
    }
    @bound
    stageAddHandler(): void {
      this.observedStage = this.stage;
      this.addEventListener('removedFromStage', this.clean);
      this.observedStage.addEventListener('keyDown', this.keyDown);
      this.observedStage.addEventListener('resize', this.redraw);
      this.redraw();
    }
    @bound
    redraw(): void {
      if (!this.stage || !this.reading) return;
      const width = Math.max(540, Math.min(840, this.stage.stageWidth - 60));
      const height = Math.max(360, Math.min(540, this.stage.stageHeight - 60));
      this.layoutPanels(width, height);
      const scale = Math.min(
        1,
        Math.max(1, this.stage.stageWidth - 20) / (width + this.box.padding * 2),
        Math.max(1, this.stage.stageHeight - 20) / (height + this.box.padding * 2),
      );
      this.box.scaleX = this.box.scaleY = scale;
      this.box.x = Math.round((this.stage.stageWidth - width * scale) / 2);
      this.box.y = Math.round((this.stage.stageHeight - height * scale) / 2);
      this.bgr.width = this.stage.stageWidth;
      this.bgr.height = this.stage.stageHeight;
    }
    @bound
    keyDown(event: any): void {
      if (read(event, 'keyCode') === 27) {
        event.stopImmediatePropagation();
        this.close();
      }
    }
    @bound
    clean(): void {
      this.observedStage?.removeEventListener('keyDown', this.keyDown);
      this.observedStage?.removeEventListener('resize', this.redraw);
      this.observedStage = null;
    }
    dispose(): void {
      if (this.destroyed) return;
      this.destroyed = true;
      this.clean();
      this.blocks = [];
      this.releaseLabels = [];
      for (const skin of this.ownedSkins) {
        skin.removeFromParent();
        skin.dispose();
      }
      this.ownedSkins = [];
      super.dispose();
    }
  }
  return ClientChangelogPopup;
}
