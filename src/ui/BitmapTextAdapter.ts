import {
  Sprite,
  Rectangle,
  type DisplayObject,
  type Point,
  type TextFormat,
} from '../game/Bindings';
interface FontStyles {
  getTextFormatForTarget(target: DisplayObject): TextFormat | null;
}
import { BitmapFontTextFormat } from './BitmapFontTextFormat';
import type { Resolve } from '../runtime/HaxeInterop';
import { ClientErrorDiagnostics } from '../diagnostics/ClientErrorDiagnostics';

/** Feathers' measurement/invalidation boundary, backed by native Starling nodes. */
export function createBitmapTextAdapter(resolve: Resolve) {
  // Source-ported subclasses also use the native display property aliases.
  resolve('starling.display.Sprite');
  abstract class BitmapTextAdapter extends Sprite {
    isQuickHitAreaEnabled = false;
    minTouchWidth = 0;
    minTouchHeight = 0;
    protected _text = '';
    protected _wordWrap = false;
    protected _explicitWidth = NaN;
    protected _explicitHeight = NaN;
    protected _explicitMaxWidth = Infinity;
    protected _fontStyles: FontStyles | null = null;
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
    get fontStyles(): TextFormat | null | undefined {
      return this._fontStyles?.getTextFormatForTarget(this);
    }
    set fontStyles(value: TextFormat | null | undefined) {
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
    getBounds(targetSpace: DisplayObject | null, result: Rectangle | null = null): Rectangle {
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

    /** Feathers labels hit their layout rectangle, not the untouchable glyph batches. */
    hitTest(localPoint: Point): DisplayObject | null {
      if (!this.isQuickHitAreaEnabled) return super.hitTest(localPoint);
      if (!this.get_visible() || !this.get_touchable() || !this.hitTestMask(localPoint))
        return null;
      const width = this.get_width();
      const height = this.get_height();
      const hitWidth = width < this.minTouchWidth ? this.minTouchWidth : width;
      const hitHeight = height < this.minTouchHeight ? this.minTouchHeight : height;
      const offsetX = (width - hitWidth) / 2;
      const offsetY = (height - hitHeight) / 2;
      const left = Number.isNaN(offsetX) ? 0 : offsetX;
      const top = Number.isNaN(offsetY) ? 0 : offsetY;
      return localPoint.x >= left &&
        localPoint.y >= top &&
        localPoint.x < left + hitWidth &&
        localPoint.y < top + hitHeight
        ? this
        : null;
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
        ClientErrorDiagnostics.record(
          error,
          'UI validation: ' + (this.__class__?.__name__ ?? this.constructor.name),
        );
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

/** Compatibility entry point for the source-class registry. */
export function createBitmapFontTextFormat(_resolve: Resolve): typeof BitmapFontTextFormat {
  return BitmapFontTextFormat;
}
