import { read, type API, type Raw } from '../api/Types';
import { setupRowLayout } from './SetupRowLayout';

/** Native display-list adapter for the original non-elastic horizontal setup row. */
export class ArtifactSetupRow {
  readonly root: Raw;
  private content: Raw;
  private mask: Raw;
  private track: Raw;
  private thumb: Raw | null = null;
  private thumbImage: Raw | null = null;
  private textures: Record<string, Raw> = {};
  private position = 0;
  private maximum = 0;
  private width = 650;
  private thumbWidth = 52;
  private drag: { id: number; x: number; position: number } | null = null;
  private alive = true;
  private point: Raw;
  private wheelSignal: Raw | null = null;
  private buttonPositions = new Map<Raw, { x: number; y: number }>();

  constructor(
    private api: API,
    private view: Raw,
    skins: () => Promise<Record<string, Raw>>,
  ) {
    const Sprite = api.cls('starling.display.Sprite') as any;
    const Quad = api.cls('starling.display.Quad') as any;
    const Point = api.cls('openfl.geom.Point') as any;
    class SetupViewport extends Sprite {
      frame: Raw;
      constructor() {
        super();
        this.frame = new Quad(1, 1, 0);
        this.frame.set_alpha(0.001);
        this.addChild(this.frame);
      }
      getBounds(target: Raw, result?: Raw): Raw {
        return this.frame ? this.frame.getBounds(target, result) : super.getBounds(target, result);
      }
      get_width(): number {
        return read(this.frame, 'width', 0);
      }
      get_height(): number {
        return read(this.frame, 'height', 0);
      }
    }
    this.root = new SetupViewport();
    this.content = new Sprite();
    this.mask = new Quad(650, 24, 0xffffff);
    this.root.set_mask(this.mask);
    this.root.addChild(this.content);
    this.track = new Quad(650, 8, 0);
    this.track.set_alpha(0.001);
    this.track.set_y(26);
    this.root.addChild(this.track);
    this.point = new Point();
    this.root.addEventListener('touch', this.onTouch);
    this.root.addEventListener('addedToStage', this.attachWheel);
    this.root.addEventListener('removedFromStage', this.detachWheel);
    view.addChild(this.root);
    if (read(this.root, 'stage')) this.attachWheel();
    for (const button of view.setups) {
      this.buttonPositions.set(button, { x: read(button, 'x'), y: read(button, 'y') });
      button.set_y(0);
      this.content.addChild(button);
    }
    this.layout();
    void skins()
      .then((textures) => {
        if (!this.alive || !textures.up) return;
        this.textures = textures;
        const Image = api.cls('starling.display.Image') as any;
        const Rectangle = api.cls('openfl.geom.Rectangle') as any;
        this.thumb = new Sprite();
        this.thumbImage = new Image(textures.up);
        this.thumbImage!.set_scale9Grid(new Rectangle(5, 2, 42, 6));
        this.thumb!.addChild(this.thumbImage);
        const icon = new Image(textures.icon);
        icon.set_touchable(false);
        icon.set_y(6);
        this.thumb!.addChild(icon);
        this.root.addChild(this.thumb);
        this.layout();
      })
      .catch((error) => api.log('Artifact setup scrollbar texture failed', error));
  }

  layout(): void {
    const view = this.view;
    this.width = view.expandedView ? view.viewWidth - 28 : 650;
    const first = view.activeSlots?.[0];
    const rowY = first ? read(first, 'y') + read(first, 'height') + 14 : 70;
    const last = view.setups.at(-1);
    const contentWidth = last ? read(last, 'x') + read(last, 'width') : 0;
    const layout = setupRowLayout(this.width, contentWidth, rowY, view.actionY ?? 480);
    this.maximum = layout.maximum;
    this.thumbWidth = layout.thumbWidth;
    this.root.set_x(view.expandedView ? 14 : 0);
    this.root.set_y(rowY);
    this.mask.set_width(this.width);
    this.mask.set_height(layout.height);
    this.root.frame.set_width(this.width);
    this.root.frame.set_height(layout.height);
    this.track.set_width(this.width);
    this.track.set_visible(this.maximum > 0);
    view.artifactSetupRowY = rowY;
    view.artifactSetupRowHeight = layout.height;
    view.artifactSetupSeparator?.set_y(rowY + layout.height + 6);
    if (!view.expandedView) {
      view.cargoY = layout.cargoY;
      view.cargoHeight = layout.cargoHeight;
      view.cargoContainer?.set_y(layout.cargoY);
      view.cargoContainer?.set_height(layout.cargoHeight);
    }
    if (this.thumb) {
      this.thumb.set_visible(this.maximum > 0);
      this.thumb.set_y(26);
      this.thumbImage!.set_width(this.thumbWidth);
      this.thumbImage!.set_height(8);
      this.thumb.getChildAt(1).set_x((this.thumbWidth - 7) / 2);
    }
    this.scrollTo(this.position);
  }

  scrollTo(position: number): void {
    this.position = Math.max(0, Math.min(position, this.maximum));
    this.content.set_x(-this.position);
    this.thumb?.set_x(
      this.maximum ? ((this.width - this.thumbWidth) * this.position) / this.maximum : 0,
    );
  }

  private within(node: Raw | null, parent: Raw | null): boolean {
    if (!parent) return false;
    for (; node; node = read(node, 'parent')) if (node === parent) return true;
    return false;
  }

  private attachWheel = (): void => {
    if (this.wheelSignal) return;
    const starling = this.api.cls('starling.core.Starling')?.get_current();
    this.wheelSignal = read(starling, 'nativeStage')?.window?.onMouseWheel ?? null;
    this.wheelSignal?.add(this.onWheel);
  };

  private detachWheel = (): void => {
    this.wheelSignal?.remove(this.onWheel);
    this.wheelSignal = null;
  };

  private onWheel = (deltaX: number, deltaY: number, mode: Raw): void => {
    if (!this.alive || !this.maximum || !read(this.root, 'stage')) return;
    const starling = this.api.cls('starling.core.Starling')!.get_current();
    const nativeStage = read(starling, 'nativeStage');
    const viewport = read(starling, 'viewPort');
    const scale =
      (read(starling, 'supportHighResolutions') ? read(nativeStage, 'contentsScaleFactor') : 1) /
      read(starling, 'contentScaleFactor');
    this.point.setTo(
      (read(nativeStage, 'mouseX') - viewport.x) * scale,
      (read(nativeStage, 'mouseY') - viewport.y) * scale,
    );
    if (!this.within(read(starling, 'stage').hitTest(this.point), this.root)) return;
    const delta = deltaX || deltaY;
    const distance =
      mode._hx_index === 1
        ? 38 * delta
        : mode._hx_index === 2
          ? this.width * delta
          : (delta * nativeStage.window.__scale * 38) / 100;
    this.scrollTo(this.position - distance);
  };

  private onTouch = (event: Raw): void => {
    const touch = this.drag
      ? event.getTouch(this.root, null, this.drag.id)
      : event.getTouch(this.root);
    if (!touch) {
      this.thumbImage?.set_texture(this.textures.up);
      return;
    }
    const phase = read(touch, 'phase');
    touch.getLocation(this.root, this.point);
    const x = this.point.x;
    const target = read(touch, 'target');
    if (phase === 'began') {
      if (this.within(target, this.thumb)) {
        this.drag = { id: read(touch, 'id'), x, position: this.position };
        this.thumbImage?.set_texture(this.textures.down);
      } else if (target === this.track) {
        this.scrollTo(this.position + (x < read(this.thumb, 'x', 0) ? -this.width : this.width));
      }
    } else if (phase === 'moved' && this.drag) {
      const travel = this.width - this.thumbWidth;
      if (travel > 0)
        this.scrollTo(this.drag.position + ((x - this.drag.x) * this.maximum) / travel);
    } else if (phase === 'ended') {
      this.drag = null;
      this.thumbImage?.set_texture(this.textures.up);
    } else if (phase === 'hover') {
      this.thumbImage?.set_texture(
        this.within(target, this.thumb) ? this.textures.hover : this.textures.up,
      );
    }
  };

  dispose(preserveButtons = false): void {
    if (!this.alive) return;
    this.alive = false;
    this.drag = null;
    this.root.removeEventListener('touch', this.onTouch);
    this.detachWheel();
    this.root.removeEventListener('addedToStage', this.attachWheel);
    this.root.removeEventListener('removedFromStage', this.detachWheel);
    if (preserveButtons) {
      for (const button of this.view.setups) {
        const position = this.buttonPositions.get(button);
        this.view.addChild(button);
        if (position) {
          button.set_x(position.x);
          button.set_y(position.y);
        }
      }
    }
    this.buttonPositions.clear();
    this.root.removeFromParent(true);
    this.mask.dispose();
  }
}
