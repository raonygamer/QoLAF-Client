// Source port of core/hud/components/dialogs/PlayerInspectCard.as.
import { bound, type Resolve } from '../runtime/HaxeInterop';
export function createPlayerInspectCard(resolve: Resolve): any {
  type AS3Utils = any;
  const Text: any = resolve('core.hud.components.Text');
  type Text = any;
  const FleetObj: any = resolve('core.player.FleetObj');
  type FleetObj = any;
  type Game = any;
  const ShipFactory: any = resolve('core.ship.ShipFactory');
  type ShipFactory = any;
  const Point: any = resolve('openfl.geom.Point');
  type Point = any;
  const Rectangle: any = resolve('openfl.geom.Rectangle');
  type Rectangle = any;
  type IInput = any;
  const InputLocator: any = resolve('io.InputLocator');
  type InputLocator = any;
  type DisplayObject = any;
  const Image: any = resolve('starling.display.Image');
  type Image = any;
  const Quad: any = resolve('starling.display.Quad');
  type Quad = any;
  const Sprite: any = resolve('starling.display.Sprite');
  type Sprite = any;
  const Event: any = resolve('starling.events.Event');
  type Event = any;
  resolve('starling.events.Touch');
  type Touch = any;
  const TouchEvent: any = resolve('starling.events.TouchEvent');
  type TouchEvent = any;
  const TouchPhase: any = resolve('starling.events.TouchPhase');
  type TouchPhase = any;
  type ColorMatrixFilter = any;
  type Texture = any;
  /** Read-only inspect surface. Textures are borrowed; paint filters are owned. */

  class PlayerInspectCard extends Sprite {
    private static DRAG_DISTANCE_SQUARED: number = 36;
    private g: Game = null as any;
    private cardWidth: number = 0;
    private cardHeight: number = 0;
    private initialHeight: number = 0;
    private decoration: Sprite = new Sprite();
    private background: Quad = null as any;
    private topBorder: Quad = null as any;
    private bottomBorder: Quad = null as any;
    private leftBorder: Quad = null as any;
    private rightBorder: Quad = null as any;
    private ownedFilters: ColorMatrixFilter[] = [];
    private filteredImages: Image[] = [];
    private selection: Function | null = null;
    private pressedId: number = -1;
    private pressGlobalX: number = 0;
    private pressGlobalY: number = 0;
    private pressLocalX: number = 0;
    private pressLocalY: number = 0;
    private dragged: boolean = false;
    private scratchPoint: Point = new Point();
    private scratchBounds: Rectangle = new Rectangle();
    private stopped: boolean = false;
    constructor(
      game: Game,
      width: number,
      height: number,
      accent: number = 0x424242,
      selected: boolean = false,
    ) {
      super();
      this.g = game;
      this.cardWidth = isFinite(width) ? Math.max(1, width) : 1;
      this.initialHeight = this.cardHeight = isFinite(height) ? Math.max(1, height) : 1;
      this.addChild(this.decoration);
      this.background = new Quad(this.cardWidth, this.cardHeight, selected ? 0x202631 : 0x141820);
      this.decoration.addChild(this.background);
      this.topBorder = this.makeBorder(this.cardWidth, 1, accent);
      this.bottomBorder = this.makeBorder(this.cardWidth, 1, accent);
      this.leftBorder = this.makeBorder(selected ? 3 : 1, this.cardHeight, accent);
      this.rightBorder = this.makeBorder(1, this.cardHeight, accent);
      if (!selected) {
        this.topBorder.alpha = this.bottomBorder.alpha = this.rightBorder.alpha = 0.65;
      }
      this.resizeBackground();
      this.addEventListener(Event.REMOVED_FROM_STAGE, this.onRemoved);
    }
    @bound
    public addText(
      value: string,
      x: number,
      y: number,
      width: number,
      size: number = 12,
      color: number = 0xeeeeee,
      html: boolean = false,
    ): Text {
      var label: Text = new Text(0, 0, true, 'Verdana');
      label.x = isFinite(x) ? x : 0;
      label.y = isFinite(y) ? y : 0;
      label.width = Math.max(
        1,
        Math.min(isFinite(width) ? width : this.cardWidth, this.cardWidth - label.x - 1),
      );
      label.size = Math.max(1, size);
      label.color = color;
      // Set content last: Text measures the wrapped bitmap glyphs and grows
      // its own viewport vertically. Never force a font-size-only height.
      if (html) label.htmlText = value == null ? '' : value;
      else label.text = value == null ? '' : value;
      this.addChild(label);
      return label;
    }
    /** Missing/invalid catalog textures add a visible placeholder and return null. */
    @bound
    public addIcon(bitmap: string, x: number, y: number, size: number): Image {
      var texture: Texture;
      try {
        if (this.hasImageRecord(bitmap)) {
          texture = this.g.textureManager.getTextureGUIByKey(bitmap);
        }
      } catch (error: any) {
        // Optional saved cosmetics must never prevent opening inspection.
      }
      return this.addPreview(texture, x, y, size, size);
    }
    @bound
    public addShip(
      bitmap: string,
      paint: any,
      x: number,
      y: number,
      width: number,
      height: number,
    ): Image {
      var texture: Texture;
      try {
        if (this.hasImageRecord(bitmap)) {
          var frames: Texture[] = this.g.textureManager.getTexturesMainByKey(bitmap);
          if (frames != null && frames.length > 0) texture = frames[0];
        }
      } catch (error: any) {}
      var preview: Image = this.addPreview(texture, x, y, width, height);
      if (preview != null && paint != null) {
        var fleet: FleetObj = new FleetObj();
        var hasPaint = false;

        for (var key of Object.values<any>([
          'shipHue',
          'shipSaturation',
          'shipBrightness',
          'shipContrast',
        ])) {
          if (key in paint && isFinite(Number(paint[key]))) {
            fleet[key] = Number(paint[key]);
            hasPaint = hasPaint || fleet[key] != 0;
          }
        }
        if (hasPaint) {
          var filter: ColorMatrixFilter = ShipFactory.createPlayerShipColorMatrixFilter(fleet);
          if (filter != null) {
            preview.filter = filter;
            this.ownedFilters.push(filter);
            this.filteredImages.push(preview);
          }
        }
      }
      return preview;
    }
    @bound
    private hasImageRecord(bitmap: string): boolean {
      return (
        this.g != null &&
        this.g.textureManager != null &&
        this.g.dataManager != null &&
        bitmap != null &&
        bitmap.length > 0 &&
        this.g.dataManager.loadKey('Images', bitmap) != null
      );
    }
    @bound
    private addPreview(
      texture: Texture,
      x: number,
      y: number,
      width: number,
      height: number,
    ): Image {
      var slotWidth: number = isFinite(width) ? Math.max(1, width) : 1;
      var slotHeight: number = isFinite(height) ? Math.max(1, height) : 1;
      if (texture == null || texture.width <= 0 || texture.height <= 0) {
        var missing: Text = this.addText(
          '?',
          x,
          y,
          slotWidth,
          Math.max(10, Math.min(20, Math.trunc(slotHeight * 0.65))),
          0x8792a3,
        );
        missing.alignCenter();
        missing.x = x + slotWidth / 2;
        missing.y = y + Math.max(0, (slotHeight - missing.height) / 2);
        return null;
      }
      var preview: Image = new Image(texture);
      preview.touchable = false;
      preview.scaleX = preview.scaleY = Math.min(
        slotWidth / texture.width,
        slotHeight / texture.height,
      );
      preview.x = x + (slotWidth - preview.width) / 2;
      preview.y = y + (slotHeight - preview.height) / 2;
      this.addChild(preview);
      return preview;
    }
    /** Call after adding details/tiles. Own decorations never inflate content. */
    @bound
    public fitHeight(minimum: number = 0): number {
      var bottom: number = 0;
      for (var i: number = 0; i < this.numChildren; i++) {
        var child: DisplayObject = this.getChildAt(i);
        if (child == this.decoration) continue;
        child.getBounds(this, this.scratchBounds);
        if (isFinite(this.scratchBounds.bottom))
          bottom = Math.max(bottom, this.scratchBounds.bottom);
        // Text.height is its measured wrapped height, including lines
        // whose trailing whitespace does not contribute glyph bounds.
        if (child instanceof Text) bottom = Math.max(bottom, child.y + child.height);
      }
      this.cardHeight = Math.max(this.initialHeight, isFinite(minimum) ? minimum : 0, bottom + 12);
      this.resizeBackground();
      return this.cardHeight;
    }
    @bound
    /*override*/
    public getBounds(targetSpace: DisplayObject, resultRect: Rectangle = null): Rectangle {
      return this.background == null
        ? super.getBounds(targetSpace, resultRect)
        : this.background.getBounds(targetSpace, resultRect);
    }
    @bound
    private makeBorder(width: number, height: number, color: number): Quad {
      var border: Quad = new Quad(width, height, color);
      this.decoration.addChild(border);
      return border;
    }
    @bound
    private resizeBackground(): void {
      this.background.height = this.cardHeight;
      this.leftBorder.height = this.rightBorder.height = this.cardHeight;
      this.bottomBorder.y = this.cardHeight - 1;
      this.rightBorder.x = this.cardWidth - 1;
    }
    @bound
    public onSelect(callback: Function): void {
      this.selection = callback;
      this.pressedId = -1;
      this.useHandCursor = callback != null;
      this.removeEventListener(TouchEvent.TOUCH, this.onCardTouch);
      if (callback != null) this.addEventListener(TouchEvent.TOUCH, this.onCardTouch);
    }
    @bound
    private onCardTouch(event: TouchEvent): void {
      var touch: Touch = event.getTouch(this);
      var input: IInput = InputLocator.getService();
      if (touch == null || touch.cancelled || (input != null && input.isMouseRightPressed)) {
        this.pressedId = -1;
        return;
      }
      touch.getLocation(this, this.scratchPoint);
      if (touch.phase == TouchPhase.BEGAN) {
        // A nested card or back button owns its own selection gesture.
        if (!this.decoration.contains(touch.target)) return;
        this.pressedId = touch.id;
        this.pressGlobalX = touch.globalX;
        this.pressGlobalY = touch.globalY;
        this.pressLocalX = this.scratchPoint.x;
        this.pressLocalY = this.scratchPoint.y;
        this.dragged = false;
      } else if (touch.id == this.pressedId) {
        var dx: number = touch.globalX - this.pressGlobalX;
        var dy: number = touch.globalY - this.pressGlobalY;
        var localDx: number = this.scratchPoint.x - this.pressLocalX;
        var localDy: number = this.scratchPoint.y - this.pressLocalY;
        this.dragged =
          this.dragged ||
          dx * dx + dy * dy > PlayerInspectCard.DRAG_DISTANCE_SQUARED ||
          localDx * localDx + localDy * localDy > PlayerInspectCard.DRAG_DISTANCE_SQUARED;
        if (touch.phase == TouchPhase.ENDED) {
          this.pressedId = -1;
          if (
            !this.dragged &&
            this.scratchPoint.x >= 0 &&
            this.scratchPoint.x <= this.cardWidth &&
            this.scratchPoint.y >= 0 &&
            this.scratchPoint.y <= this.cardHeight &&
            this.selection != null
          ) {
            this.selection();
          }
        }
      }
      // Do not stop propagation: ScrollContainer must still receive drags.
    }
    @bound
    private onRemoved(event: Event): void {
      this.pressedId = -1;
    }
    @bound
    /*override*/
    public dispose(): void {
      if (this.stopped) return;
      this.stopped = true;
      this.selection = null;
      this.pressedId = -1;
      this.removeEventListeners();
      for (var i: number = 0; i < this.ownedFilters.length; i++) {
        if (this.filteredImages[i].filter === this.ownedFilters[i])
          this.filteredImages[i].filter = null;
        this.ownedFilters[i].dispose();
      }
      this.ownedFilters.length = 0;
      this.filteredImages.length = 0;
      this.g = null;
      // Image/Text disposal never disposes the borrowed atlas textures.
      super.dispose();
    }
  }

  return PlayerInspectCard;
}
