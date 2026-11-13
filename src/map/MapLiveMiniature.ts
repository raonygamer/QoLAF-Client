import {
  Unit,
  GlowFilter,
  type Boss,
  type GameObject,
  type Sprite,
  type Image,
  type Texture,
} from '../game/Bindings';
import type { RenderedGameObject } from '../game/RenderedGameObject';
import { NativeUI } from '../ui/NativeUI';

/** Read the same rendered pose as the world ship, with native off-screen fallback. */
function renderValue(source: RenderedGameObject, key: 'x' | 'y' | 'rotation'): number {
  const clip = source.get_movieClip();
  if (key === 'x')
    return (
      source.get_renderX?.() ?? (source.isAddedToCanvas && clip ? clip.get_x() : source.get_x())
    );
  if (key === 'y')
    return (
      source.get_renderY?.() ?? (source.isAddedToCanvas && clip ? clip.get_y() : source.get_y())
    );
  return (
    source.get_renderRotation?.() ??
    (source.isAddedToCanvas && clip ? clip.get_rotation() : source.get_rotation())
  );
}

/** One borrowed live texture; disposing the miniature never disposes game assets. */
export class MapLiveMiniaturePart {
  readonly image: Image;
  private readonly sourceLife: number;
  private readonly liveTextures = new Set<Texture>();
  constructor(
    ui: NativeUI,
    private readonly source: GameObject,
    private readonly life: (object: GameObject) => number,
  ) {
    this.sourceLife = life(source);
    const texture = source.get_movieClip()?.get_texture();
    if (!texture) throw new Error('Cannot create a miniature part without its native texture');
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
    const clip = source.get_movieClip(),
      texture = clip?.get_texture();
    if (!clip || !texture) {
      image.set_visible(false);
      return;
    }
    if (image.get_texture() !== texture) {
      image.set_texture(texture);
      image.readjustSize();
    }
    const unit = source instanceof Unit;
    const alive = !unit || (source.alive && source.active && source.get_visible());
    if (unit && source.alive) this.liveTextures.add(texture);
    const explosion = unit && !source.alive && !this.liveTextures.has(texture);
    image.set_visible(alive || explosion);
    if (!image.get_visible()) return;
    image.set_pivotX(clip.get_pivotX());
    image.set_pivotY(clip.get_pivotY());
    image.set_scaleX(clip.get_scaleX() * scale);
    image.set_scaleY(clip.get_scaleY() * scale);
    image.set_color(clip.get_color());
    image.set_alpha(clip.get_alpha());
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
  readonly layer: Sprite;
  private readonly ownerLife: number;
  private readonly parts = new Map<number, MapLiveMiniaturePart>();
  private readonly pendingParts: Array<() => boolean> = [];
  private componentSources: GameObject[] = [];
  private componentCount = 0;
  private readonly bossOwner: Boss | null;

  constructor(
    private readonly ui: NativeUI,
    parent: Sprite,
    readonly gameObject: GameObject,
    private readonly boss: boolean,
    private readonly life: (object: GameObject) => number,
  ) {
    this.ownerLife = life(gameObject);
    // Callers classify bosses before constructing their miniature.
    this.bossOwner = boss ? (gameObject as Boss) : null;
    this.layer = ui.sprite();
    this.layer.set_touchable(false);
    const hostile =
      this.bossOwner?.isHostile ?? (gameObject instanceof Unit && gameObject.isHostile);
    // Current Haxe Starling has no FilterChain. The source chain contains only
    // this glow, so use its native filter directly with the same output settings.
    const glow = new GlowFilter(hostile ? 0xff3344 : 0xffffff, 0.9, 1.25, 0.9);
    glow.set_resolution(2);
    glow.set_textureSmoothing('bilinear');
    this.layer.set_filter(glow);
    parent.addChild(this.layer);
    this.buildParts();
  }

  get hasParts(): boolean {
    return this.parts.size > 0;
  }

  get ownsCurrentLifecycle(): boolean {
    return this.life(this.gameObject) === this.ownerLife;
  }

  private buildParts(): void {
    for (const part of this.parts.values()) part.dispose();
    this.parts.clear();
    this.pendingParts.length = 0;
    const objects: GameObject[] = this.bossOwner?.allComponents ?? [this.gameObject];
    this.componentCount = this.boss ? objects.length : 0;
    this.componentSources = [...objects];
    objects.forEach((object, index) => {
      if (!object) return;
      const generation = this.life(object);
      const attach = () => {
        // A pooled component may now belong to a different ship.
        if (this.life(object) !== generation) return true;
        if (!object.get_movieClip()?.get_texture()) return false;
        const part = new MapLiveMiniaturePart(this.ui, object, this.life);
        this.parts.set(index, part);
        this.layer.addChild(part.image);
        // Textures can arrive out of order; retain native component layering.
        const position = [...this.parts.keys()].filter((key) => key < index).length;
        this.layer.setChildIndex(part.image, position);
        return true;
      };
      if (!attach()) this.pendingParts.push(attach);
    });
  }

  update(mapScale: number): void {
    const owner = this.gameObject;
    if (
      !this.ownsCurrentLifecycle ||
      (this.bossOwner
        ? !this.bossOwner.alive || this.bossOwner.awaitingActivation
        : owner instanceof Unit && !owner.alive)
    ) {
      this.layer.set_visible(false);
      return;
    }
    if (
      this.bossOwner &&
      (this.componentCount !== this.bossOwner.allComponents.length ||
        this.componentSources.some(
          (source, index) => source !== this.bossOwner!.allComponents[index],
        ))
    )
      this.buildParts();
    for (let index = this.pendingParts.length - 1; index >= 0; index--)
      if (this.pendingParts[index]()) this.pendingParts.splice(index, 1);
    this.layer.set_visible(true);
    const x = renderValue(owner, 'x'),
      y = renderValue(owner, 'y');
    this.layer.set_x(x * mapScale);
    this.layer.set_y(y * mapScale);
    const scale = !this.boss
      ? 0.25
      : this.bossOwner?.key === 'GuaN7AnGeUW_U2c0bLlo6Q'
        ? 0.075
        : 0.1;
    for (const part of this.parts.values()) part.update(x, y, scale, this.boss);
  }

  dispose(): void {
    for (const part of this.parts.values()) part.dispose();
    this.parts.clear();
    this.pendingParts.length = 0;
    const filter = this.layer.get_filter();
    if (filter) {
      filter.dispose();
      this.layer.set_filter(null);
    }
    this.layer.removeFromParent(true);
  }
}
