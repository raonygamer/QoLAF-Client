import { read, type Raw } from '../api/Types';
import { NativeUI } from './NativeUI';
import type { TargetSystem } from '../target/TargetSystem';

/** Original TargetAimIndicator animation, using the current rendered ship pose. */
export class TargetAimIndicator {
  readonly node: Raw;
  private readonly arrows: Raw[] = [];
  private angleRotation = 0;
  private radiusAnimation = 0;

  constructor(
    private readonly ui: NativeUI,
    private readonly target: TargetSystem,
    private readonly texture: Raw,
    arrows = 3,
    color = 0xffffff,
  ) {
    this.node = ui.sprite();
    this.node.set_visible(false);
    this.node.set_touchable(false);
    for (let index = 0; index < Math.max(1, arrows); index++) {
      const arrow = ui.image(texture);
      arrow.set_color(color);
      arrow.alignPivot();
      arrow.set_touchable(false);
      this.node.addChild(arrow);
      this.arrows.push(arrow);
    }
  }

  update(seconds: number, disabled: boolean): void {
    const unit = this.target.current;
    const visible = !disabled && this.target.valid(unit);
    this.node.set_visible(visible);
    if (!this.target.valid(unit) || !unit) return;
    const clip = read(unit, 'movieClip');
    const position = read(unit, 'pos');
    // The Haxe interpolation bridge writes the visible pose onto the native clip.
    const centerX = read(unit, 'renderX', read(clip, 'x', position?.x));
    const centerY = read(unit, 'renderY', read(clip, 'y', position?.y));
    const diameter = clip ? Math.max(read(clip, 'width'), read(clip, 'height')) : 20;
    const radius = diameter * 0.5 + 25 + Math.sin(this.radiusAnimation) * 4;
    this.arrows.forEach((arrow, index) => {
      const radians = ((this.angleRotation + (index * 360) / this.arrows.length) * Math.PI) / 180;
      const x = centerX + radius * Math.cos(radians);
      const y = centerY + radius * Math.sin(radians);
      arrow.set_x(x);
      arrow.set_y(y);
      arrow.set_rotation(Math.atan2(centerY - y, centerX - x));
    });
    this.angleRotation += 32 * seconds;
    this.radiusAnimation += 6 * seconds;
  }

  dispose(): void {
    this.ui.dispose(this.node);
    this.texture.dispose();
    this.arrows.length = 0;
  }
}

export function loadTargetAimIndicator(
  ui: NativeUI,
  game: Raw,
  target: TargetSystem,
  asset: string,
  ready: (indicator: TargetAimIndicator) => void,
): void {
  let alive = true;
  let indicator: TargetAimIndicator | undefined;
  ui.api.defer(() => {
    alive = false;
    indicator?.dispose();
  });
  const future = ui
    .cls('openfl.display.BitmapData')
    .loadFromBase64(asset.slice(asset.indexOf(',') + 1), 'image/png');
  future.onError((error: unknown) => {
    if (alive) ui.api.log('Target icon texture failed to load', error);
  });
  future.onComplete((bitmap: Raw) => {
    if (!alive) {
      bitmap.dispose();
      return;
    }
    const texture = ui.cls('starling.textures.Texture').fromBitmapData(bitmap, false, false, 1);
    indicator = new TargetAimIndicator(ui, target, texture);
    game.canvas.addChild(indicator.node);
    ready(indicator);
  });
}
