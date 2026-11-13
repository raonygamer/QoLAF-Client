// Port of qolaf/ui/elements/CustomProgressBar.as. Geometry, palette and math
// are preserved; Haxe properties use their generated accessors.
import type {} from '../game/DeviceSettings';
import {
  BitmapData,
  Shape,
  Matrix,
  Sprite,
  Quad,
  Image,
  Texture,
  StarlingTextField,
  TextFormat,
  SceneBase,
} from '../game/Bindings';
import { RussoBitmapFontRegistry } from './RussoBitmapFontRegistry';
import { formatAmount } from '../hud/HealthAndShield';
export const MULTIBAR_COLORS = [
  0xe74c3c, 0xf39c12, 0xf1c40f, 0x2ecc71, 0x1abc9c, 0x3498db, 0x9b59b6, 0xe84393, 0xff6b6b,
  0xff9f43, 0xa3cb38, 0x00d2d3, 0x54a0ff, 0x5f27cd, 0xf368e0, 0xc8d6e5,
];
export class ProgressBar {
  readonly node: Sprite;
  private back: Quad;
  private trail: Quad;
  private overlay: Quad;
  private valueText: StarlingTextField;
  private multiplierText: StarlingTextField;
  private tip: Image;
  private tipTexture: Texture;
  private tipBitmap: BitmapData;
  private mask: Quad;
  private maximum = 100;
  private value = 100;
  private lerped = 100;
  private colors: number[] = [];
  obscured = false;
  private multipleLayers = true;
  private layerDividend = 10000;
  get multibar(): boolean {
    return this.multipleLayers;
  }
  set multibar(value: boolean) {
    if (this.multipleLayers === value) return;
    this.multipleLayers = value;
    this.resetColors();
  }
  get dividend(): number {
    return this.layerDividend;
  }
  set dividend(value: number) {
    const normalized = Number.isFinite(value) ? Math.max(1, value) : 10000;
    if (this.layerDividend === normalized) return;
    this.layerDividend = normalized;
    this.resetColors();
  }
  constructor(
    private width = 300,
    private height = 14,
    private color = 0xffffff,
  ) {
    this.resetColors();
    this.node = new Sprite();
    this.node.set_touchable(false);
    this.back = new Quad(width, height, 0);
    this.back.set_alpha(0.35);
    this.trail = new Quad(1, height, color);
    this.trail.set_alpha(0.45);
    this.overlay = new Quad(1, height, color);
    this.tipBitmap = new BitmapData(28, 18, true, 0);
    const glow = new Shape();
    const gradient = new Matrix();
    gradient.createGradientBox(28, 18);
    const graphics = glow.get_graphics();
    // OpenFL's Haxe GradientType.LINEAR is 0. Preserve the source's authored
    // ratios and let the native rasterizer handle pixel coverage/interpolation.
    graphics.beginGradientFill(
      0,
      Array(9).fill(0xffffff),
      [0, 0.08, 0.25, 0.55, 0.75, 0.55, 0.25, 0.08, 0],
      [0, 32, 64, 96, 128, 160, 192, 224, 255],
      gradient,
    );
    graphics.drawRect(0, 0, 28, 18);
    graphics.endFill();
    this.tipBitmap.draw(glow);
    // Haxe's onRestore callback retains the bitmap for WebGL context recovery.
    this.tipTexture = Texture.fromBitmapData(this.tipBitmap, false, false, 1);
    this.tip = new Image(this.tipTexture);
    this.tip.set_visible(false);
    this.tip.set_blendMode('screen');
    this.tip.set_height(height);
    this.tip.set_touchable(false);
    this.mask = new Quad(width, height, 0xffffff);
    this.mask.set_touchable(false);
    this.node.set_mask(this.mask);
    this.valueText = this.createText(width, '0 / 0', 12, 'center');
    this.valueText.set_y(1);
    this.multiplierText = this.createText(54, '', 11, 'right');
    this.multiplierText.set_x(Math.max(0, width - 59));
    this.multiplierText.set_y(1);
    for (const child of [
      this.back,
      this.trail,
      this.overlay,
      this.tip,
      this.valueText,
      this.multiplierText,
    ])
      this.node.addChild(child);
  }
  private createText(
    width: number,
    text: string,
    size: number,
    alignment: string,
  ): StarlingTextField {
    const field = new StarlingTextField(
      width,
      this.height,
      text,
      new TextFormat(RussoBitmapFontRegistry.UI_24_FONT_NAME, size, 0xffffff, alignment, 'center'),
    );
    field.set_pixelSnapping(false);
    field.set_touchable(false);
    return field;
  }
  set(maximum: number, value: number) {
    maximum = Math.max(0, maximum);
    if (this.maximum !== maximum) this.resetColors();
    this.maximum = maximum;
    this.value = Math.max(0, Math.min(value, maximum));
    this.lerped = Math.min(maximum, Math.max(this.value, this.lerped));
  }
  private resetColors(): void {
    this.colors = [this.color];
    this.layerColor(1);
  }
  private layerColor(depth: number) {
    while (this.colors.length <= depth) {
      let i = Math.floor(Math.random() * MULTIBAR_COLORS.length);
      if (MULTIBAR_COLORS[i] === this.colors.at(-1)) i = (i + 1) % MULTIBAR_COLORS.length;
      this.colors.push(MULTIBAR_COLORS[i]);
    }
    return this.colors[depth];
  }
  update(
    dt: number,
    format: (value: number) => string = (value) => {
      const rounded = Math.max(0, Math.floor(value));
      return SceneBase.settings?.formatTargetBarValues ? formatAmount(rounded) : String(rounded);
    },
  ) {
    this.lerped += (this.value - this.lerped) * Math.min(1, 8 * Math.max(0, dt));
    if (this.obscured) {
      this.tip.set_visible(false);
      this.back.set_color(0);
      this.back.set_alpha(0.35);
      for (const fill of [this.overlay, this.trail]) {
        fill.set_color(0x777777);
        fill.set_width(this.width);
      }
      this.setText(this.valueText, '??? / ???');
      this.valueText.get_format().set_color(0xffffff);
      this.setText(this.multiplierText, this.multibar ? '???x' : '');
      return;
    }
    let color = this.color,
      capacity = this.maximum <= 0 ? 1 : this.maximum,
      start = 0,
      layer = 0;
    if (this.multibar) {
      layer = this.value <= 0 ? 0 : Math.ceil(this.value / this.dividend);
      const highest = this.maximum <= 0 ? 0 : Math.ceil(this.maximum / this.dividend);
      const depth = Math.max(0, highest - layer);
      color = this.layerColor(depth);
      const nextColor = this.layerColor(depth + 1);
      start = layer <= 0 ? 0 : (layer - 1) * this.dividend;
      capacity =
        layer <= 0 ? this.dividend : Math.min(this.dividend, Math.max(1, this.maximum - start));
      this.back.set_color(layer > 1 ? nextColor : 0);
      this.back.set_alpha(layer > 1 ? 0.8 : 0.35);
    } else {
      this.back.set_color(0);
      this.back.set_alpha(0.35);
    }
    this.overlay.set_color(color);
    this.trail.set_color(color);
    const ratio = (v: number) =>
      this.multibar && layer === 0 ? 0 : Math.max(0, Math.min(1, (v - start) / capacity));
    const w = Math.max(0.01, this.width * ratio(this.value));
    this.overlay.set_width(w);
    this.trail.set_width(Math.max(0.01, this.width * ratio(this.lerped)));
    const delta = Math.abs(this.lerped - this.value);
    this.tip.set_visible(delta >= 0.5);
    this.tip.set_color(color);
    this.tip.set_alpha(0.95 * Math.min(1, delta / Math.max(1, capacity * 0.45)));
    this.tip.set_x(Math.max(-14, Math.min(this.width - 14, w - 14)));
    this.setText(this.valueText, `${format(this.value)} / ${format(this.maximum)}`);
    this.valueText
      .get_format()
      .set_color(this.maximum > 0 && this.value <= this.maximum * 0.1 ? 0xff3030 : 0xffffff);
    this.setText(this.multiplierText, this.multibar ? `${layer}x` : '');
  }
  private setText(field: StarlingTextField, value: string): void {
    if (field.get_text() !== value) field.set_text(value);
  }
  dispose() {
    this.node.set_mask(null);
    this.mask.dispose();
    if (this.node.get_parent()) this.node.removeFromParent(true);
    else this.node.dispose();
    this.tipTexture.dispose();
    this.tipBitmap.dispose();
  }
}
