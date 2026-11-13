import type { API } from '../api/Types';
import { BitmapData, Image, Sprite, Texture, type GameScene } from '../game/Bindings';
import type { RenderedGameObject } from '../game/RenderedGameObject';
import type { TargetSystem } from '../target/TargetSystem';

/** Original TargetAimIndicator animation, using the current rendered ship pose. */
export class TargetAimIndicator {
  readonly node: Sprite;
  private readonly arrows: Image[] = [];
  private angleRotation = 0;
  private radiusAnimation = 0;

  constructor(
    private readonly target: TargetSystem,
    private readonly texture: Texture,
    arrows = 3,
    color = 0xffffff,
  ) {
    this.node = new Sprite();
    this.node.set_visible(false);
    this.node.set_touchable(false);
    for (let index = 0; index < Math.max(1, arrows); index++) {
      const arrow = new Image(texture);
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
    const clip = unit.get_movieClip();
    const rendered: RenderedGameObject = unit;
    // The Haxe interpolation bridge writes the visible pose onto the native clip.
    const centerX = rendered.get_renderX?.() ?? clip?.get_x() ?? unit.get_x();
    const centerY = rendered.get_renderY?.() ?? clip?.get_y() ?? unit.get_y();
    const diameter = clip ? Math.max(clip.get_width(), clip.get_height()) : 20;
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
    if (this.node.get_parent()) this.node.removeFromParent(true);
    else this.node.dispose();
    this.texture.dispose();
    this.arrows.length = 0;
  }
}

export function loadTargetAimIndicator(
  api: API,
  game: GameScene,
  target: TargetSystem,
  asset: string,
  ready: (indicator: TargetAimIndicator) => void,
): void {
  let alive = true;
  let indicator: TargetAimIndicator | undefined;
  let sourceBitmap: BitmapData | undefined;
  api.defer(() => {
    alive = false;
    indicator?.dispose();
    // Texture.onRestore retains this bitmap until the texture is disposed.
    sourceBitmap?.dispose();
    sourceBitmap = undefined;
  });
  const future = BitmapData.loadFromBase64(asset.slice(asset.indexOf(',') + 1), 'image/png');
  future.onError((error) => {
    if (alive) api.log('Target icon texture failed to load', error);
  });
  future.onComplete((bitmap) => {
    const canvas = game.canvas;
    if (!alive || !canvas) {
      bitmap.dispose();
      return;
    }
    let texture: Texture | undefined;
    try {
      texture = Texture.fromBitmapData(bitmap, false, false, 1);
      indicator = new TargetAimIndicator(target, texture);
      canvas.addChild(indicator.node);
      sourceBitmap = bitmap;
    } catch (error) {
      if (indicator) indicator.dispose();
      else texture?.dispose();
      indicator = undefined;
      bitmap.dispose();
      api.log('Target icon texture failed to initialize', error);
      return;
    }
    ready(indicator);
  });
}
