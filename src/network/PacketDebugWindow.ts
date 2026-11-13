import type { Raw } from '../api/Types';
import type { Resolve } from '../runtime/HaxeInterop';
import { HeadingDiagnostics } from './HeadingDiagnostics';
import { HeadingGraphics } from './HeadingGraphics';
import { PacketCapture } from './PacketCapture';
import { CommandAcknowledgements } from './CommandAcknowledgements';

/** PacketDebugWindow.as native controls and layout, backed by the source decoder. */
export function createPacketDebugWindow(resolve: Resolve): any {
  resolve('openfl.display.Stage');
  const Sprite = resolve('openfl.display.Sprite');
  const Shape = resolve('openfl.display.Shape');
  const TextField = resolve('openfl.text.TextField');
  const TextFormat = resolve('openfl.text.TextFormat');
  const Rectangle = resolve('openfl.geom.Rectangle');
  const Point = resolve('openfl.geom.Point');
  const MouseEvent = resolve('openfl.events.MouseEvent');
  const KeyboardEvent = resolve('openfl.events.KeyboardEvent');
  const Event = resolve('openfl.events.Event');

  return class PacketDebugWindow extends Sprite {
    capture: PacketCapture;
    heading: HeadingDiagnostics;
    headingChanged: ((enabled: boolean) => void) | null = null;
    private headingPanel = new Sprite();
    private headingShape = new Shape();
    private headingPainter = new HeadingGraphics(this.headingShape.graphics);
    private headingLegend: Raw;
    private headingStatus: Raw;
    acknowledgements: CommandAcknowledgements;
    private frame = new Shape();
    private titleBar = new Sprite();
    private title: Raw;
    private closeButton: Raw;
    private rxButton: Raw;
    private txButton: Raw;
    private pauseButton: Raw;
    private clearButton: Raw;
    private filterLabel: Raw;
    private filterInput: Raw;
    private output: Raw;
    private grip = new Sprite();
    private windowWidth = 560;
    private windowHeight = 270;
    private pointerStage: Raw | null = null;
    private listenerStage: Raw | null = null;
    private pointer: {
      x: number;
      y: number;
      width: number;
      height: number;
      resize: boolean;
    } | null = null;
    private lastDrawAt = 0;
    private disposed = false;

    constructor(now: () => number, isBytes: (value: unknown) => boolean) {
      super();
      this.capture = new PacketCapture(now, isBytes);
      this.acknowledgements = new CommandAcknowledgements(now);
      this.heading = new HeadingDiagnostics(this.capture, this.acknowledgements, now);
      this.headingPanel.mouseEnabled = this.headingPanel.mouseChildren = false;
      this.headingPanel.addChild(this.headingShape);
      this.headingLegend = this.field(10, 0xdce4f2, true);
      this.headingLegend.multiline = this.headingLegend.wordWrap = true;
      this.headingLegend.htmlText =
        "<font face='Verdana' color='#FFFFFF'>REAL ship: local client</font><br>" +
        "<font face='Verdana' color='#E05CFF'>GHOST ship: replayed server</font><br>" +
        "<font face='Verdana' color='#4EDCFF'>local velocity</font>  <font face='Verdana' color='#FFD45C'>replayed velocity</font>  <font face='Verdana' color='#E05CFF'>position correction</font><br>" +
        "<font face='Verdana' color='#74FF92'>ship heading</font>  <font face='Verdana' color='#FF8A65'>angular correction</font>  <font face='Verdana' color='#72A7FF'>turn input</font>";
      this.headingStatus = this.field(10, 0xdce4f2);
      this.headingStatus.multiline = this.headingStatus.wordWrap = true;
      this.headingPanel.addChild(this.headingLegend);
      this.headingPanel.addChild(this.headingStatus);
      this.mouseEnabled = this.mouseChildren = true;
      this.addChild(this.frame);
      this.addChild(this.headingPanel);
      this.addChild(this.titleBar);
      this.titleBar.buttonMode = true;
      this.titleBar.addEventListener(MouseEvent.MOUSE_DOWN, this.startDragWindow);
      this.title = this.field(12, 0xffffff, true);
      this.title.text = 'PACKET DEBUG';
      this.title.mouseEnabled = false;
      this.titleBar.addChild(this.title);
      this.closeButton = this.button('X', () => this.hide());
      this.titleBar.addChild(this.closeButton);
      this.rxButton = this.button('RX ON', () => {
        this.capture.showRX = !this.capture.showRX;
      });
      this.txButton = this.button('TX ON', () => {
        this.capture.showTX = !this.capture.showTX;
      });
      this.pauseButton = this.button('PAUSE', () => {
        this.capture.paused = !this.capture.paused;
      });
      this.clearButton = this.button('CLEAR', () => {
        this.capture.clear();
        this.acknowledgements.reset();
        this.heading.resetTimes();
      });
      this.filterLabel = this.field(10, 0xbfc7d5);
      this.filterLabel.text = 'FILTER (type/text; ! excludes)';
      this.filterLabel.mouseEnabled = false;
      this.addChild(this.filterLabel);
      this.filterInput = this.field(11, 0xffffff);
      // OpenFL TextFieldType.INPUT is the integer enum value 1.
      this.filterInput.type = 1;
      this.filterInput.background = this.filterInput.border = true;
      this.filterInput.backgroundColor = 0x10131a;
      this.filterInput.borderColor = 0x596273;
      this.filterInput.text = this.capture.filter;
      this.filterInput.addEventListener(Event.CHANGE, this.filterChanged);
      this.filterInput.addEventListener(MouseEvent.MOUSE_DOWN, this.focusFilter);
      this.addChild(this.filterInput);
      this.output = this.field(10, 0xdce4f2);
      this.output.background = this.output.border = true;
      this.output.backgroundColor = 0x05070a;
      this.output.borderColor = 0x596273;
      this.output.multiline = true;
      this.output.wordWrap = false;
      this.output.selectable = this.output.mouseWheelEnabled = true;
      this.addChild(this.output);
      this.grip.buttonMode = true;
      this.grip.addEventListener(MouseEvent.MOUSE_DOWN, this.startResize);
      this.addChild(this.grip);
      for (const type of [
        MouseEvent.MOUSE_DOWN,
        MouseEvent.MOUSE_UP,
        MouseEvent.CLICK,
        MouseEvent.MOUSE_WHEEL,
      ])
        this.addEventListener(type, this.consumeMouse);
      this.addEventListener(Event.ENTER_FRAME, this.enterFrame);
      this.addEventListener(Event.REMOVED_FROM_STAGE, this.removed);
      this.redraw();
    }

    get active(): boolean {
      return this.capture.active;
    }
    toggle(container: Raw): boolean {
      if (this.active) this.hide();
      else this.show(container);
      return this.active;
    }
    show(container: Raw): void {
      if (!container || this.disposed) return;
      if (this.parent !== container) container.addChild(this);
      this.capture.show();
      this.detachStage();
      this.listenerStage = this.stage;
      if (this.listenerStage) {
        for (const type of [KeyboardEvent.KEY_DOWN, KeyboardEvent.KEY_UP])
          this.listenerStage.addEventListener(type, this.captureKey, true, 2147483647);
        this.listenerStage.addEventListener(Event.RESIZE, this.resizeStage);
      }
      this.constrainToStage();
    }
    toggleHeading(container: Raw): boolean {
      this.heading.enabled = !this.heading.enabled;
      if (this.heading.enabled) {
        this.windowWidth = Math.max(820, this.windowWidth);
        this.windowHeight = Math.max(500, this.windowHeight);
        this.filterInput.text = this.capture.filter = 'heading';
        this.show(container);
      }
      this.capture.dirty = true;
      this.redraw();
      this.headingChanged?.(this.heading.enabled);
      return this.heading.enabled;
    }
    hide(clearRestore = true): void {
      this.heading.enabled = false;
      this.headingPanel.visible = false;
      if (clearRestore) this.headingChanged?.(false);
      this.capture.active = false;
      this.stopPointer();
      this.detachStage();
      if (this.parent) this.parent.removeChild(this);
    }
    private detachStage(): void {
      if (!this.listenerStage) return;
      if (this.listenerStage.focus && this.contains(this.listenerStage.focus))
        this.listenerStage.focus = null;
      for (const type of [KeyboardEvent.KEY_DOWN, KeyboardEvent.KEY_UP])
        this.listenerStage.removeEventListener(type, this.captureKey, true);
      this.listenerStage.removeEventListener(Event.RESIZE, this.resizeStage);
      this.listenerStage = null;
    }
    private removed = (): void => {
      this.capture.active = false;
      this.stopPointer();
      this.detachStage();
    };
    private captureKey = (event: Raw): void => {
      if (this.active && event.target && this.contains(event.target))
        event.stopImmediatePropagation();
    };
    private consumeMouse = (event: Raw): void => {
      event.stopPropagation();
    };
    private focusFilter = (event: Raw): void => {
      if (this.stage) this.stage.focus = this.filterInput;
      event.stopImmediatePropagation();
    };
    private filterChanged = (): void => {
      this.capture.filter = this.filterInput.text;
      this.capture.dirty = true;
    };
    private field(size: number, color: number, bold = false): Raw {
      const field = new TextField();
      field.defaultTextFormat = new TextFormat('Verdana', size, color, bold);
      field.embedFonts = false;
      field.textColor = color;
      return field;
    }
    private button(label: string, action: () => void): Raw {
      const field = this.field(10, 0xffffff, true);
      field.text = label;
      field.background = field.border = true;
      field.backgroundColor = 0x263142;
      field.borderColor = 0x63738a;
      field.selectable = false;
      field.height = 20;
      field.addEventListener(MouseEvent.MOUSE_DOWN, (event: Raw) =>
        event.stopImmediatePropagation(),
      );
      field.addEventListener(MouseEvent.CLICK, (event: Raw) => {
        event.stopImmediatePropagation();
        action();
        this.capture.dirty = true;
        this.redraw();
      });
      this.addChild(field);
      return field;
    }
    private bounds(): Raw {
      const first = this.parent.globalToLocal(new Point(0, 0));
      const last = this.parent.globalToLocal(
        new Point(this.stage.stageWidth, this.stage.stageHeight),
      );
      return new Rectangle(
        Math.min(first.x, last.x),
        Math.min(first.y, last.y),
        Math.abs(last.x - first.x),
        Math.abs(last.y - first.y),
      );
    }
    constrainToStage(): void {
      if (!this.stage || !this.parent) return;
      const bounds = this.bounds();
      this.windowWidth = Math.min(this.windowWidth, bounds.width);
      this.windowHeight = Math.min(this.windowHeight, bounds.height);
      this.x = Math.max(bounds.x, Math.min(this.x, bounds.right - this.windowWidth));
      this.y = Math.max(bounds.y, Math.min(this.y, bounds.bottom - this.windowHeight));
      this.redraw();
    }
    private resizeStage = (): void => {
      this.stopPointer();
      this.constrainToStage();
    };
    private redraw(): void {
      const width = this.windowWidth,
        height = this.windowHeight;
      this.frame.graphics.clear();
      this.frame.graphics.beginFill(0x090b10, 0.94);
      this.frame.graphics.lineStyle(1, 0x738096, 1);
      this.frame.graphics.drawRect(0, 0, width, height);
      this.frame.graphics.endFill();
      this.title.text = this.heading.enabled ? 'PACKET + HEADING DEBUG' : 'PACKET DEBUG';
      this.titleBar.graphics.clear();
      this.titleBar.graphics.beginFill(0x202936, 1);
      this.titleBar.graphics.drawRect(0, 0, width, 24);
      this.titleBar.graphics.endFill();
      Object.assign(this.title, { x: 7, y: 3, width: width - 38, height: 18 });
      Object.assign(this.closeButton, { x: width - 25, y: 3, width: 22, height: 18 });
      for (const [field, x, buttonWidth] of [
        [this.rxButton, 6, 54],
        [this.txButton, 64, 54],
        [this.pauseButton, 122, 64],
        [this.clearButton, 190, 60],
      ] as [Raw, number, number][])
        Object.assign(field, { x, y: 28, width: buttonWidth });
      this.toggleStyle(this.rxButton, this.capture.showRX, 'RX ON', 'RX OFF', 0x55dd99);
      this.toggleStyle(this.txButton, this.capture.showTX, 'TX ON', 'TX OFF', 0x55aaff);
      this.toggleStyle(this.pauseButton, this.capture.paused, 'PAUSED', 'PAUSE', 0xffcc55);
      Object.assign(this.filterLabel, {
        x: 258,
        y: 30,
        width: Math.max(125, width - 264),
        height: 17,
      });
      Object.assign(this.filterInput, { x: 6, y: 52, width: Math.max(1, width - 12), height: 21 });
      this.headingPanel.visible = this.heading.enabled;
      this.headingPanel.x = 6;
      this.headingPanel.y = 78;
      const headingBackground = this.headingPanel.graphics;
      headingBackground.clear();
      headingBackground.beginFill(0x05070a, 1);
      headingBackground.lineStyle(1, 0x596273, 1);
      headingBackground.drawRect(0, 0, width - 12, 230);
      headingBackground.endFill();
      const legendX = Math.max(195, Math.min(440, (width - 12) * 0.55));
      Object.assign(this.headingLegend, {
        x: legendX,
        y: 7,
        width: Math.max(120, width - legendX - 24),
        height: 52,
      });
      Object.assign(this.headingStatus, {
        x: legendX,
        y: 55,
        width: Math.max(120, width - legendX - 24),
        height: 170,
      });
      const outputY = this.heading.enabled ? 313 : 78;
      Object.assign(this.output, {
        x: 6,
        y: outputY,
        width: Math.max(1, width - 12),
        height: Math.max(1, height - outputY - 6),
      });
      this.grip.x = width - 15;
      this.grip.y = height - 15;
      const graphics = this.grip.graphics;
      graphics.clear();
      graphics.beginFill(0xffffff, 0);
      graphics.drawRect(0, 0, 15, 15);
      graphics.endFill();
      graphics.lineStyle(1, 0x8d9bb0, 1);
      graphics.moveTo(4, 13);
      graphics.lineTo(13, 4);
      graphics.moveTo(8, 13);
      graphics.lineTo(13, 8);
      this.scrollRect = new Rectangle(0, 0, width, height);
    }
    private toggleStyle(
      field: Raw,
      enabled: boolean,
      on: string,
      off: string,
      color: number,
    ): void {
      field.text = enabled ? on : off;
      field.textColor = enabled ? color : 0x9aa3b2;
      field.backgroundColor = enabled ? 0x263142 : 0x171b22;
    }
    private enterFrame = (): void => {
      if (this.active && this.heading.enabled) {
        const live = this.heading.live();
        this.headingShape.graphics.clear();
        if (this.heading.raw && live)
          this.headingPainter.draw(this.windowWidth, live.course, live.target);
        this.headingStatus.text = this.heading.status(live);
      }
      const now = performance.now();
      if (!this.active || !this.capture.dirty || now - this.lastDrawAt < 100) return;
      this.output.text = this.capture.format();
      this.output.scrollV = this.output.maxScrollV;
      this.capture.dirty = false;
      this.lastDrawAt = now;
    };
    private startDragWindow = (event: Raw): void => {
      this.startPointer(event, false);
    };
    private startResize = (event: Raw): void => {
      this.startPointer(event, true);
    };
    private startPointer(event: Raw, resize: boolean): void {
      if (!this.stage || !this.parent) return;
      this.stopPointer();
      const point = this.parent.globalToLocal(new Point(event.stageX, event.stageY));
      this.pointer = {
        x: resize ? point.x : point.x - this.x,
        y: resize ? point.y : point.y - this.y,
        width: this.windowWidth,
        height: this.windowHeight,
        resize,
      };
      this.pointerStage = this.stage;
      this.pointerStage!.addEventListener(
        MouseEvent.MOUSE_MOVE,
        this.movePointer,
        true,
        2147483647,
      );
      this.pointerStage!.addEventListener(MouseEvent.MOUSE_UP, this.stopPointer, true, 2147483647);
      this.pointerStage!.addEventListener(Event.MOUSE_LEAVE, this.stopPointer);
      this.pointerStage!.addEventListener(Event.DEACTIVATE, this.stopPointer);
      event.stopImmediatePropagation();
    }
    private movePointer = (event: Raw): void => {
      if (!this.pointer || !this.parent || !this.stage) return;
      const point = this.parent.globalToLocal(new Point(event.stageX, event.stageY));
      if (this.pointer.resize) {
        const bounds = this.bounds();
        this.windowWidth = Math.max(
          Math.min(390, bounds.width),
          Math.min(this.pointer.width + point.x - this.pointer.x, bounds.right - this.x),
        );
        this.windowHeight = Math.max(
          Math.min(this.heading.enabled ? 430 : 190, bounds.height),
          Math.min(this.pointer.height + point.y - this.pointer.y, bounds.bottom - this.y),
        );
      } else {
        this.x = point.x - this.pointer.x;
        this.y = point.y - this.pointer.y;
      }
      this.constrainToStage();
    };
    private stopPointer = (): void => {
      if (this.pointerStage) {
        this.pointerStage.removeEventListener(MouseEvent.MOUSE_MOVE, this.movePointer, true);
        this.pointerStage.removeEventListener(MouseEvent.MOUSE_UP, this.stopPointer, true);
        this.pointerStage.removeEventListener(Event.MOUSE_LEAVE, this.stopPointer);
        this.pointerStage.removeEventListener(Event.DEACTIVATE, this.stopPointer);
      }
      this.pointerStage = null;
      this.pointer = null;
    };
    dispose(): void {
      if (this.disposed) return;
      this.disposed = true;
      this.hide(false);
      this.heading.stateProvider = this.heading.inputProvider = null;
      this.removeEventListener(Event.ENTER_FRAME, this.enterFrame);
      this.capture.clear();
      this.acknowledgements.reset();
    }
  };
}
