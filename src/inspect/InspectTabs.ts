import type { Resolve } from '../runtime/As3';

/** Feathers settings-tabs contract over the native Haxe TabBar. */
export function createInspectTabs(resolve: Resolve): any {
  const Sprite = resolve('starling.display.Sprite');
  const NativeTabs = resolve('core.hud.components.ui.TabBar');
  const Quad = resolve('starling.display.Quad');
  const Russo = resolve('core.text.RussoBitmapFontRegistry');
  return class InspectTabs extends Sprite {
    readonly styleNameList = { add() {} };
    private readonly native = new NativeTabs();
    private readonly skins: any[] = [];
    constructor() {
      super();
      this.native.equalTabs = true;
      this.native.set_tabHeight(24);
      this.addChild(this.native);
    }
    get dataProvider(): any[] {
      return this.native.dataProvider;
    }
    set dataProvider(items: any[]) {
      this.releaseSkins();
      this.native.set_dataProvider(items);
      for (const tab of this.native.tabs) {
        tab.labelFont = Russo.fontNameForSize(12);
        tab.labelSize = 12;
        tab.labelColor = 0xffffff;
        tab.labelPadding = 10;
        tab.textField.set_wordWrap(false);
        tab.set_label(tab.get_label());
        const colors = {
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
          const skin = new Quad(1, 24, color);
          skin.touchable = false;
          tab.setSkin(state, skin);
          old?.dispose();
          this.skins.push(skin);
        }
      }
      this.native.layoutTabs();
    }
    get selectedIndex(): number {
      return this.native.selectedIndex;
    }
    set selectedIndex(index: number) {
      this.native.set_selectedIndex(index);
      this.dispatchEventWith('change');
    }
    get_width(): number {
      return this.native?.get_width() ?? 0;
    }
    set_width(width: number): number {
      this.native?.set_width(width);
      return width;
    }
    private releaseSkins(): void {
      for (const skin of this.skins) {
        skin.removeFromParent();
        skin.dispose();
      }
      this.skins.length = 0;
    }
    dispose(): void {
      this.releaseSkins();
      super.dispose();
    }
  };
}
