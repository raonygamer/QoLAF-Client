import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MapNavigation } from '../src/map/MapNavigation';
import { installMapNavigation, mapHeatViewport } from '../src/map/NativeMapNavigation';
import { Display } from './fixtures/NativeGame';
// @ts-expect-error actual host hooks
import { Hooks } from './fixtures/HostCore.js';

const close = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-8, `${a} versus ${b}`);
test('original map navigation preserves pointer anchor, drag threshold and zoom on recenter', () => {
  const nav = new MapNavigation(698, 538);
  nav.follow(25, 40);
  assert.equal(nav.x, 324);
  assert.equal(nav.y, 229);
  nav.begin(1, 100, 100);
  nav.move(2, 200, 200);
  assert.equal(nav.centerX, 25);
  nav.move(1, 103, 100);
  assert.equal(nav.panGestureActive, false);
  nav.move(1, 104, 100);
  assert.equal(nav.panGestureActive, true);
  assert.equal(nav.centerX, 21);
  nav.follow(999, 999);
  assert.equal(nav.centerX, 21);
  nav.wheel(1, 50, 50);
  assert.equal(nav.zoom, 1, 'wheel consumed but no zoom during drag');
  nav.cancelPan();
  assert.equal(nav.cancelledTouchId, 1);
  assert.equal(nav.panGestureActive, false);
  for (let i = 0; i < 100; i++) {
    const x = (i * 37) % 698,
      y = (i * 83) % 538,
      beforeX = (x - nav.x) / nav.zoom,
      beforeY = (y - nav.y) / nav.zoom;
    nav.wheel(i % 3 ? 1 : -1, x, y);
    close((x - nav.x) / nav.zoom, beforeX);
    close((y - nav.y) / nav.zoom, beforeY);
  }
  for (let i = 0; i < 100; i++) nav.wheel(1, 100, 100);
  assert.equal(nav.zoom, 4);
  for (let i = 0; i < 100; i++) nav.wheel(-1, 100, 100);
  assert.equal(nav.zoom, 0.25);
  nav.center(20, 30);
  assert.equal(nav.zoom, 0.25);
  assert.equal(nav.followingPlayer, true);
  nav.follow(22, 33);
  assert.equal(nav.centerX, 22);
  nav.begin(5, 0, 0);
  nav.move(5, 8, 12);
  assert.equal(nav.centerX, -10);
  assert.equal(nav.centerY, -15);
  nav.cancelPan();
  nav.begin(6, 0, 0);
  assert.equal(nav.cancelledTouchId, -1);
});

test('native viewport uses original padding, gestures, wheel hit testing and independent map scale', () => {
  const hooks = new Hooks(),
    cleanups: Function[] = [],
    events = new Map();
  const stage = new Display() as any,
    wheelStage = new Display();
  const starling = {
    get_nativeStage: () => wheelStage,
    get_viewPort: () => ({ x: 0, y: 0, width: 1000, height: 800 }),
  };
  stage.get_starling = () => starling;
  stage.get_stageWidth = () => 1000;
  stage.get_stageHeight = () => 800;
  let hit: any = null;
  stage.hitTest = () => hit;
  class Sprite extends Display {
    globalToLocal(p: any, r: any) {
      r.x = p.x - this.get_x();
      r.y = p.y - this.get_y();
      return r;
    }
    contains(child: any): boolean {
      return (
        child === this || this.children.some((c) => c === child || (c as any).contains?.(child))
      );
    }
  }
  class Point {
    x = 0;
    y = 0;
    setTo(x: number, y: number) {
      this.x = x;
      this.y = y;
    }
  }
  class Quad extends Display {
    constructor(w: number, h: number, color: number) {
      super();
      this.set_width(w);
      this.set_height(h);
    }
  }
  class Button extends Display {
    enabled = true;
    set_enabled(value: boolean) {
      this.enabled = value;
    }
    click() {
      if (this.enabled) {
        this.enabled = false;
        this.callback();
      }
    }
    constructor(
      public callback: () => void,
      public text: string,
    ) {
      super();
      this.set_width(60);
    }
  }
  const game: any = {};
  let nativeUpdates = 0,
    clicks = 0,
    aims = 0,
    bodyUpdates = 0;
  const player: any = { get_isMe: () => true, get_x: () => 100, get_y: () => 50, update() {} };
  class MapView extends Sprite {
    static SCALE = 0.1;
    static WIDTH = 0;
    static HEIGHT = 0;
    static PADDING = 0;
    static CORNER = 0;
    g = game;
    mapContainer = new Sprite();
    closeButton = new Button(() => {}, 'close');
    coords = Object.assign(new Display(), { set_text(value: string) {} });
    mapPlayers = [player];
    mapBodies = [
      {
        update() {
          bodyUpdates++;
        },
      },
    ];
    pvpZones: any[] = [];
    mapSpawners: any[] = [];
    mapBosses: any[] = [];
    mapLastKilled = { update() {} };
    get_stage() {
      return stage;
    }
    load(scale = 0.1, _w = 698, _h = 538, _p = 31, _c = 10, _pvp = false) {
      MapView.SCALE = scale;
      this.addChild(this.mapContainer);
      this.mapContainer.set_mask(new Quad(698, 538, 0));
      this.closeButton.set_x(700);
      this.addChild(this.closeButton);
      return 123;
    }
    update() {
      nativeUpdates++;
      return 456;
    }
    playerJoined() {}
    dispose() {}
  }
  class Body {
    layer = new Sprite();
    click(_e: any) {
      clicks++;
      return 55;
    }
  }
  class Play {
    g = game;
    updateAimAngle() {
      aims++;
      return 77;
    }
  }
  const classes: any = {
    'core.hud.components.map.Map': MapView,
    'starling.display.Sprite': Sprite,
    'starling.display.Quad': Quad,
    'openfl.geom.Point': Point,
    'core.hud.components.ButtonExpandableHud': Button,
    'core.hud.components.map.MapBodyBase': Body,
    'generics.Localize': { t: (v: string) => v },
    'core.states.gameStates.PlayState': Play,
    RymdenRunt: { isInFocus: true },
  };
  const api: any = {
    cls: (n: string) => classes[n],
    before: (t: any, k: string, f: Function) => cleanups.push(hooks.add(t, k, 'before', f)),
    after: (t: any, k: string, f: Function) => cleanups.push(hooks.add(t, k, 'after', f)),
    around: (t: any, k: string, f: Function) => cleanups.push(hooks.add(t, k, 'around', f)),
    on: (n: string, f: Function) => events.set(n, f),
    defer: (f: Function) => cleanups.push(f),
  };
  installMapNavigation(api, game);
  const map = new MapView();
  assert.equal(map.load(), 123);
  const viewport = map.children[0],
    background = viewport.children[0];
  assert.equal(viewport.get_x(), 31);
  assert.equal(viewport.get_y(), 31);
  assert.equal(map.mapContainer.get_mask(), null);
  assert.equal(map.mapContainer.get_x(), 249);
  assert.equal(map.mapContainer.get_y(), 219);
  assert.equal(
    (viewport.get_mask() as Display).get_touchable(),
    true,
    'Starling must hit-test the viewport mask',
  );
  assert.equal(wheelStage.listeners('mouseWheel').length, 1);
  const centerButton = map.children.at(-1) as Button;
  assert.equal(centerButton.text, 'Center');
  assert.equal(centerButton.get_x(), 630);
  map.update();
  assert.equal(nativeUpdates, 0);
  assert.equal(bodyUpdates, 1);
  const other = new MapView();
  other.g = {};
  assert.equal(other.update(), 456);
  const body = new Body();
  map.mapContainer.addChild(body.layer);
  const touch: any = {
    id: 3,
    phase: 'began',
    tapCount: 1,
    x: 100,
    y: 100,
    getLocation(_v: any, p: any) {
      p.setTo(this.x, this.y);
    },
  };
  const event: any = {
    target: body.layer,
    getTouch(_v: any, phase: any, id = -1) {
      return (id < 0 || id === touch.id) && (!phase || phase === touch.phase) ? touch : null;
    },
  };
  const onTouch = viewport.listeners('touch')[0];
  onTouch(event);
  const play = new Play();
  play.updateAimAngle();
  assert.equal(aims, 0, 'map drag owns mouse aim');
  touch.phase = 'ended';
  touch.x = 150;
  assert.equal(
    body.click(event),
    undefined,
    'child sees drag threshold before parent touch-end bubbles',
  );
  assert.equal(clicks, 0);
  onTouch(event);
  assert.equal(map.mapContainer.get_x(), 299);
  assert.equal(body.click(event), undefined, 'cancelled touch-end stays suppressed');
  play.updateAimAngle();
  assert.equal(aims, 1);
  touch.id = 4;
  touch.phase = 'began';
  touch.x = 120;
  onTouch(event);
  touch.phase = 'ended';
  assert.equal(body.click(event), 55);
  onTouch(event);
  assert.equal(clicks, 1, 'ordinary click remains native');
  const wheel = wheelStage.listeners('mouseWheel')[0];
  let prevented = 0,
    stopped = 0;
  const wheelEvent: any = {
    target: wheelStage,
    delta: 1,
    stageX: 231,
    stageY: 181,
    preventDefault() {
      prevented++;
    },
    stopImmediatePropagation() {
      stopped++;
    },
  };
  wheel(wheelEvent);
  assert.equal(prevented, 0, 'outside hits fall through');
  hit = background;
  const anchor = (200 - map.mapContainer.get_x()) / map.mapContainer.get_scaleX();
  wheel(wheelEvent);
  assert.equal(prevented, 1);
  assert.equal(stopped, 1);
  close(map.mapContainer.get_scaleX(), 1.15);
  close((200 - map.mapContainer.get_x()) / 1.15, anchor);
  const heatViewport = mapHeatViewport(map, 698, 538);
  close(heatViewport.right - heatViewport.left, 698 / 1.15);
  centerButton.click();
  assert.equal(centerButton.enabled, true, 'Center remains reusable after native one-shot disable');
  centerButton.click();
  assert.equal(centerButton.enabled, true);
  close(map.mapContainer.get_x(), 349 - 100 * 1.15);
  const second = new MapView();
  second.load(0.02, 200, 150, 10, 5, true);
  map.update();
  assert.equal(MapView.SCALE, 0.1);
  second.update();
  assert.equal(MapView.SCALE, 0.02);
  map.dispatchEventWith('removedFromStage');
  assert.equal(wheelStage.listeners('mouseWheel').length, 1);
  map.dispatchEventWith('addedToStage');
  assert.equal(wheelStage.listeners('mouseWheel').length, 2);
  const viewportMask = viewport.get_mask() as Display;
  map.dispose();
  assert.equal(viewportMask.disposed, true);
  assert.equal(centerButton.disposed, true);
  assert.equal(wheelStage.listeners('mouseWheel').length, 1);
  assert.ok(map.mapContainer.get_mask());
  cleanups.reverse().forEach((f) => f());
  assert.equal(wheelStage.listeners('mouseWheel').length, 0);
  assert.equal(map.update(), 456);
});
