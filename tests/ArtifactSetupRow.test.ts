import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ArtifactSetupRow } from '../src/artifacts/ArtifactSetupRow';
import { setupRowLayout } from '../src/artifacts/SetupRowLayout';
import { setupScrollbarSkin } from '../src/artifacts/SetupScrollbarSkin';

class Node {
  children: Node[] = [];
  parent: Node | null = null;
  x = 0;
  y = 0;
  width = 0;
  height = 0;
  visible = true;
  disposed = false;
  listeners = new Map<string, Function>();
  constructor(public texture: any = null) {}
  set_x(v: number) {
    this.x = v;
  }
  get_x() {
    return this.x;
  }
  set_y(v: number) {
    this.y = v;
  }
  get_y() {
    return this.y;
  }
  set_width(v: number) {
    this.width = v;
  }
  get_width() {
    return this.width;
  }
  set_height(v: number) {
    this.height = v;
  }
  get_height() {
    return this.height;
  }
  set_visible(v: boolean) {
    this.visible = v;
  }
  get_parent() {
    return this.parent;
  }
  get_stage() {
    return {};
  }
  getBounds(target: Node, result: any = {}) {
    let x = this.x,
      y = this.y;
    for (let parent = this.parent; parent && parent !== target; parent = parent.parent) {
      x += parent.x;
      y += parent.y;
    }
    return Object.assign(result, { x, y, width: this.width, height: this.height });
  }
  set_mask(_mask: any) {}
  set_alpha(_v: number) {}
  set_touchable(_v: boolean) {}
  set_scale9Grid(_grid: any) {}
  set_texture(v: any) {
    this.texture = v;
  }
  addEventListener(type: string, fn: Function) {
    this.listeners.set(type, fn);
  }
  removeEventListener(type: string, fn: Function) {
    if (this.listeners.get(type) === fn) this.listeners.delete(type);
  }
  addChild(node: Node) {
    node.removeFromParent(false);
    node.parent = this;
    this.children.push(node);
  }
  getChildAt(index: number) {
    return this.children[index];
  }
  removeFromParent(dispose: boolean) {
    if (this.parent) this.parent.children.splice(this.parent.children.indexOf(this), 1);
    this.parent = null;
    if (dispose) this.dispose();
  }
  dispose() {
    this.disposed = true;
    for (const child of this.children) child.dispose();
  }
}
class Point {
  constructor(
    public x = 0,
    public y = 0,
  ) {}
  setTo(x: number, y: number) {
    this.x = x;
    this.y = y;
  }
}

test('source setup row reserves the scrollbar only on overflow and clamps thumb geometry', () => {
  assert.deepEqual(setupRowLayout(650, 650, 70, 480), {
    maximum: 0,
    height: 24,
    thumbWidth: 650,
    cargoY: 106,
    cargoHeight: 364,
  });
  const overflowing = setupRowLayout(650, 1300, 70, 480);
  assert.equal(overflowing.height, 34);
  assert.equal(overflowing.thumbWidth, 325);
  assert.equal(overflowing.cargoY, 116);
  assert.equal(setupRowLayout(650, 100000, 70, 480).thumbWidth, 52);
});

test('native setup row scrolls by thumb, track and wheel and restores buttons on rebuild', async (context) => {
  context.mock.timers.enable({ apis: ['setInterval'] });
  const wheel = new Set<Function>();
  let hit: Node | null = null;
  const starling = {
    get_nativeStage: () => ({
      get_mouseX: () => 10,
      get_mouseY: () => 10,
      window: {
        __scale: 1,
        onMouseWheel: {
          add: (fn: Function) => wheel.add(fn),
          remove: (fn: Function) => wheel.delete(fn),
        },
      },
    }),
    get_supportHighResolutions: () => false,
    get_contentScaleFactor: () => 1,
    get_viewPort: () => ({ x: 0, y: 0 }),
    get_stage: () => ({ hitTest: () => hit }),
  };
  const classes: Record<string, any> = {
    'starling.display.Sprite': Node,
    'starling.display.Quad': Node,
    'starling.display.Image': Node,
    'openfl.geom.Point': Point,
    'openfl.geom.Rectangle': Point,
    'starling.core.Starling': { get_current: () => starling },
  };
  const view: any = Object.assign(new Node(), {
    setups: Array.from({ length: 30 }, (_, index) =>
      Object.assign(new Node(), { x: index * 38, y: 70, width: 32 }),
    ),
    activeSlots: [],
    cargoContainer: new Node(),
  });
  for (const button of view.setups) view.addChild(button);
  const skins = { up: {}, hover: {}, down: {}, icon: {} };
  const row = new ArtifactSetupRow(
    { cls: (name: string) => classes[name], log: assert.fail } as any,
    view,
    async () => skins,
  );
  await Promise.resolve();
  const root = row.root as Node;
  const [, content, track, thumb] = root.children;
  assert.deepEqual(root.getBounds(view), { x: 0, y: 70, width: 650, height: 34 });
  hit = content.children[0];
  assert.equal(view.cargoContainer.y, 116);
  assert.equal(view.cargoContainer.height, 354);
  assert.equal(wheel.size, 1);
  [...wheel][0](0, -1, { _hx_index: 1 });
  assert.equal(content.x, -38);
  const touch = (phase: string, target: Node, x: number) =>
    root.listeners.get('touch')!({
      getTouch: () => ({
        phase,
        target,
        id: 0,
        getLocation: (_node: Node, point: Point) => point.setTo(x, 26),
      }),
    });
  row.scrollTo(0);
  touch('began', thumb.children[0], 0);
  assert.equal(thumb.children[0].texture, skins.down);
  touch('moved', thumb.children[0], 650 - thumb.children[0].width);
  assert.equal(content.x, -(1134 - 650));
  touch('ended', thumb.children[0], 650);
  assert.equal(thumb.children[0].texture, skins.up);
  touch('began', track, 0);
  assert.equal(content.x, -190, 'source page fraction snaps to the 38px scroll step');
  context.mock.timers.tick(249);
  assert.equal(content.x, -190);
  context.mock.timers.tick(1);
  assert.equal(Math.abs(content.x), 0, 'holding the track repeats after 250ms');
  touch('ended', track, 0);
  row.scrollTo(0);
  touch('began', thumb.children[0], 0);
  touch('moved', thumb.children[0], 20);
  assert.equal(content.x, -38, 'thumb movement uses source step rounding');
  touch('ended', thumb.children[0], 20);
  touch('began', track, 650);
  const heldPosition = content.x;
  touch('ended', track, 650);
  context.mock.timers.tick(1000);
  assert.equal(content.x, heldPosition, 'release stops repeat scrolling');
  row.scrollTo(10000);
  view.setups.splice(2);
  row.layout();
  assert.equal(Math.abs(content.x), 0, 'a shorter row clamps the previous scroll');
  assert.equal(thumb.visible, false);
  assert.equal(view.cargoContainer.y, 106);
  row.dispose(true);
  context.mock.timers.tick(1000);
  assert.equal(wheel.size, 0);
  assert.equal(root.disposed, true);
  for (const button of view.setups) {
    assert.equal(button.parent, view);
    assert.equal(button.disposed, false);
    assert.equal(button.y, 70, 'unloading must not leave setup controls over active slots');
    assert.equal(button.x, view.setups.indexOf(button) * 38);
  }
});

test('original Aeon texture upload is shared and retired loads cannot create GPU resources', async () => {
  const cleanup: Function[] = [];
  let complete: Function = () => {};
  let uploads = 0,
    disposed = 0;
  const classes: Record<string, any> = {
    'openfl.display.BitmapData': {
      loadFromBase64: () => ({
        onError() {},
        onComplete(fn: Function) {
          complete = fn;
        },
      }),
    },
    'starling.textures.Texture': {
      fromBitmapData() {
        uploads++;
      },
    },
    'openfl.geom.Rectangle': Point,
  };
  const load = setupScrollbarSkin(
    { cls: (name: string) => classes[name], defer: (fn: Function) => cleanup.push(fn) } as any,
    'data:image/png;base64,AA==',
  );
  const first = load();
  assert.equal(load(), first);
  cleanup[0]();
  complete({
    dispose() {
      disposed++;
    },
  });
  assert.deepEqual(await first, {});
  assert.equal(uploads, 0);
  assert.equal(disposed, 1);
});
