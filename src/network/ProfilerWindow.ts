import type { Game } from '../game/Game';
import type { Raw } from '../api/Types';
import type { Resolve } from '../runtime/HaxeInterop';

export interface ProfilerPanel {
  stateProvider: (() => unknown) | null;
  resetHandler: (() => void) | null;
  activeChanged: ((active: boolean) => void) | null;
  toggle(container: Game.openfl.display.DisplayObjectContainer): boolean;
  restore(container: Game.openfl.display.DisplayObjectContainer): boolean;
  dispose(): void;
}

const windowClasses = new WeakMap<object, new () => ProfilerPanel>();

/** Original native display profiler panel, adapted to OpenFL without a DOM overlay. */
export function createProfilerWindow(resolve: Resolve): new () => ProfilerPanel {
  resolve('openfl.display.Stage');
  const Sprite = resolve('openfl.display.Sprite');
  const Shape = resolve('openfl.display.Shape');
  const TextField = resolve('openfl.text.TextField');
  const TextFormat = resolve('openfl.text.TextFormat');
  const Timer = resolve('openfl.utils.Timer');
  const Point = resolve('openfl.geom.Point');
  const Rectangle = resolve('openfl.geom.Rectangle');
  const Event = resolve('openfl.events.Event');
  const MouseEvent = resolve('openfl.events.MouseEvent');
  const KeyboardEvent = resolve('openfl.events.KeyboardEvent');
  const TimerEvent = resolve('openfl.events.TimerEvent');
  const Keyboard = resolve('openfl.ui.Keyboard');
  // Aliases belong to the current room scope, even when geometry/class state survives.
  const cached = windowClasses.get(Sprite);
  if (cached) return cached;
  type DisplayObject = Raw;
  type DisplayObjectContainer = Raw;
  type Stage = Raw;
  type Sprite = Raw;
  type Shape = Raw;
  type TextField = Raw;
  type TextFormat = Raw;
  type Timer = Raw;
  type Point = Raw;
  type Rectangle = Raw;
  type Event = Raw;
  type MouseEvent = Raw;
  type KeyboardEvent = Raw;
  type TimerEvent = Raw;
  type Keyboard = Raw;
  const MIN_WIDTH: number = 390;
  const MIN_HEIGHT: number = 190;
  const TITLE_HEIGHT: number = 24;
  const UPDATE_INTERVAL_MS: number = 250;
  const MAX_TEXT_LENGTH: number = 262144;
  let shouldRestore: boolean = false;
  let savedX: number = 20;
  let savedY: number = 52;
  let savedWidth: number = 760;
  let savedHeight: number = 480;
  class ProfilerWindow extends Sprite {
    public stateProvider: (() => unknown) | null = null;
    public resetHandler: (() => void) | null = null;
    public activeChanged: ((active: boolean) => void) | null = null;

    private windowWidth: number = savedWidth;
    private windowHeight: number = savedHeight;
    private frame: Shape = new Shape();
    private titleBar: Sprite = new Sprite();
    private titleText: TextField;
    private pauseButton: TextField;
    private resetButton: TextField;
    private closeButton: TextField;
    private output: TextField;
    private resizeGrip: Sprite = new Sprite();
    private refreshTimer: Timer = new Timer(UPDATE_INTERVAL_MS);
    private listenerStage: Stage | null = null;
    private pointerStage: Stage | null = null;
    private dragging: boolean = false;
    private resizing: boolean = false;
    private dragOffsetX = 0;
    private dragOffsetY = 0;
    private resizeStartX = 0;
    private resizeStartY = 0;
    private resizeStartWidth = 0;
    private resizeStartHeight = 0;
    private paused: boolean = false;
    private _active: boolean = false;
    private disposed: boolean = false;

    constructor() {
      super();
      this.x = savedX;
      this.y = savedY;
      this.mouseEnabled = this.mouseChildren = true;
      this.addChild(this.frame);
      this.addChild(this.titleBar);
      this.titleBar.buttonMode = true;
      this.titleBar.useHandCursor = false;
      this.titleBar.addEventListener(MouseEvent.MOUSE_DOWN, this.onDragStart);
      this.titleText = this.createTextField(12, 0xffffff, true);
      this.titleText.text = 'LIVE PROFILER';
      this.titleText.mouseEnabled = false;
      this.titleBar.addChild(this.titleText);
      this.closeButton = this.createButton('X', this.onClose);
      this.titleBar.addChild(this.closeButton);
      this.pauseButton = this.createButton('PAUSE', this.onTogglePause);
      this.resetButton = this.createButton('RESET', this.onReset);
      this.addChild(this.pauseButton);
      this.addChild(this.resetButton);

      this.output = this.createTextField(11, 0xdce4f2, false);
      this.output.background = true;
      this.output.backgroundColor = 0x05070a;
      this.output.border = true;
      this.output.borderColor = 0x596273;
      this.output.multiline = true;
      this.output.wordWrap = false;
      this.output.selectable = true;
      this.output.mouseWheelEnabled = false; // Scroll explicitly; never zoom the world.
      this.output.text = 'Waiting for profiler data...';
      this.addChild(this.output);
      this.resizeGrip.buttonMode = true;
      this.resizeGrip.useHandCursor = false;
      this.resizeGrip.addEventListener(MouseEvent.MOUSE_DOWN, this.onResizeStart);
      this.addChild(this.resizeGrip);

      this.refreshTimer.addEventListener(TimerEvent.TIMER, this.onRefresh);
      this.addEventListener(Event.ADDED_TO_STAGE, this.onAddedToStage);
      this.addEventListener(Event.REMOVED_FROM_STAGE, this.onRemovedFromStage);
      this.addEventListener(MouseEvent.MOUSE_DOWN, this.onMouseDown);
      this.addEventListener(MouseEvent.MOUSE_MOVE, this.consumeMouseEvent);
      this.addEventListener(MouseEvent.CLICK, this.consumeMouseEvent);
      this.addEventListener(MouseEvent.DOUBLE_CLICK, this.consumeMouseEvent);
      this.addEventListener(MouseEvent.RIGHT_MOUSE_DOWN, this.consumeMouseEvent);
      this.addEventListener(MouseEvent.RIGHT_CLICK, this.consumeMouseEvent);
      this.addEventListener(MouseEvent.MOUSE_WHEEL, this.onMouseWheel);
      this.addEventListener(KeyboardEvent.KEY_DOWN, this.consumeKeyEvent);
      this.redraw();
    }

    public get active(): boolean {
      return this._active;
    }

    public toggle(container: DisplayObjectContainer): boolean {
      if (this._active) this.hide();
      else this.show(container);
      return this._active;
    }

    public restore(container: DisplayObjectContainer): boolean {
      if (!shouldRestore || container == null || this.disposed) return false;
      this.show(container);
      return this._active;
    }

    private show(container: DisplayObjectContainer): void {
      if (container == null || this.disposed) return;
      shouldRestore = true;
      if (this.parent !== container) {
        if (this.parent != null) this.parent.removeChild(this);
        container.addChild(this);
      }
      if (this.stage != null) this.activate();
    }

    public hide(clearRestore: boolean = true): void {
      if (clearRestore) shouldRestore = false;
      this.deactivate();
      if (this.parent != null) this.parent.removeChild(this);
    }

    private onAddedToStage = (event: Event): void => {
      if (!this.disposed) this.activate();
    };

    private activate(): void {
      if (this._active || this.stage == null || this.disposed) return;
      this.listenerStage = this.stage;
      if (!this.listenerStage) return;
      // Enter is intercepted by the game's native capture handler. Stop
      // keys aimed at this panel before that handler, without preventing
      // the TextField's native copy/selection defaults.
      this.listenerStage.addEventListener(
        KeyboardEvent.KEY_DOWN,
        this.onCapturedKey,
        true,
        2147483647,
      );
      this.listenerStage.addEventListener(Event.RESIZE, this.onStageResize);
      this._active = true;
      shouldRestore = true;
      this.constrainToStage();
      this.notifyActiveChanged();
      if (!this._active || this.disposed) return;
      if (!this.paused) this.updateOutput();
      if (this._active && !this.disposed) this.refreshTimer.start();
    }

    private onRemovedFromStage = (event: Event): void => {
      this.deactivate();
    };

    private deactivate(): void {
      this.refreshTimer.stop();
      this.stopPointerOperation();
      if (this.listenerStage != null) {
        if (this.listenerStage.focus != null && this.contains(this.listenerStage.focus)) {
          this.listenerStage.focus = null;
        }
        this.listenerStage.removeEventListener(KeyboardEvent.KEY_DOWN, this.onCapturedKey, true);
        this.listenerStage.removeEventListener(Event.RESIZE, this.onStageResize);
        this.listenerStage = null;
      }
      if (!this._active) return;
      this.saveGeometry();
      this._active = false;
      this.notifyActiveChanged();
    }

    private notifyActiveChanged(): void {
      if (this.activeChanged == null) return;
      try {
        this.activeChanged(this._active);
      } catch (error) {
        // Diagnostics must not interrupt room teardown or input cleanup.
      }
    }

    private stageBoundsInParent(): Rectangle {
      let first: Point = this.parent.globalToLocal(new Point(0, 0));
      let last: Point = this.parent.globalToLocal(
        new Point(this.stage.stageWidth, this.stage.stageHeight),
      );
      return new Rectangle(
        Math.min(first.x, last.x),
        Math.min(first.y, last.y),
        Math.abs(last.x - first.x),
        Math.abs(last.y - first.y),
      );
    }

    public constrainToStage(): void {
      if (
        this.stage == null ||
        this.parent == null ||
        this.stage.stageWidth <= 0 ||
        this.stage.stageHeight <= 0
      )
        return;
      let bounds: Rectangle = this.stageBoundsInParent();
      if (bounds.width <= 0 || bounds.height <= 0) return;
      this.windowWidth = Math.max(
        Math.min(MIN_WIDTH, bounds.width),
        Math.min(this.windowWidth, bounds.width),
      );
      this.windowHeight = Math.max(
        Math.min(MIN_HEIGHT, bounds.height),
        Math.min(this.windowHeight, bounds.height),
      );
      this.x = Math.max(bounds.x, Math.min(this.x, bounds.right - this.windowWidth));
      this.y = Math.max(bounds.y, Math.min(this.y, bounds.bottom - this.windowHeight));
      this.saveGeometry();
      this.redraw();
    }

    private saveGeometry(): void {
      savedX = this.x;
      savedY = this.y;
      savedWidth = this.windowWidth;
      savedHeight = this.windowHeight;
    }

    private onStageResize = (event: Event): void => {
      this.stopPointerOperation();
      this.constrainToStage();
    };

    private createTextField(size: number, color: number, bold: boolean): TextField {
      let field: TextField = new TextField();
      field.defaultTextFormat = new TextFormat('_typewriter', size, color, bold);
      field.embedFonts = false;
      field.selectable = false;
      field.textColor = color;
      return field;
    }

    private createButton(label: string, handler: (event: Raw) => void): TextField {
      let button: TextField = this.createTextField(10, 0xffffff, true);
      button.text = label;
      button.background = true;
      button.backgroundColor = 0x263142;
      button.border = true;
      button.borderColor = 0x63738a;
      button.height = 20;
      button.addEventListener(MouseEvent.CLICK, handler);
      button.addEventListener(MouseEvent.MOUSE_DOWN, this.onButtonMouseDown);
      return button;
    }

    private redraw(): void {
      this.frame.graphics.clear();
      this.frame.graphics.beginFill(0x090b10, 0.96);
      this.frame.graphics.lineStyle(1, 0x738096, 1);
      this.frame.graphics.drawRect(0, 0, this.windowWidth, this.windowHeight);
      this.frame.graphics.endFill();
      this.titleBar.graphics.clear();
      this.titleBar.graphics.beginFill(0x202936);
      this.titleBar.graphics.drawRect(0, 0, this.windowWidth, TITLE_HEIGHT);
      this.titleBar.graphics.endFill();
      this.titleText.x = 7;
      this.titleText.y = 3;
      this.titleText.width = Math.max(1, this.windowWidth - 38);
      this.titleText.height = 18;
      this.closeButton.x = Math.max(0, this.windowWidth - 25);
      this.closeButton.y = 3;
      this.closeButton.width = Math.min(22, this.windowWidth);
      this.closeButton.height = 18;
      this.pauseButton.x = 6;
      this.pauseButton.y = 28;
      this.pauseButton.width = 70;
      this.pauseButton.text = this.paused ? 'RESUME' : 'PAUSE';
      this.pauseButton.textColor = this.paused ? 0xffcc55 : 0xffffff;
      this.resetButton.x = 82;
      this.resetButton.y = 28;
      this.resetButton.width = 60;
      this.output.x = 6;
      this.output.y = 53;
      this.output.width = Math.max(1, this.windowWidth - 12);
      this.output.height = Math.max(1, this.windowHeight - this.output.y - 17);
      this.output.visible = this.windowHeight > 70;
      this.resizeGrip.x = Math.max(0, this.windowWidth - 15);
      this.resizeGrip.y = Math.max(0, this.windowHeight - 15);
      this.resizeGrip.graphics.clear();
      this.resizeGrip.graphics.beginFill(0xffffff, 0);
      this.resizeGrip.graphics.drawRect(0, 0, 15, 15);
      this.resizeGrip.graphics.endFill();
      this.resizeGrip.graphics.lineStyle(1, 0x8d9bb0);
      this.resizeGrip.graphics.moveTo(4, 13);
      this.resizeGrip.graphics.lineTo(13, 4);
      this.resizeGrip.graphics.moveTo(8, 13);
      this.resizeGrip.graphics.lineTo(13, 8);
      // Stages smaller than the normal minimum must not expose controls
      // outside the clamped window or steal clicks from elsewhere.
      this.scrollRect = new Rectangle(0, 0, this.windowWidth, this.windowHeight);
    }

    private onRefresh = (event: TimerEvent): void => {
      if (this._active && !this.paused && this.stage != null) this.updateOutput();
    };

    private updateOutput(): void {
      if (!this._active || this.disposed) return;
      let text: string = 'Waiting for profiler data...';
      try {
        if (this.stateProvider != null) {
          let value: unknown = this.stateProvider();
          if (value != null) text = String(value);
        }
      } catch (error) {
        text = 'Profiler provider failed: ' + String(error);
      }
      if (!this._active || this.disposed) return;
      if (text.length > MAX_TEXT_LENGTH) {
        text = text.substr(0, MAX_TEXT_LENGTH) + '\n[Display truncated]';
      }
      if (text == this.output.text) return;
      let scroll: number = this.output.scrollV;
      let horizontalScroll: number = this.output.scrollH;
      let selectionStart: number = this.output.selectionBeginIndex;
      let selectionEnd: number = this.output.selectionEndIndex;
      this.output.text = text;
      this.output.scrollV = Math.min(scroll, this.output.maxScrollV);
      this.output.scrollH = Math.min(horizontalScroll, this.output.maxScrollH);
      this.output.setSelection(
        Math.min(selectionStart, text.length),
        Math.min(selectionEnd, text.length),
      );
    }

    private onTogglePause = (event: MouseEvent): void => {
      event.stopImmediatePropagation();
      this.paused = !this.paused;
      this.redraw();
      if (!this.paused) {
        // The backend keeps collecting while this display is paused.
        // Resume with a fresh interval rather than combining a bounded
        // percentile sample with an arbitrarily long paused average.
        try {
          if (this.resetHandler != null) this.resetHandler();
        } catch (error) {
          this.output.text = 'Profiler reset failed: ' + String(error);
          return;
        }
        this.updateOutput();
      }
    };

    private onReset = (event: MouseEvent): void => {
      event.stopImmediatePropagation();
      try {
        if (this.resetHandler != null) this.resetHandler();
      } catch (error) {
        this.output.text = 'Profiler reset failed: ' + String(error);
        return;
      }
      this.updateOutput();
    };

    private onClose = (event: MouseEvent): void => {
      event.stopImmediatePropagation();
      this.hide();
    };

    private focusOutput(): void {
      if (this.stage != null) this.stage.focus = this.output;
    }

    private onButtonMouseDown = (event: MouseEvent): void => {
      this.focusOutput();
      event.stopImmediatePropagation();
    };

    private onMouseDown = (event: MouseEvent): void => {
      this.focusOutput();
      event.stopPropagation();
    };

    private consumeMouseEvent = (event: MouseEvent): void => {
      event.stopPropagation();
    };

    private consumeKeyEvent = (event: KeyboardEvent): void => {
      event.stopImmediatePropagation();
    };

    private onCapturedKey = (event: KeyboardEvent): void => {
      let target: DisplayObject = event.target as DisplayObject;
      if (!this._active || target == null || !this.contains(target)) return;
      if (event.type == KeyboardEvent.KEY_DOWN && !event.shiftKey && !event.ctrlKey) {
        let page: number = Math.max(1, this.output.bottomScrollV - this.output.scrollV);
        if (event.keyCode == Keyboard.UP) this.output.scrollV--;
        else if (event.keyCode == Keyboard.DOWN) this.output.scrollV++;
        else if (event.keyCode == Keyboard.PAGE_UP) this.output.scrollV -= page;
        else if (event.keyCode == Keyboard.PAGE_DOWN) this.output.scrollV += page;
        if (
          event.keyCode == Keyboard.UP ||
          event.keyCode == Keyboard.DOWN ||
          event.keyCode == Keyboard.PAGE_UP ||
          event.keyCode == Keyboard.PAGE_DOWN
        ) {
          event.preventDefault();
        }
      }
      event.stopImmediatePropagation();
    };

    private onMouseWheel = (event: MouseEvent): void => {
      this.output.scrollV -= event.delta * 3;
      event.preventDefault();
      event.stopImmediatePropagation();
    };

    private onDragStart = (event: MouseEvent): void => {
      if (this.stage == null || this.parent == null) return;
      this.stopPointerOperation();
      this.focusOutput();
      let point: Point = this.parent.globalToLocal(new Point(event.stageX, event.stageY));
      this.dragging = true;
      this.dragOffsetX = point.x - this.x;
      this.dragOffsetY = point.y - this.y;
      this.addPointerListeners();
      event.stopImmediatePropagation();
    };

    private onResizeStart = (event: MouseEvent): void => {
      if (this.stage == null || this.parent == null) return;
      this.stopPointerOperation();
      this.focusOutput();
      let point: Point = this.parent.globalToLocal(new Point(event.stageX, event.stageY));
      this.resizing = true;
      this.resizeStartX = point.x;
      this.resizeStartY = point.y;
      this.resizeStartWidth = this.windowWidth;
      this.resizeStartHeight = this.windowHeight;
      this.addPointerListeners();
      event.stopImmediatePropagation();
    };

    private addPointerListeners(): void {
      this.pointerStage = this.stage;
      if (!this.pointerStage) return;
      this.pointerStage.addEventListener(
        MouseEvent.MOUSE_MOVE,
        this.onStageMouseMove,
        true,
        2147483647,
      );
      this.pointerStage.addEventListener(
        MouseEvent.MOUSE_UP,
        this.onStageMouseUp,
        true,
        2147483647,
      );
      this.pointerStage.addEventListener(Event.MOUSE_LEAVE, this.onPointerCancelled);
      this.pointerStage.addEventListener(Event.DEACTIVATE, this.onPointerCancelled);
    }

    private onStageMouseMove = (event: MouseEvent): void => {
      if (this.pointerStage == null || this.parent == null || this.stage == null) return;
      let point: Point = this.parent.globalToLocal(new Point(event.stageX, event.stageY));
      let bounds: Rectangle = this.stageBoundsInParent();
      if (this.dragging) {
        this.x = Math.max(
          bounds.x,
          Math.min(point.x - this.dragOffsetX, bounds.right - this.windowWidth),
        );
        this.y = Math.max(
          bounds.y,
          Math.min(point.y - this.dragOffsetY, bounds.bottom - this.windowHeight),
        );
      } else if (this.resizing) {
        let widthLimit: number = Math.max(1, bounds.right - this.x);
        let heightLimit: number = Math.max(1, bounds.bottom - this.y);
        this.windowWidth = Math.max(
          Math.min(MIN_WIDTH, widthLimit),
          Math.min(this.resizeStartWidth + point.x - this.resizeStartX, widthLimit),
        );
        this.windowHeight = Math.max(
          Math.min(MIN_HEIGHT, heightLimit),
          Math.min(this.resizeStartHeight + point.y - this.resizeStartY, heightLimit),
        );
        this.redraw();
      }
      this.saveGeometry();
      event.stopImmediatePropagation();
      event.updateAfterEvent();
    };

    private onStageMouseUp = (event: MouseEvent): void => {
      this.stopPointerOperation();
      event.stopImmediatePropagation();
    };

    private onPointerCancelled = (event: Event): void => {
      this.stopPointerOperation();
    };

    private stopPointerOperation(): void {
      if (this.pointerStage != null) {
        this.pointerStage.removeEventListener(MouseEvent.MOUSE_MOVE, this.onStageMouseMove, true);
        this.pointerStage.removeEventListener(MouseEvent.MOUSE_UP, this.onStageMouseUp, true);
        this.pointerStage.removeEventListener(Event.MOUSE_LEAVE, this.onPointerCancelled);
        this.pointerStage.removeEventListener(Event.DEACTIVATE, this.onPointerCancelled);
        this.pointerStage = null;
      }
      this.dragging = this.resizing = false;
    }

    public dispose(): void {
      if (this.disposed) return;
      this.disposed = true;
      this.hide(false);
      this.refreshTimer.removeEventListener(TimerEvent.TIMER, this.onRefresh);
      this.removeEventListener(Event.ADDED_TO_STAGE, this.onAddedToStage);
      this.removeEventListener(Event.REMOVED_FROM_STAGE, this.onRemovedFromStage);
      this.removeEventListener(MouseEvent.MOUSE_DOWN, this.onMouseDown);
      this.removeEventListener(MouseEvent.MOUSE_MOVE, this.consumeMouseEvent);
      this.removeEventListener(MouseEvent.CLICK, this.consumeMouseEvent);
      this.removeEventListener(MouseEvent.DOUBLE_CLICK, this.consumeMouseEvent);
      this.removeEventListener(MouseEvent.RIGHT_MOUSE_DOWN, this.consumeMouseEvent);
      this.removeEventListener(MouseEvent.RIGHT_CLICK, this.consumeMouseEvent);
      this.removeEventListener(MouseEvent.MOUSE_WHEEL, this.onMouseWheel);
      this.removeEventListener(KeyboardEvent.KEY_DOWN, this.consumeKeyEvent);
      this.pauseButton.removeEventListener(MouseEvent.CLICK, this.onTogglePause);
      this.resetButton.removeEventListener(MouseEvent.CLICK, this.onReset);
      this.closeButton.removeEventListener(MouseEvent.CLICK, this.onClose);
      this.pauseButton.removeEventListener(MouseEvent.MOUSE_DOWN, this.onButtonMouseDown);
      this.resetButton.removeEventListener(MouseEvent.MOUSE_DOWN, this.onButtonMouseDown);
      this.closeButton.removeEventListener(MouseEvent.MOUSE_DOWN, this.onButtonMouseDown);
      this.titleBar.removeEventListener(MouseEvent.MOUSE_DOWN, this.onDragStart);
      this.resizeGrip.removeEventListener(MouseEvent.MOUSE_DOWN, this.onResizeStart);
      this.stateProvider = this.resetHandler = this.activeChanged = null;
      this.output.text = '';
    }
  }
  windowClasses.set(Sprite, ProfilerWindow);
  return ProfilerWindow;
}
