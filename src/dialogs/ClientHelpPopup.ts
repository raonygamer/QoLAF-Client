import { read } from '../api/Types';
import { bound, type Resolve } from '../runtime/As3';
import { ClientChangelogTextChunks } from './ClientChangelogTextChunks';
import type { ClientHelpPage } from './ClientHelpContent';

/** Source ClientHelpPopup geometry and theme on native Haxe controls. */
export function createClientHelpPopup(resolve: Resolve): any {
  const Popup = resolve('core.hud.components.dialogs.PopupMessage');
  const Text = resolve('core.hud.components.Text');
  const Button = resolve('core.hud.components.Button');
  const PressButton = resolve('core.hud.components.ui.PressButton');
  const Scroll = resolve('core.hud.components.ui.ScrollBox');
  const Quad = resolve('starling.display.Quad');
  const Russo = resolve('core.text.RussoBitmapFontRegistry');

  class ClientHelpPopup extends Popup {
    private readonly tabs: any[] = [];
    private readonly skins: any[] = [];
    private readonly blocks: any[] = [];
    private readonly content: any;
    private selectedIndex = -1;
    private observedStage: any = null;
    private destroyed = false;

    constructor(private readonly pages: ClientHelpPage[]) {
      super('Close');
      this.textField.visible = false;
      this.closeButton.removeFromParent(true);
      this.closeButton = new Button(() => this.close(), 'Close');
      this.box.addChild(this.closeButton);
      this.content = new Scroll();
      this.content.x = 0;
      this.content.y = 36;
      this.content.width = 720;
      this.content.height = 500 - 36 - 58;
      this.box.addChild(this.content);
      const width = 720 / pages.length;
      pages.forEach((page, index) => {
        const tab = new PressButton('plain');
        tab.labelFont = Russo.fontNameForSize(12);
        tab.labelSize = 12;
        tab.labelColor = 0xffffff;
        tab.labelPadding = 10;
        tab.alignLeft = false;
        // Native PressButton measures before assigning its final width. Wrapping
        // here can retain a two-line measurement and clip the second line.
        tab.textField.set_wordWrap(false);
        const colors: Record<string, number> = {
          up: 0,
          hover: 3356216,
          down: 0,
          disabled: 0,
          selectedUp: 4212299,
          selectedHover: 3356216,
          selectedDown: 4212299,
          selectedDisabled: 4212299,
        };
        for (const [state, color] of Object.entries(colors)) {
          const old = tab.skins.h[state];
          const skin = new Quad(width, 24, color);
          skin.touchable = false;
          tab.setSkin(state, skin);
          old?.dispose();
          this.skins.push(skin);
        }
        tab.set_label(page.label);
        tab.width = width;
        tab.height = 24;
        tab.x = width * index;
        tab.addEventListener('triggered', () => this.selectPage(index));
        this.tabs.push(tab);
        this.box.addChild(tab);
      });
      this.selectPage(0);
    }

    private selectPage(index: number): void {
      if (index === this.selectedIndex || !this.pages[index]) return;
      this.selectedIndex = index;
      this.tabs.forEach((tab, position) => tab.set_isSelected(position === index));
      this.content.removeChildren(0, -1, true);
      this.blocks.length = 0;
      let top = 6;
      for (const chunk of ClientChangelogTextChunks.split(this.pages[index].content)) {
        const block = new Text(10, top, true, 'Verdana');
        block.size = 12;
        block.bold = false;
        block.width = 690;
        block.htmlText = chunk;
        this.content.addChild(block);
        this.blocks.push(block);
        top += block.height + 8;
      }
      this.content.arrange();
      this.content.scrollToPosition(0, 0);
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
      if (!this.stage || !this.content) return;
      this.box.width = 720;
      this.box.height = 500;
      this.box.x = Math.round((this.stage.stageWidth - 720) / 2);
      this.box.y = Math.round((this.stage.stageHeight - 500) / 2);
      this.closeButton.x = Math.round(360 - this.closeButton.width / 2);
      this.closeButton.y = 500 - this.closeButton.height - 8;
      this.bgr.width = this.stage.stageWidth;
      this.bgr.height = this.stage.stageHeight;
    }

    @bound
    keyDown(event: any): void {
      if (read(event, 'keyCode') !== 27) return;
      event.stopImmediatePropagation();
      this.close();
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
      for (const skin of this.skins) {
        skin.removeFromParent();
        skin.dispose();
      }
      this.skins.length = this.tabs.length = this.blocks.length = 0;
      super.dispose();
    }
  }
  return ClientHelpPopup;
}
