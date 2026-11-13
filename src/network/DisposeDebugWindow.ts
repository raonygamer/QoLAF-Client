import type { Raw } from '../api/Types';
import type { Resolve } from '../runtime/HaxeInterop';

const windowClasses = new WeakMap<object, ReturnType<typeof createDisposeDebugWindow>>();

/** Original native-display disposal diagnostics panel. */
export function createDisposeDebugWindow(resolve: Resolve): any {
  const Sprite = resolve('openfl.display.Sprite');
  const Shape = resolve('openfl.display.Shape');
  const TextField = resolve('openfl.text.TextField');
  const TextFormat = resolve('openfl.text.TextFormat');
  const Event = resolve('openfl.events.Event');
  const MouseEvent = resolve('openfl.events.MouseEvent');
  const Stage = resolve('openfl.display.Stage');
  const cached = windowClasses.get(Sprite);
  if (cached) return cached;
  type DisplayObjectContainer = Raw;
  type Sprite = Raw;
  type Shape = Raw;
  type TextField = Raw;
  type TextFormat = Raw;
  type Event = Raw;
  type MouseEvent = Raw;
  type Stage = Raw;
  const WIDTH: number = 700;
  const HEIGHT: number = 405;
  const TITLE_HEIGHT: number = 24;
  const UPDATE_INTERVAL_MS: number = 250;
  let shouldRestore: boolean = false;
  let savedX: number = 20;
  let savedY: number = 52;
  class DisposeDebugWindow extends Sprite {
    private frame: Shape = new Shape();
    private titleBar: Sprite = new Sprite();
    private titleText!: TextField;
    private resetButton!: TextField;
    private closeButton!: TextField;
    private output!: TextField;
    private peaks: Raw = {};
    private lastUpdateAt: number = 0;
    private pointerStage: Stage | null = null;
    private dragOffsetX: number = 0;
    private dragOffsetY: number = 0;
    private _active: boolean = false;
    private _stateProvider: (() => Raw | null) | null = null;

    constructor() {
      super();
      this.mouseEnabled = true;
      this.mouseChildren = true;
      this.addChild(this.frame);
      this.buildTitleBar();
      this.buildOutput();
      this.redraw();
      this.addEventListener(Event.ENTER_FRAME, this.onEnterFrame);
      this.addEventListener(MouseEvent.MOUSE_DOWN, this.consumeMouseEvent);
      this.addEventListener(MouseEvent.MOUSE_UP, this.consumeMouseEvent);
      this.addEventListener(MouseEvent.CLICK, this.consumeMouseEvent);
    }

    public get stateProvider(): (() => Raw | null) | null {
      return this._stateProvider;
    }

    public set stateProvider(param1: (() => Raw | null) | null) {
      this._stateProvider = param1;
    }

    public toggle(param1: DisplayObjectContainer): boolean {
      if (this._active) {
        this.hide();
      } else {
        this.show(param1);
      }
      return this._active;
    }

    public show(param1: DisplayObjectContainer): void {
      if (param1 == null) {
        return;
      }
      if (this.parent != param1) {
        if (this.parent != null) {
          this.parent.removeChild(this);
        }
        param1.addChild(this);
      }
      this._active = true;
      shouldRestore = true;
      this.x = savedX;
      this.y = savedY;
      this.constrainToStage();
      this.updateOutput();
    }

    public restore(param1: DisplayObjectContainer): boolean {
      if (!shouldRestore || param1 == null) {
        return false;
      }
      this.show(param1);
      return true;
    }

    public hide(param1: boolean = true): void {
      this.stopDragging();
      savedX = this.x;
      savedY = this.y;
      if (param1) {
        shouldRestore = false;
      }
      this._active = false;
      if (this.parent != null) {
        this.parent.removeChild(this);
      }
    }

    public constrainToStage(): void {
      if (this.stage == null) {
        return;
      }
      this.x = Math.max(0, Math.min(this.x, Math.max(0, this.stage.stageWidth - WIDTH)));
      this.y = Math.max(0, Math.min(this.y, Math.max(0, this.stage.stageHeight - HEIGHT)));
      savedX = this.x;
      savedY = this.y;
    }

    private buildTitleBar(): void {
      this.titleBar.buttonMode = true;
      this.titleBar.useHandCursor = false;
      this.titleBar.addEventListener(MouseEvent.MOUSE_DOWN, this.onDragStart);
      this.addChild(this.titleBar);

      this.titleText = this.createTextField(12, 0xffffff, true);
      this.titleText.text = 'DISPOSE / RESOURCE DEBUG';
      this.titleText.mouseEnabled = false;
      this.titleText.x = 7;
      this.titleText.y = 3;
      this.titleText.width = WIDTH - 160;
      this.titleText.height = 18;
      this.titleBar.addChild(this.titleText);

      this.resetButton = this.createButton('RESET PEAKS', this.onResetPeaks);
      this.resetButton.x = WIDTH - 130;
      this.resetButton.y = 3;
      this.resetButton.width = 100;
      this.titleBar.addChild(this.resetButton);

      this.closeButton = this.createButton('X', this.onClose);
      this.closeButton.x = WIDTH - 26;
      this.closeButton.y = 3;
      this.closeButton.width = 22;
      this.titleBar.addChild(this.closeButton);
    }

    private buildOutput(): void {
      this.output = this.createTextField(11, 0xdce4f2, false);
      this.output.x = 6;
      this.output.y = TITLE_HEIGHT + 5;
      this.output.width = WIDTH - 12;
      this.output.height = HEIGHT - this.output.y - 6;
      this.output.background = true;
      this.output.backgroundColor = 0x05070a;
      this.output.border = true;
      this.output.borderColor = 0x596273;
      this.output.multiline = true;
      this.output.wordWrap = false;
      this.output.selectable = true;
      this.output.mouseWheelEnabled = true;
      this.addChild(this.output);
    }

    private createButton(param1: string, param2: (event: Raw) => void): TextField {
      let local1: TextField = this.createTextField(10, 0xffffff, true);
      local1.text = param1;
      local1.background = true;
      local1.backgroundColor = 0x263142;
      local1.border = true;
      local1.borderColor = 0x63738a;
      local1.selectable = false;
      local1.height = 18;
      local1.addEventListener(MouseEvent.CLICK, param2);
      local1.addEventListener(MouseEvent.MOUSE_DOWN, this.consumeButtonMouseDown);
      return local1;
    }

    private createTextField(param1: number, param2: number, param3: boolean): TextField {
      let local1: TextField = new TextField();
      local1.defaultTextFormat = new TextFormat('_typewriter', param1, param2, param3);
      local1.embedFonts = false;
      local1.textColor = param2;
      return local1;
    }

    private redraw(): void {
      this.frame.graphics.clear();
      this.frame.graphics.beginFill(0x090b10, 0.96);
      this.frame.graphics.lineStyle(1, 0x738096, 1);
      this.frame.graphics.drawRect(0, 0, WIDTH, HEIGHT);
      this.frame.graphics.endFill();

      this.titleBar.graphics.clear();
      this.titleBar.graphics.beginFill(0x202936, 1);
      this.titleBar.graphics.drawRect(0, 0, WIDTH, TITLE_HEIGHT);
      this.titleBar.graphics.endFill();
    }

    private onEnterFrame = (param1: Event): void => {
      if (!this._active || Math.floor(performance.now()) - this.lastUpdateAt < UPDATE_INTERVAL_MS) {
        return;
      }
      this.updateOutput();
    };

    private updateOutput(): void {
      this.lastUpdateAt = Math.floor(performance.now());
      if (this._stateProvider == null) {
        this.output.text = 'Waiting for the game-state diagnostics provider...';
        return;
      }
      let state: Raw | null;
      try {
        state = this._stateProvider();
      } catch (error) {
        this.output.text = 'Diagnostics provider failed: ' + String(error);
        return;
      }
      if (state == null) {
        this.output.text = 'Waiting for game managers to initialize...';
        return;
      }

      let textStats: Raw = this.objectValue(state, 'text');
      let emitterStats: Raw = this.objectValue(state, 'emitters');
      let batchStats: Raw = this.objectValue(state, 'batches');
      let projectileStats: Raw = this.objectValue(state, 'projectiles');
      let filterStats: Raw = this.objectValue(state, 'filters');
      let memoryMb: number =
        Number((performance as unknown as Raw).memory?.usedJSHeapSize) / 1048576;
      let lines: string[] = [];
      lines.push('METRIC                              CURRENT       PEAK     CUMULATIVE');
      lines.push('--------------------------------------------------------------------');
      lines.push(
        this.row(
          'TextParticle active',
          this.numberValue(textStats, 'active'),
          this.numberValue(textStats, 'spawns'),
          'textActive',
        ),
      );
      lines.push(
        this.row(
          'TextParticle inactive pool',
          this.numberValue(textStats, 'inactive'),
          this.numberValue(textStats, 'created'),
          'textInactive',
        ),
      );
      lines.push(
        this.row(
          'Emitter active',
          this.numberValue(emitterStats, 'active'),
          this.numberValue(emitterStats, 'checkouts'),
          'emitterActive',
        ),
      );
      lines.push(
        this.row(
          'Emitter inactive pool',
          this.numberValue(emitterStats, 'inactive'),
          this.numberValue(emitterStats, 'created'),
          'emitterInactive',
        ),
      );
      lines.push(
        this.row(
          'Particle active',
          this.numberValue(emitterStats, 'activeParticles'),
          this.numberValue(emitterStats, 'particleActivations'),
          'particleActive',
        ),
      );
      lines.push(
        this.row(
          'Particle inactive pool',
          this.numberValue(emitterStats, 'pooledParticles'),
          this.numberValue(emitterStats, 'particlesCreated'),
          'particleInactive',
        ),
      );
      lines.push(
        this.row(
          'Collective shared batches',
          this.numberValue(batchStats, 'shared'),
          this.numberValue(batchStats, 'sharedCreated'),
          'sharedBatches',
        ),
      );
      lines.push(
        this.row(
          'Collective custom batches',
          this.numberValue(batchStats, 'custom'),
          this.numberValue(batchStats, 'customCreated'),
          'customBatches',
        ),
      );
      lines.push(
        this.row(
          'Collective shared vertices',
          this.numberValue(batchStats, 'sharedVertices'),
          NaN,
          'sharedVertices',
        ),
      );
      lines.push(
        this.row(
          'Collective custom vertices',
          this.numberValue(batchStats, 'customVertices'),
          NaN,
          'customVertices',
        ),
      );
      lines.push(
        this.row(
          'Projectile active',
          this.numberValue(projectileStats, 'active'),
          this.numberValue(projectileStats, 'checkouts'),
          'projectileActive',
        ),
      );
      lines.push(
        this.row(
          'Projectile inactive pool',
          this.numberValue(projectileStats, 'inactive'),
          this.numberValue(projectileStats, 'created'),
          'projectileInactive',
        ),
      );
      lines.push(
        this.row(
          'Projectile batch vertices',
          this.numberValue(projectileStats, 'vertices') +
            this.numberValue(projectileStats, 'grayscaleVertices'),
          NaN,
          'projectileVertices',
        ),
      );
      lines.push(
        this.row(
          'Units currently flashing',
          this.numberValue(filterStats, 'flashing'),
          this.numberValue(filterStats, 'activations'),
          'flashing',
        ),
      );
      lines.push(
        this.row(
          'Allocated damage flash filters',
          this.numberValue(filterStats, 'allocated'),
          this.numberValue(filterStats, 'created'),
          'flashFilters',
        ),
      );
      lines.push(this.row('JS heap memory (MiB)', memoryMb, NaN, 'memoryMb', 1));
      lines.push('');
      lines.push(
        'Combat text requests/spawns: ' +
          this.formatCount(this.numberValue(textStats, 'requests')) +
          ' / ' +
          this.formatCount(this.numberValue(textStats, 'spawns')),
      );
      lines.push(
        'Shared vertices fx / gray / aura: ' +
          this.formatCount(this.numberValue(batchStats, 'effectsVertices')) +
          ' / ' +
          this.formatCount(this.numberValue(batchStats, 'grayscaleVertices')) +
          ' / ' +
          this.formatCount(this.numberValue(batchStats, 'rarityVertices')),
      );
      lines.push(
        'Batch emitter refs shared / custom: ' +
          this.formatCount(this.numberValue(batchStats, 'sharedEmitters')) +
          ' / ' +
          this.formatCount(this.numberValue(batchStats, 'customEmitters')) +
          '    empty custom: ' +
          this.formatCount(this.numberValue(batchStats, 'customEmpty')),
      );
      lines.push(
        'Collective assignments (lifetime): ' +
          this.formatCount(this.numberValue(batchStats, 'assignments')),
      );
      lines.push('');
      lines.push('CUMULATIVE counts observed since scene attachment; - means unavailable.');
      lines.push('Peaks are sampled every 250 ms. GC is not explicit dispose; GPU driver');
      lines.push('resource counts are unavailable, so manager/vertex-buffer proxies are shown.');
      this.output.text = lines.join('\n');
    }

    private row(
      param1: string,
      param2: number,
      param3: number,
      param4: string,
      param5: number = 0,
    ): string {
      let local1: number = this.recordPeak(param4, param2);
      return (
        this.padRight(param1, 34) +
        this.padLeft(this.formatCount(param2, param5), 11) +
        this.padLeft(this.formatCount(local1, param5), 11) +
        this.padLeft(isNaN(param3) ? '-' : this.formatCount(param3), 15)
      );
    }

    private recordPeak(param1: string, param2: number): number {
      if (!Number.isFinite(param2)) return NaN;
      if (!Number.isFinite(this.peaks[param1]) || param2 > Number(this.peaks[param1])) {
        this.peaks[param1] = param2;
      }
      return Number(this.peaks[param1]);
    }

    private objectValue(param1: Raw, param2: string): Raw {
      return param1 != null && param1.hasOwnProperty(param2) && param1[param2] != null
        ? param1[param2]
        : {};
    }

    private numberValue(param1: Raw, param2: string): number {
      if (param1 == null || !param1.hasOwnProperty(param2)) {
        return NaN;
      }
      let local1: number = Number(param1[param2]);
      return Number.isFinite(local1) ? local1 : NaN;
    }

    private formatCount(param1: number, param2: number = 0): string {
      if (isNaN(param1)) {
        return '-';
      }
      return param1.toFixed(param2);
    }

    private padRight(param1: string, param2: number): string {
      while (param1.length < param2) {
        param1 += ' ';
      }
      return param1.substr(0, param2);
    }

    private padLeft(param1: string, param2: number): string {
      while (param1.length < param2) {
        param1 = ' ' + param1;
      }
      return param1;
    }

    private onResetPeaks = (param1: MouseEvent): void => {
      this.peaks = {};
      this.updateOutput();
      param1.stopImmediatePropagation();
    };

    private onClose = (param1: MouseEvent): void => {
      this.hide();
      param1.stopImmediatePropagation();
    };

    private onDragStart = (param1: MouseEvent): void => {
      if (this.stage == null) {
        return;
      }
      this.stopDragging();
      this.pointerStage = this.stage;
      if (!this.pointerStage) return;
      this.dragOffsetX = param1.stageX - this.x;
      this.dragOffsetY = param1.stageY - this.y;
      this.pointerStage.addEventListener(
        MouseEvent.MOUSE_MOVE,
        this.onStageMouseMove,
        true,
        2147483647,
        true,
      );
      this.pointerStage.addEventListener(
        MouseEvent.MOUSE_UP,
        this.onStageMouseUp,
        true,
        2147483647,
        true,
      );
      this.pointerStage.addEventListener(
        Event.MOUSE_LEAVE,
        this.onPointerCancelled,
        false,
        0,
        true,
      );
      this.pointerStage.addEventListener(Event.DEACTIVATE, this.onPointerCancelled, false, 0, true);
      param1.stopImmediatePropagation();
    };

    private onStageMouseMove = (param1: MouseEvent): void => {
      if (this.pointerStage == null) {
        return;
      }
      this.x = Math.max(
        0,
        Math.min(
          param1.stageX - this.dragOffsetX,
          Math.max(0, this.pointerStage.stageWidth - WIDTH),
        ),
      );
      this.y = Math.max(
        0,
        Math.min(
          param1.stageY - this.dragOffsetY,
          Math.max(0, this.pointerStage.stageHeight - HEIGHT),
        ),
      );
      savedX = this.x;
      savedY = this.y;
      param1.updateAfterEvent();
    };

    private onStageMouseUp = (param1: MouseEvent): void => {
      this.stopDragging();
    };

    private onPointerCancelled = (param1: Event): void => {
      this.stopDragging();
    };

    private stopDragging(): void {
      if (this.pointerStage != null) {
        this.pointerStage.removeEventListener(MouseEvent.MOUSE_MOVE, this.onStageMouseMove, true);
        this.pointerStage.removeEventListener(MouseEvent.MOUSE_UP, this.onStageMouseUp, true);
        this.pointerStage.removeEventListener(Event.MOUSE_LEAVE, this.onPointerCancelled);
        this.pointerStage.removeEventListener(Event.DEACTIVATE, this.onPointerCancelled);
        this.pointerStage = null;
      }
    }

    private consumeButtonMouseDown = (param1: MouseEvent): void => {
      param1.stopImmediatePropagation();
    };

    private consumeMouseEvent = (param1: MouseEvent): void => {
      param1.stopPropagation();
    };

    public dispose(): void {
      this.hide(false);
      this.removeEventListener(Event.ENTER_FRAME, this.onEnterFrame);
      this.resetButton.removeEventListener(MouseEvent.CLICK, this.onResetPeaks);
      this.closeButton.removeEventListener(MouseEvent.CLICK, this.onClose);
      this.titleBar.removeEventListener(MouseEvent.MOUSE_DOWN, this.onDragStart);
      this._stateProvider = null;
      this.peaks = {};
    }
  }
  windowClasses.set(Sprite, DisposeDebugWindow);
  return DisposeDebugWindow;
}
