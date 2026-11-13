import { overlayClasses } from './NativeOverlay';
// Display-list test double. Event invocation is extracted from the real Haxe
// runtime; this is NOT a browser/WebGL renderer or a visual parity test.
// @ts-expect-error upstream JavaScript fixture
import invoke from './StarlingInvoke.js';
const vector = (values: any[] = []) => ({
  get_length: () => values.length,
  get: (i: number) => values[i],
  set: (i: number, v: any) => {
    values[i] = v;
  },
  pop: () => values.pop(),
});
export class Display {
  static __super__: any;
  __eventListeners = { h: {} as Record<string, any> };
  __eventStack = vector();
  values: Record<string, any> = {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    scaleX: 1,
    scaleY: 1,
    visible: true,
    alpha: 1,
    touchable: true,
  };
  children: Display[] = [];
  parent: Display | null = null;
  disposed = false;
  name = '';
  addEventListener(type: string, fn: Function) {
    const list = this.listeners(type);
    if (!list.includes(fn)) list.push(fn);
    this.__eventListeners.h[type] = vector(list);
  }
  private events = new Map<string, Function[]>();
  listeners(type: string) {
    if (!this.events.has(type)) this.events.set(type, []);
    return this.events.get(type)!;
  }
  removeEventListener(type: string, fn: Function) {
    const list = this.listeners(type),
      i = list.indexOf(fn);
    if (i >= 0) list.splice(i, 1);
  }
  dispatchEventWith(type: string, _bubbles = false, data?: any) {
    const event = {
      type,
      data,
      target: this,
      currentTarget: this,
      setCurrentTarget(target: any) {
        this.currentTarget = target;
      },
      stopPropagation() {},
      get_passedTime: () => data?.dt ?? 1 / 60,
    };
    invoke.call(this, event);
  }
  dispatch(event: any) {
    invoke.call(this, event);
  }
  addChild(child: Display) {
    child.parent?.removeChild(child);
    this.children.push(child);
    child.parent = this;
    return child;
  }
  addChildAt(child: Display, index: number) {
    this.addChild(child);
    this.children.pop();
    this.children.splice(index, 0, child);
    return child;
  }
  removeChild(child: Display, dispose = false) {
    const i = this.children.indexOf(child);
    if (i >= 0) this.children.splice(i, 1);
    child.parent = null;
    if (dispose) child.dispose();
    return child;
  }
  removeChildAt(index: number, dispose = false) {
    return this.removeChild(this.children[index], dispose);
  }
  removeChildren(start = 0, end = -1, dispose = false) {
    for (const c of this.children.slice(start, end < 0 ? undefined : end + 1))
      this.removeChild(c, dispose);
  }
  removeFromParent(dispose = false) {
    if (this.parent) this.parent.removeChild(this, dispose);
    else if (dispose) this.dispose();
  }
  getChildAt(index: number) {
    return this.children[index];
  }
  getChildIndex(child: Display) {
    return this.children.indexOf(child);
  }
  setChildIndex(child: Display, index: number) {
    const previous = this.children.indexOf(child);
    if (previous < 0) throw new Error('Child is not in this container');
    this.children.splice(previous, 1);
    this.children.splice(index, 0, child);
  }
  contains(child: Display) {
    return this.children.includes(child);
  }
  get_numChildren() {
    return this.children.length;
  }
  get_parent() {
    return this.parent;
  }
  get_stage(): any {
    return this.parent?.get_stage() ?? null;
  }
  dispose() {
    this.disposed = true;
    this.removeChildren(0, -1, true);
    this.events.clear();
  }
  get_width(): number {
    return (
      (this.values.width || Math.max(0, ...this.children.map((c) => c.get_x() + c.get_width()))) *
      this.values.scaleX
    );
  }
  set_width(v: number) {
    this.values.width = v;
    return v;
  }
  get_height(): number {
    return (
      (this.values.height || Math.max(0, ...this.children.map((c) => c.get_y() + c.get_height()))) *
      this.values.scaleY
    );
  }
  set_height(v: number) {
    this.values.height = v;
    return v;
  }
  get_x() {
    return this.values.x;
  }
  set_x(v: number) {
    this.values.x = v;
    return v;
  }
  get_y() {
    return this.values.y;
  }
  set_y(v: number) {
    this.values.y = v;
    return v;
  }
  [key: string]: any;
}
const props = [
  'scaleX',
  'scaleY',
  'visible',
  'alpha',
  'touchable',
  'pixelSnapping',
  'wordWrap',
  'autoScale',
  'autoSize',
  'blendMode',
  'mask',
  'filter',
  'useHandCursor',
  'batchable',
  'name',
];
for (const key of props) {
  Display.prototype['get_' + key] = function () {
    return this.values[key];
  };
  Display.prototype['set_' + key] = function (v: any) {
    this.values[key] = v;
    return v;
  };
}
Display.prototype.__properties__ = Object.fromEntries(
  [...props, 'x', 'y', 'width', 'height', 'parent', 'stage', 'numChildren'].flatMap((k) => [
    ['get_' + k, 'get_' + k],
    ...((Display.prototype as any)['set_' + k] ? [['set_' + k, 'set_' + k]] : []),
  ]),
);
export class Stage extends Display {
  get_stage() {
    return this;
  }
  get_stageWidth() {
    return 1280;
  }
  get_stageHeight() {
    return 800;
  }
}
export class Format {
  get_color(): number {
    return this.color;
  }
  [key: string]: any;
  constructor(
    font = 'DAIDRR',
    size = 14,
    color = 0xffffff,
    horizontalAlign = 'left',
    verticalAlign = 'center',
  ) {
    Object.assign(this, { font, size, color, horizontalAlign, verticalAlign });
  }
}
for (const key of ['font', 'size', 'color', 'horizontalAlign', 'verticalAlign'])
  (Format.prototype as any)['set_' + key] = function (v: any) {
    this[key] = v;
    return v;
  };
export class Text extends Display {
  static __super__: any = Display;
  static fonts = new Map();
  static unregisterBitmapFont(name: string, _dispose = true) {
    this.fonts.delete(name);
  }
  static getBitmapFont(name: string) {
    return this.fonts.get(name);
  }
  static registerBitmapFont(font: any, name: string) {
    this.fonts.set(name, font);
  }
  text = '';
  format: Format;
  constructor(w = 0, h = 0, text = '', format = new Format()) {
    super();
    this.set_width(w);
    this.set_height(h);
    this.text = text;
    this.format = format;
  }
  set_text(v: string) {
    this.text = v;
    return v;
  }
  get_text() {
    return this.text;
  }
  get_format() {
    return this.format;
  }
  set_format(value: Format) {
    this.format = value;
    return value;
  }
  get_textBounds() {
    return { width: Array.from(this.text).length * this.format.size * 0.5 };
  }
}
Text.prototype.__properties__ = {
  ...Display.prototype.__properties__,
  get_text: 'get_text',
  set_text: 'set_text',
  get_format: 'get_format',
  set_format: 'set_format',
  get_textBounds: 'get_textBounds',
};
export class Quad extends Display {
  static __super__: any = Display;
  constructor(w: number, h: number, color = 0) {
    super();
    this.set_width(w);
    this.set_height(h);
    this.set_color(color);
  }
  set_color(color: number) {
    this.values.color = color;
  }
  get_color() {
    return this.values.color;
  }
}
export class Image extends Quad {
  static __super__: any = Quad;
  texture: any;
  constructor(texture: any) {
    super(texture.width ?? 32, texture.height ?? 32);
    this.texture = texture;
  }
  alignPivot() {
    this.values.pivotX = this.get_width() / 2;
    this.values.pivotY = this.get_height() / 2;
  }
  set_rotation(value: number) {
    this.values.rotation = value;
  }
  set_texture(t: any) {
    this.texture = t;
  }
}
export class Filter {
  [key: string]: any;
  set_color(v: number) {
    this.color = v;
  }
  set_alpha(v: number) {
    this.alpha = v;
  }
  cache() {}
  dispose() {}
}
export class Bitmap {
  constructor(..._args: any[]) {}
  setPixel32() {}
  dispose() {}
  static loadFromBase64() {
    const future = {
      onError() {
        return future;
      },
      onComplete(fn: Function) {
        queueMicrotask(() => fn(new Bitmap()));
        return future;
      },
    };
    return future;
  }
}
export class Entry extends Display {
  text = '';
  get_text() {
    return this.text;
  }
  set_text(t: string) {
    return (this.text = t);
  }
  set_paddingLeft() {}
  set_displayAsPassword() {}
  set_textFormat() {}
  set_maxChars() {}
  set_restrict() {}
}
export class NativeButton extends Display {
  callback: Function;
  constructor(labelOrCallback: any, callbackOrLabel: any) {
    super();
    this.callback = typeof labelOrCallback === 'function' ? labelOrCallback : callbackOrLabel;
    this.set_width(120);
    this.set_height(32);
  }
  set_text() {}
}
export class Unit {
  damageFlash() {}
  alive = true;
  isHostile = true;
  level = 85;
  id = 1;
  name = 'Nexar Skirmisher lvl 85';
  hp = 100;
  shieldHp = 50;
  clip = new Display();
  get_pos() {
    return { x: 100, y: 0 };
  }
  get_movieClip() {
    return this.clip;
  }
  get_hpMax() {
    return 100;
  }
  get_shieldHpMax() {
    return 50;
  }
  hasFaction() {
    return false;
  }
}
export class Ship extends Unit {
  initCourse(_heading: any) {}
  set_course(heading: any) {
    return heading;
  }
  destroy() {}
  update() {}
  reset() {}
  draw() {}
}

export class ShipSync {
  playerCourse(_message: any, _offset = 0) {}
  playerUsedBoost(_message: any, _offset = 0) {}
}
export class Converger {
  calculateOffset() {}
  run() {}
}
export class Heading {
  parseMessage(_message: any, _offset: number) {}
}

export class GameStateMachine {
  update() {}
  set_clock(clock: any) {
    return clock;
  }
}

export class PlayerShip extends Ship {
  runCommand(_type: number, _active: boolean) {}
  land() {}
  enterWarpJump() {}
  player: any;
  get_course() {
    return { speed: { x: 3, y: 4 } };
  }
}
export class EnemyShip extends Ship {
  cloakStart() {}
  cloakEnd(_heading: any) {}
  set_alpha(value: number) {
    return this.clip.set_alpha(value);
  }
  get_alpha() {
    return this.clip.get_alpha();
  }
  static RARE_TYPE_DEFENDER = 1;
  static RARE_TYPE_ATTACKER = 2;
  static RARE_TYPE_SPEEDER = 3;
  static RARE_TYPE_LEGENDARY = 4;
  static RARE_TYPE_UNIQUE = 5;
}
export class Game extends Display {
  camera = { _switch: false, update() {}, shake() {} };
  parallaxManager = { update() {} };
  stage = new Stage();
  overlay = new Display();
  canvas = new Display();
  hud = { container: new Display(), radar: new Display(), bossHealth: new Display() };
  frames = 0;
  blockHotkeys = false;
  projectileManager = {};
  unitManager = {
    units: [new EnemyShip()],
    add(unit: EnemyShip) {
      this.units.push(unit);
    },
    remove(unit: EnemyShip) {
      this.units.splice(this.units.indexOf(unit), 1);
      unit.reset();
    },
  };
  clock = { latency: 25 };
  serviceConnection = { get_connected: () => true };
  me = { id: 'tester', ship: new PlayerShip(), get_group: () => null };
  constructor() {
    super();
    this.stage.addChild(this);
    this.addChild(this.overlay);
    this.addChild(this.canvas);
    this.addChild(this.hud.container);
    this.hud.container.addChild(this.hud.radar);
    this.hud.radar.set_y(650);
    this.me.ship.player = { isMe: true };
  }
  get_me() {
    return this.me;
  }
  get_stage() {
    return this.stage;
  }
  runGameLoop() {
    this.addEventListener('enterFrame', this.update.bind(this));
  }
  exit() {}
  tickUpdate() {}
  update(event: any) {
    if (!event) throw Error('Game frame event lost');
    event.get_passedTime();
    this.frames++;
  }
  frame() {
    this.dispatch({
      type: 'enterFrame',
      data: null,
      setCurrentTarget() {},
      get_passedTime: () => 1 / 60,
    });
  }
}
export function registry() {
  class SettingsState {
    container = new Display();
    bg = new Quad(760, 580);
    constructor(public g: Game) {}
    enter() {
      this.container.addChild(this.bg);
      this.g.stage.addChild(this.container);
    }
    resize() {}
    close() {
      this.exit();
    }
    exit() {
      this.container.removeFromParent();
    }
  }
  class Login extends Display {
    init() {}
    resize() {}
    connectSteam() {}
  }
  class Chat {
    input = { get_text: () => '', set_text: () => {} };
    previous() {}
    next() {}
    closeChat() {}
    sendMessage() {}
  }
  class Overview extends Display {
    load() {}
    loadComplate() {}
    initActiveSlots() {}
    reloadStats() {}
    drawComponents() {}
    onRecycleSelect() {}
    selectAllForRecycle() {}
    toggleRecycle() {}
    toggleUpgrade() {}
    onRecycle() {}
    onRecycleMessage() {}
    chooseSorting() {}
    onSort() {}
    drawArtifactsInCargo() {}
  }
  class Cargo extends Display {
    update() {}
    onClick() {}
    toggleRecycle() {}
    setSelectedForRecycle() {}
    addToolTip() {}
  }
  class Box extends Display {
    update() {}
    setArtifact() {}
  }
  class Radar {
    update() {}
  }
  const texture = { width: 32, height: 32, get_root: () => ({}), dispose() {} };
  return {
    ...overlayClasses(Display),
    'data.DataLocator': { getService: () => null },
    'sound.SoundLocator': { getService: () => null, register() {} },
    'sound.SoundManager': class {
      playMusic() {}
      internalPlay() {}
      stopMusic() {}
      stop() {}
      stopAllMusicExcept() {}
      stopAll() {}
    },
    'core.scene.Game': Game,
    'core.states.GameStateMachine': GameStateMachine,
    'core.ship.Ship': Ship,
    'core.ship.ShipSync': ShipSync,
    'core.sync.Converger': Converger,
    'movement.Heading': Heading,
    'core.states.gameStates.SettingsState': SettingsState,
    'core.scene.SceneBase': {},
    Login: Login,
    'core.hud.components.chat.ChatInputText': Chat,
    'starling.display.Sprite': Display,
    'starling.display.Quad': Quad,
    'starling.display.Image': Image,
    'starling.text.TextField': Text,
    'starling.text.TextFormat': Format,
    'starling.filters.GlowFilter': Filter,
    'starling.filters.BlurFilter': Filter,
    'starling.filters.ColorMatrixFilter': class extends Filter {
      concatValues(...values: number[]) {
        this.matrix = values;
      }
    },
    'openfl.display.BitmapData': Bitmap,
    'starling.text.BitmapFont': class {
      set_smoothing() {}
    },
    'starling.textures.Texture': { fromBitmapData: () => texture },
    'textures.TextureLocator': {
      getService: () => ({
        getTextureGUIByTextureName: () => texture,
        getTextureByTextureName: () => texture,
      }),
    },
    'core.artifact.ArtifactCargoBox': Cargo,
    'core.artifact.ArtifactBox': Box,
    'core.artifact.ArtifactOverview': Overview,
    'core.states.DisplayState': class {
      enter() {}
      exit() {}
    },
    'core.states.menuStates.ArtifactState2': class {
      enter() {}
      exit() {}
    },
    'core.player.Player': { ARTIFACT_CAPACITY: [250, 400, 600, 800] },
    'generics.Localize': { t: (text: string) => text },
    'core.hud.components.TextBitmap': Text,
    'core.artifact.ArtifactSorting': class {},
    'core.hud.components.ToolTip': ToolTip,
    'core.hud.components.Button': NativeButton,
    'core.ship.PlayerShip': PlayerShip,
    'core.ship.EnemyShip': EnemyShip,
    'core.unit.Unit': Unit,
    'core.boss.Boss': class extends Unit {},
    'core.spawner.Spawner': class extends Unit {},
    'core.hud.components.radar.Radar': Radar,
    'core.hud.components.ui.TextEntry': Entry,
    'core.hud.components.LoginButton': NativeButton,
    'openfl.geom.Point': class {
      constructor(
        public x = 0,
        public y = 0,
      ) {}
    },
    'starling.events.Event': { CHANGE: 'change' },
    'starling.events.Touch': class {},
    'starling.events.TouchEvent': class {},
  } as any;
}

// Native tooltip ownership and public setters; no renderer simulation.
export class ToolTip {
  static instances: ToolTip[] = [];
  text = '';
  color = 0;
  hidden = false;
  disposed = false;
  constructor(
    _game: any,
    readonly target: Display,
    text: string,
    _images: any,
    readonly type: string,
    readonly width: number,
  ) {
    this.text = text;
    ToolTip.instances.push(this);
  }
  set_text(text: string) {
    this.text = text;
  }
  set_color(color: number) {
    this.color = color;
  }
  hide() {
    this.hidden = true;
  }
  static disposeType(type: string) {
    for (const tooltip of this.instances.filter((item) => item.type === type)) {
      tooltip.hide();
      tooltip.disposed = true;
    }
    this.instances = this.instances.filter((item) => item.type !== type);
  }
}
