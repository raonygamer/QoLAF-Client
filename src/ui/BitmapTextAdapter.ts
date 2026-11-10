import type { Resolve } from '../runtime/As3';

/** Feathers' measurement/invalidation boundary, backed by native Starling nodes. */
export function createBitmapTextAdapter(resolve: Resolve): any {
  const Sprite = resolve('starling.display.Sprite');
  const Rectangle = resolve('openfl.geom.Rectangle');
  abstract class BitmapTextAdapter extends Sprite {
    protected _text = '';
    protected _wordWrap = false;
    protected _explicitWidth = NaN;
    protected _explicitHeight = NaN;
    protected _explicitMaxWidth = Infinity;
    protected _fontStyles: any = null;
    private measuredWidthValue = 0;
    private measuredHeightValue = 0;
    private initialized = false;
    private validating = false;
    private invalidFlags = new Set(['data', 'styles', 'size', 'state']);
    private flagsDuringDraw: Set<string> | null = null;
    private readonly validateFrame = () => this.validate();

    constructor() {
      super();
      this.addEventListener('enterFrame', this.validateFrame);
    }

    get text(): string {
      return this._text;
    }
    set text(value: string) {
      value ??= '';
      if (value === this._text) return;
      this._text = value;
      this.invalidate('data');
    }
    get wordWrap(): boolean {
      return this._wordWrap;
    }
    set wordWrap(value: boolean) {
      if (value === this._wordWrap) return;
      this._wordWrap = value;
      this.invalidate('data');
    }
    get width(): number {
      return this.get_width();
    }
    set width(value: number) {
      this.set_width(value);
    }
    get height(): number {
      return this.get_height();
    }
    set height(value: number) {
      this.set_height(value);
    }
    get maxWidth(): number {
      return this._explicitMaxWidth;
    }
    set maxWidth(value: number) {
      if (Object.is(value, this._explicitMaxWidth)) return;
      this._explicitMaxWidth = value;
      this.invalidate('size');
    }
    get fontStyles(): any {
      return this._fontStyles?.getTextFormatForTarget(this);
    }
    set fontStyles(value: any) {
      this._fontStyles = value == null ? null : { getTextFormatForTarget: () => value };
      this.invalidate('styles');
    }
    get_width(): number {
      this.validate();
      return Number.isNaN(this._explicitWidth) ? this.measuredWidthValue : this._explicitWidth;
    }
    set_width(value: number): number {
      if (!Object.is(value, this._explicitWidth)) {
        this._explicitWidth = value;
        this.invalidate('size');
      }
      return value;
    }
    get_height(): number {
      this.validate();
      return Number.isNaN(this._explicitHeight) ? this.measuredHeightValue : this._explicitHeight;
    }
    set_height(value: number): number {
      if (!Object.is(value, this._explicitHeight)) {
        this._explicitHeight = value;
        this.invalidate('size');
      }
      return value;
    }

    /** FeathersControl bounds describe the layout box, not only the visible ink. */
    getBounds(targetSpace: any, result: any = null): any {
      result ??= new Rectangle();
      const width = this.get_width();
      const height = this.get_height();
      if (targetSpace === this) {
        result.setTo(0, 0, width, height);
      } else {
        const matrix = this.getTransformationMatrix(targetSpace);
        const ax = matrix.a * width;
        const ay = matrix.b * width;
        const bx = matrix.c * height;
        const by = matrix.d * height;
        const left = Math.min(0, ax, bx, ax + bx);
        const top = Math.min(0, ay, by, ay + by);
        result.setTo(
          matrix.tx + left,
          matrix.ty + top,
          Math.max(0, ax, bx, ax + bx) - left,
          Math.max(0, ay, by, ay + by) - top,
        );
      }
      return result;
    }

    initializeNow(): void {
      if (this.initialized) return;
      this.initialized = true;
      this.initialize();
    }
    protected abstract initialize(): void;
    protected abstract draw(): void;
    invalidate(flag = 'all'): void {
      this.invalidFlags.add(flag);
    }
    isInvalid(flag?: string): boolean {
      const flags = this.flagsDuringDraw ?? this.invalidFlags;
      return flags.has('all') || (flag ? flags.has(flag) : flags.size > 0);
    }
    validate(): void {
      if (this.validating) return;
      this.initializeNow();
      if (!this.invalidFlags.size) return;
      this.validating = true;
      this.flagsDuringDraw = this.invalidFlags;
      this.invalidFlags = new Set();
      try {
        this.draw();
      } catch (error) {
        for (const flag of this.flagsDuringDraw) this.invalidFlags.add(flag);
        throw error;
      } finally {
        this.flagsDuringDraw = null;
        this.validating = false;
      }
    }
    protected saveMeasurements(
      width: number,
      height: number,
      _minWidth: number,
      _minHeight: number,
    ): void {
      this.measuredWidthValue = width;
      this.measuredHeightValue = height;
      this.setRequiresRedraw();
    }
    dispose(): void {
      this.removeEventListener('enterFrame', this.validateFrame);
      this.invalidFlags.clear();
      super.dispose();
    }
  }
  return BitmapTextAdapter;
}

/** The original format owns metrics only; the registry owns the font texture. */
export function createBitmapFontTextFormat(resolve: Resolve): any {
  const TextField = resolve('starling.text.TextField');
  return class BitmapFontTextFormat {
    font: any;
    letterSpacing = 0;
    isKerningEnabled = true;
    constructor(
      font: any,
      public size = NaN,
      public color = 0xffffff,
      public align = 'left',
      public leading = 0,
    ) {
      this.font = typeof font === 'string' ? TextField.getBitmapFont(font) : font;
      if (!this.font) throw Error('Bitmap font is not registered: ' + font);
    }
  };
}
