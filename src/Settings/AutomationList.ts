import type { Resolve } from '../Runtime/As3';

/** Original AstroTheme automation rows on the upstream list/scroll/pointer engine. */
export function createAutomationList(resolve: Resolve): any {
  const ItemList = resolve('core.hud.components.ui.ItemList');
  const Russo = resolve('core.text.RussoBitmapFontRegistry');
  return class AutomationList extends ItemList {
    constructor() {
      super('shop');
      this.set_rowHeight(64);
    }
    rebuild(): void {
      this.disposeRows();
      super.rebuild();
      for (const row of this.rows) {
        row.labelFont = Russo.fontNameForSize(14);
        row.labelSize = 14;
        row.labelColor = 16689475;
        row.alignLeft = false;
        row.textField.get_format().set_font(row.labelFont);
        row.textField.get_format().set_size(14);
        row.textField.get_format().set_color(16689475);
        row.textField.set_wordWrap(true);
        // The native method otherwise centers the bounds but left-aligns multiline text.
        const layout = row.relayout;
        row.relayout = function () {
          layout.call(this);
          this.textField.set_x(10);
          this.textField.set_width(Math.max(1, this.get_width() - 20));
          this.textField.get_format().set_horizontalAlign('center');
        };
        row.relayout();
      }
    }
    private disposeRows(): void {
      // Native rebuild only detaches rows; dispose both attached and inactive skins.
      for (const row of this.rows) {
        const skins = new Set(Object.values(row.skins.h) as any[]);
        for (const skin of skins) skin.removeFromParent();
        row.removeFromParent(true);
        for (const skin of skins) skin.dispose();
      }
      this.rows = [];
    }
    dispose(): void {
      this.disposeRows();
      super.dispose();
    }
  };
}
