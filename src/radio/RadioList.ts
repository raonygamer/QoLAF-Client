import { bound, type Resolve } from '../runtime/As3';
import { settingsControls } from '../settings/NativeControls';

/** Radio's 38px Feathers rows on the native scrolling/hit-testing implementation. */
export function createRadioList(resolve: Resolve, Marquee: any) {
  const Scroll = settingsControls(resolve)['feathers.controls.ScrollContainer'];
  const Sprite = resolve('starling.display.Sprite');
  const Quad = resolve('starling.display.Quad');
  const Format = resolve('feathers.text.BitmapFontTextFormat');
  const Fonts = resolve('core.text.VerdanaBitmapFontRegistry');
  class RadioList extends Scroll {
    readonly itemRendererProperties = { labelField: 'label' };
    private rowContainer: any;
    private rows: any[] = [];
    private items: any[] = [];
    private selected = -1;
    private press: { row: any; x: number; y: number; scroll: number } | null = null;

    constructor() {
      super();
      this.rowContainer = new Sprite();
      this.addChild(this.rowContainer);
    }

    get dataProvider(): { data: any[] } {
      return { data: this.items };
    }
    set dataProvider(value: { data: any[] }) {
      this.press = null;
      this.rowContainer.removeChildren(0, -1, true);
      this.rows = [];
      this.items = value.data;
      this.selected = -1;
      for (let index = 0; index < this.items.length; index++) {
        const row = new Sprite();
        row.y = index * 38;
        row.name = String(index);
        row.useHandCursor = true;
        const background = new Quad(8, 38, 0x101418);
        background.alpha = 0.3;
        row.addChild(background);
        const label = new Marquee();
        label.textFormat = new Format(Fonts.fontNameForSize(12), 12, 0xc4cbd2, 'left');
        label.text = String(this.items[index][this.itemRendererProperties.labelField] ?? '');
        label.x = 10;
        label.y = 10;
        label.height = 24;
        row.addChild(label);
        row.addEventListener('touch', this.onRowTouch);
        this.rowContainer.addChild(row);
        this.rows.push({ row, background, label });
      }
      this.layoutRows();
      this.verticalScrollPosition = 0;
      this.dispatchEventWith('change');
    }

    get selectedIndex(): number {
      return this.selected;
    }
    set selectedIndex(value: number) {
      value = Number.isInteger(value) && value >= 0 && value < this.items.length ? value : -1;
      if (value === this.selected) return;
      this.selected = value;
      this.layoutRows();
      this.dispatchEventWith('change');
    }
    get selectedItem(): any {
      return this.items[this.selected] ?? null;
    }

    set_width(value: number): number {
      if (this.rows && value === this.get_width()) return value;
      super.set_width(value);
      if (this.rows) this.layoutRows();
      return value;
    }

    private layoutRows(): void {
      for (let index = 0; index < this.rows.length; index++) {
        const { background, label } = this.rows[index];
        const selected = index === this.selected;
        background.width = Math.max(1, this.get_width() - 8);
        background.color = selected ? 0x625b3c : 0x101418;
        background.alpha = selected ? 0.4 : 0.3;
        label.width = Math.max(1, this.get_width() - 28);
        label.textFormat = new Format(
          Fonts.fontNameForSize(12),
          12,
          selected ? 0xfff1a8 : 0xc4cbd2,
          'left',
        );
        label.validate();
      }
      this.arrange();
    }

    @bound
    private onRowTouch(event: any): void {
      const row = event.currentTarget;
      const began = event.getTouch(row, 'began');
      if (began)
        this.press = {
          row,
          x: began.globalX,
          y: began.globalY,
          scroll: this.verticalScrollPosition,
        };
      const ended = event.getTouch(row, 'ended');
      if (!ended || !this.press || this.press.row !== row) return;
      const press = this.press;
      this.press = null;
      if (
        !ended.cancelled &&
        Math.abs(ended.globalX - press.x) < 8 &&
        Math.abs(ended.globalY - press.y) < 8 &&
        Math.abs(this.verticalScrollPosition - press.scroll) < 8
      ) {
        this.selectedIndex = Number(row.name);
      }
    }

    dispose(): void {
      this.press = null;
      this.rows = [];
      this.items = [];
      super.dispose();
    }
  }
  return RadioList;
}
