import { read, type Raw } from '../Api/Types';
import { NativeUI } from '../UI/NativeUI';

/** Read the same rendered pose as the world ship, with native off-screen fallback. */
function renderValue(source: Raw, key: 'x' | 'y' | 'rotation'): number {
  const renderKey = key === 'rotation' ? 'renderRotation' : key === 'x' ? 'renderX' : 'renderY';
  const clip = read(source, 'movieClip');
  return read(
    source,
    renderKey,
    read(source, 'isAddedToCanvas') && clip ? read(clip, key) : read(source, key),
  );
}

/** One borrowed live texture; disposing the miniature never disposes game assets. */
export class MapLiveMiniaturePart {
  readonly image: Raw;
  private readonly sourceLife: number;
  private readonly liveTextures = new Set<Raw>();
  constructor(
    ui: NativeUI,
    private readonly source: Raw,
    private readonly life: (object: Raw) => number,
    private readonly isUnit: (object: Raw) => boolean,
  ) {
    this.sourceLife = life(source);
    const texture = read(read(source, 'movieClip'), 'texture');
    this.liveTextures.add(texture);
    this.image = ui.image(texture);
    this.image.set_textureSmoothing('bilinear');
    this.image.set_touchable(false);
  }

  update(ownerX: number, ownerY: number, scale: number, multipart: boolean): void {
    const source = this.source,
      image = this.image;
    if (this.life(source) !== this.sourceLife) {
      image.set_visible(false);
      return;
    }
    const clip = read(source, 'movieClip'),
      texture = read(clip, 'texture');
    if (!clip || !texture) {
      image.set_visible(false);
      return;
    }
    if (read(image, 'texture') !== texture) {
      image.set_texture(texture);
      image.readjustSize();
    }
    const unit = this.isUnit(source);
    const alive = !unit || (source.alive && source.active && read(source, 'visible'));
    if (unit && source.alive) this.liveTextures.add(texture);
    const explosion = unit && !source.alive && !this.liveTextures.has(texture);
    image.set_visible(alive || explosion);
    if (!read(image, 'visible')) return;
    image.set_pivotX(read(clip, 'pivotX'));
    image.set_pivotY(read(clip, 'pivotY'));
    image.set_scaleX(read(clip, 'scaleX') * scale);
    image.set_scaleY(read(clip, 'scaleY') * scale);
    image.set_color(read(clip, 'color'));
    image.set_alpha(read(clip, 'alpha'));
    image.set_x(multipart ? (renderValue(source, 'x') - ownerX) * scale : 0);
    image.set_y(multipart ? (renderValue(source, 'y') - ownerY) * scale : 0);
    image.set_rotation(renderValue(source, 'rotation'));
  }

  dispose(): void {
    this.image.removeFromParent(true);
    this.liveTextures.clear();
  }
}

/** Original live hull/component miniature, with hostile red or friendly white glow. */
export class MapLiveMiniature {
  readonly layer: Raw;
  private readonly ownerLife: number;
  private readonly parts: MapLiveMiniaturePart[] = [];
  private componentCount = 0;
  private readonly isUnit: (object: Raw) => boolean;

  constructor(
    private readonly ui: NativeUI,
    parent: Raw,
    readonly gameObject: Raw,
    private readonly boss: boolean,
    private readonly life: (object: Raw) => number,
  ) {
    this.ownerLife = life(gameObject);
    const Unit = ui.api.cls('core.unit.Unit');
    this.isUnit = (object) => !!Unit?.prototype.isPrototypeOf(object);
    this.layer = ui.sprite();
    this.layer.set_touchable(false);
    const hostile = (boss || this.isUnit(gameObject)) && read(gameObject, 'isHostile');
    const Glow = ui.cls('starling.filters.GlowFilter');
    // Current Haxe Starling has no FilterChain. The source chain contains only
    // this glow, so use its native filter directly with the same output settings.
    const glow = new Glow(hostile ? 0xff3344 : 0xffffff, 0.9, 1.25, 0.9);
    glow.set_resolution(2);
    glow.set_textureSmoothing('bilinear');
    this.layer.set_filter(glow);
    parent.addChild(this.layer);
    this.buildParts();
  }

  get ownsCurrentLifecycle(): boolean {
    return this.life(this.gameObject) === this.ownerLife;
  }

  private buildParts(): void {
    for (const part of this.parts) part.dispose();
    this.parts.length = 0;
    const objects: Raw[] = this.boss ? this.gameObject.allComponents : [this.gameObject];
    this.componentCount = this.boss ? objects.length : 0;
    for (const object of objects) {
      if (!object || !read(read(object, 'movieClip'), 'texture')) continue;
      const part = new MapLiveMiniaturePart(this.ui, object, this.life, this.isUnit);
      this.parts.push(part);
      this.layer.addChild(part.image);
    }
  }

  update(mapScale: number): void {
    const owner = this.gameObject;
    if (
      !this.ownsCurrentLifecycle ||
      (this.boss ? !owner.alive || owner.awaitingActivation : this.isUnit(owner) && !owner.alive)
    ) {
      this.layer.set_visible(false);
      return;
    }
    if (this.boss && this.componentCount !== owner.allComponents.length) this.buildParts();
    this.layer.set_visible(true);
    const x = renderValue(owner, 'x'),
      y = renderValue(owner, 'y');
    this.layer.set_x(x * mapScale);
    this.layer.set_y(y * mapScale);
    const scale = !this.boss ? 0.25 : owner.key === 'GuaN7AnGeUW_U2c0bLlo6Q' ? 0.075 : 0.1;
    for (const part of this.parts) part.update(x, y, scale, this.boss);
  }

  dispose(): void {
    for (const part of this.parts) part.dispose();
    this.parts.length = 0;
    const filter = read(this.layer, 'filter');
    if (filter) {
      filter.dispose();
      this.layer.set_filter(null);
    }
    this.layer.removeFromParent(true);
  }
}
