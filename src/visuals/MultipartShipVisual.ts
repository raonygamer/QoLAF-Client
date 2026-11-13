import { read, type Raw } from '../api/Types';
import type { ShipVisualPart } from './ShipVisualCatalog';

export interface RenderedShipPart {
  clip: Raw;
  visual: Raw;
  image: Raw;
  angle: number;
  rotationSpeed: number;
}

/** Native Starling assembly used by boss and spawner /sv appearances. */
export class MultipartShipVisual {
  readonly parts: RenderedShipPart[] = [];
  private container: Raw | null = null;
  private root: Raw | null = null;
  private rootWasVisible = true;
  private filter: Raw | null = null;
  private juggler: Raw;

  get display(): Raw | null {
    return this.container;
  }

  constructor(
    private ship: Raw,
    private resolve: (name: string) => any,
  ) {
    this.juggler = read(this.resolve('starling.core.Starling').get_current(), 'juggler');
  }

  apply(parts: ShipVisualPart[], originalColor: boolean): boolean {
    this.clear();
    const root = read(this.ship, 'movieClip');
    if (!root || parts.length === 0) return false;
    const Sprite = this.resolve('starling.display.Sprite');
    const container = new Sprite();
    container.set_touchable(false);
    this.container = container;
    try {
      for (const part of parts) {
        const clip = this.createClip(part);
        if (clip) container.addChild(clip);
      }
      if (!this.parts.length) {
        this.clear();
        return false;
      }
      this.root = root;
      this.rootWasVisible = read(root, 'visible', true);
      root.set_visible(false);
      this.refreshColor(originalColor);
      // A single hull shadow cannot represent an assembled hull.
      const shadow = this.ship.shadowImage;
      if (shadow) {
        shadow.removeFromParent(true);
        this.ship.shadowImage = null;
      }
      this.attach();
      return true;
    } catch (error) {
      this.clear();
      throw error;
    }
  }

  private createClip(part: ShipVisualPart): Raw | null {
    const visual = part.visual;
    if (visual?.bitmap == null) return null;
    const image = this.ship.g.dataManager.loadKey('Images', String(visual.bitmap));
    if (!image) return null;
    const textures = this.resolve('textures.TextureLocator')
      .getService()
      .getTexturesByKey(String(visual.bitmap), 'texture_main_NEW.png');
    if (!read(textures, 'length', 0)) return null;
    const MovieClip = this.resolve('starling.display.MovieClip');
    const delay = Number(image.animationDelay ?? 0);
    const fps = image.animate ? Math.max(1, Math.trunc(delay === 0 ? 33 : 33 / delay)) : 12;
    const ObjectVector = this.resolve('openfl._Vector.ObjectVector');
    const frames = Array.isArray(textures) ? new ObjectVector(0, false, textures) : textures;
    const clip = new MovieClip(frames, fps);
    clip.set_touchable(false);
    let scale = Number(image.scale ?? 1);
    if (Number.isNaN(scale) || scale === 0) scale = 1;
    clip.set_scaleX(scale);
    clip.set_scaleY(scale);
    clip.set_pivotX(Math.round((read(clip, 'width') * 0.5) / scale));
    clip.set_pivotY(Math.round((read(clip, 'height') * 0.5) / scale));
    if (image.mirror) clip.set_scaleY(-read(clip, 'scaleY'));
    let partScale = part.scale;
    if (Number.isNaN(partScale) || partScale === 0) partScale = 1;
    clip.set_scaleX(read(clip, 'scaleX') * partScale);
    clip.set_scaleY(read(clip, 'scaleY') * partScale);
    clip.set_x(part.x);
    clip.set_y(part.y);
    const angle = (part.angle * Math.PI) / 180;
    clip.set_rotation(angle);
    clip.set_blendMode(visual.blendModeAdd ? 'add' : 'normal');
    this.parts.push({ clip, visual, image, angle, rotationSpeed: part.rotationSpeed });
    if (image.animate && image.animateOnStart) {
      this.juggler.add(clip);
      clip.play();
    } else clip.stop();
    return clip;
  }

  advanceRotation(milliseconds: number): void {
    for (const part of this.parts) {
      if (!Number.isFinite(part.rotationSpeed) || part.rotationSpeed === 0) continue;
      part.angle += (part.rotationSpeed * milliseconds) / 1000;
      part.clip.set_rotation(part.angle);
    }
  }

  updateTransform(scale: number): void {
    const root = read(this.ship, 'movieClip');
    if (!this.container || !root || root !== this.root) return;
    this.container.set_x(read(root, 'x'));
    this.container.set_y(read(root, 'y'));
    this.container.set_rotation(read(root, 'rotation'));
    this.container.set_alpha(read(root, 'alpha'));
    this.container.set_scaleX(scale);
    this.container.set_scaleY(scale);
  }

  attach(): void {
    const canvas = this.ship.g.canvasPlayerShips;
    if (!this.container || !this.ship.isAddedToCanvas || read(this.container, 'parent') === canvas)
      return;
    let index = read(canvas, 'numChildren');
    if (this.root && read(this.root, 'parent') === canvas)
      index = canvas.getChildIndex(this.root) + 1;
    canvas.addChildAt(this.container, Math.min(index, read(canvas, 'numChildren')));
  }

  detach(): void {
    this.container?.removeFromParent();
  }

  private clearFilter(): void {
    this.container?.set_filter(null);
    this.filter?.dispose();
    this.filter = null;
  }

  refreshColor(originalColor: boolean): void {
    this.clearFilter();
    const fleet = this.ship.player?.getActiveFleetObj();
    if (!this.container || originalColor || !fleet) return;
    this.filter = this.resolve('core.ship.ShipFactory').createPlayerShipColorMatrixFilter(fleet);
    if (this.filter) this.container.set_filter(this.filter);
  }

  clear(): void {
    this.detach();
    this.clearFilter();
    for (const part of this.parts) {
      this.juggler.remove(part.clip);
      part.clip.stop();
    }
    this.parts.length = 0;
    this.container?.removeChildren(0, -1, true);
    this.container?.dispose();
    this.container = null;
    if (this.root) this.root.set_visible(this.rootWasVisible);
    this.root = null;
    this.rootWasVisible = true;
  }
}
