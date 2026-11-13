/** OpenFL API test doubles for native diagnostic panel lifecycle, not visual parity. */
export function overlayClasses(Display: any, haxeGraphics = false) {
  class Graphics {
    commands: unknown[][] = [];
    clear() {
      this.commands.length = 0;
    }
    beginFill(...args: unknown[]) {
      this.commands.push(['beginFill', ...args]);
    }
    endFill() {
      this.commands.push(['endFill']);
    }
    lineStyle(...args: unknown[]) {
      this.commands.push(['lineStyle', ...args]);
    }
    drawRect(...args: unknown[]) {
      this.commands.push(['drawRect', ...args]);
    }
    moveTo(...args: unknown[]) {
      this.commands.push(['moveTo', ...args]);
    }
    lineTo(...args: unknown[]) {
      this.commands.push(['lineTo', ...args]);
    }
    drawCircle(...args: unknown[]) {
      this.commands.push(['drawCircle', ...args]);
    }
  }
  class Sprite extends Display {
    private nativeGraphics = new Graphics();
    constructor(...args: unknown[]) {
      super(...args);
      if (!haxeGraphics) Object.defineProperty(this, 'graphics', { value: this.nativeGraphics });
    }
    get_graphics() {
      return this.nativeGraphics;
    }
    get stage() {
      return this.get_stage();
    }
    globalToLocal(point: any) {
      return { x: point.x - (this.x ?? 0), y: point.y - (this.y ?? 0) };
    }
  }
  if (haxeGraphics)
    Object.assign(Sprite.prototype, { __properties__: { get_graphics: 'get_graphics' } });
  class TextField extends Sprite {
    text = '';
    scrollV = 1;
    maxScrollV = 1;
    numLines = 1;
    bottomScrollV = 1;
    setSelection(_begin: number, _end: number) {}
  }
  class Timer extends Display {
    running = false;
    constructor(public delay: number) {
      super();
    }
    start() {
      this.running = true;
    }
    stop() {
      this.running = false;
    }
  }
  class Rectangle {
    constructor(
      public x = 0,
      public y = 0,
      public width = 0,
      public height = 0,
    ) {}
  }
  const events = (names: string[]) =>
    Object.fromEntries(
      names.map((name) => [name.replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase(), name]),
    );
  return {
    'openfl.display.Sprite': Sprite,
    'openfl.display.Shape': Sprite,
    'openfl.display.Stage': Sprite,
    'openfl.text.TextField': TextField,
    'openfl.text.TextFormat': class {
      constructor(
        public font: string,
        public size: number,
        public color: number,
        public bold: boolean,
      ) {}
    },
    'openfl.geom.Rectangle': Rectangle,
    'openfl.utils.Timer': Timer,
    'openfl.events.Event': events([
      'enterFrame',
      'addedToStage',
      'removedFromStage',
      'mouseLeave',
      'deactivate',
      'resize',
    ]),
    'openfl.events.MouseEvent': events([
      'mouseDown',
      'mouseUp',
      'mouseMove',
      'click',
      'doubleClick',
      'rightMouseDown',
      'rightClick',
      'mouseWheel',
    ]),
    'openfl.events.KeyboardEvent': events(['keyDown', 'keyUp']),
    'openfl.events.TimerEvent': { TIMER: 'timer' },
    'openfl.ui.Keyboard': { UP: 38, DOWN: 40, PAGE_UP: 33, PAGE_DOWN: 34 },
  };
}
