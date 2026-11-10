import { installMapTextureKeys } from '../src/map/MapTextureKeys';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Display } from './fixtures/NativeGame';
import { NativeUI } from '../src/ui/NativeUI';
import { MapLiveMiniature } from '../src/map/MapLiveMiniature';
import { MapLiveMiniatures, installMapLiveMiniatures } from '../src/map/NativeMapLiveMiniatures';
import { NexarEnemyIdentification } from '../src/ship/NexarEnemyIdentification';
// @ts-expect-error actual host hooks
import { Hooks } from './fixtures/HostCore.js';

test('Nexar classification uses the original exact named-Emperor exception', () => {
  for (const name of ['Emperor Xhersix', 'Emperor Yhgvis', 'Emperor Zharix']) {
    assert.equal(
      NexarEnemyIdentification.usesMinibossMarker({ name: name + ' lvl 150', miniboss: false }),
      true,
    );
    assert.equal(NexarEnemyIdentification.isImportant(name, true, false), true);
  }
  for (const name of [
    'Emperor Fake',
    'Emperor Xhersix escort',
    'emperor Xhersix',
    'Nexar Commander',
  ])
    assert.equal(NexarEnemyIdentification.usesMinibossMarker({ name, miniboss: false }), false);
  assert.equal(
    NexarEnemyIdentification.usesMinibossMarker({ name: 'Other', miniboss: true }),
    true,
  );
  for (const name of ['Blade', 'Edge', 'Phaser', 'Shadow', 'Vindicator'])
    assert.equal(
      NexarEnemyIdentification.isImportant('Nexar Elite ' + name + ' lvl 100', true, true, true),
      false,
    );
  assert.equal(NexarEnemyIdentification.isImportant('Nexar Commander', true, false), true);
  assert.equal(NexarEnemyIdentification.isImportant('Nexar Commander', false, true), false);
});

function fixture() {
  class Unit {
    alive = true;
    active = true;
    visible = true;
    isHostile = true;
    isAddedToCanvas = true;
    movieClip: any;
    x = 0;
    y = 0;
    rotation = 0;
  }
  class Image extends Display {
    texture: any;
    adjustments = 0;
    constructor(texture: any) {
      super();
      this.texture = texture;
    }
    get_texture() {
      return this.texture;
    }
    set_texture(value: any) {
      this.texture = value;
    }
    readjustSize() {
      this.adjustments++;
    }
    set_textureSmoothing(value: string) {
      this.values.textureSmoothing = value;
    }
    set_pivotX(value: number) {
      this.values.pivotX = value;
    }
    set_pivotY(value: number) {
      this.values.pivotY = value;
    }
    set_color(value: number) {
      this.values.color = value;
    }
    set_rotation(value: number) {
      this.values.rotation = value;
    }
  }
  class Glow {
    disposed = false;
    resolution = 0;
    smoothing = '';
    constructor(
      public color: number,
      public alpha: number,
      public blur: number,
      public quality: number,
    ) {}
    set_resolution(v: number) {
      this.resolution = v;
    }
    set_textureSmoothing(v: string) {
      this.smoothing = v;
    }
    dispose() {
      this.disposed = true;
    }
  }
  const classes: any = {
    'core.unit.Unit': Unit,
    'starling.display.Sprite': Display,
    'starling.display.Image': Image,
    'starling.filters.GlowFilter': Glow,
  };
  const api: any = { cls: (name: string) => classes[name] };
  const lives = new WeakMap(),
    life = (o: any) => lives.get(o) ?? 0;
  const unit = (texture: any = { name: 'hull', disposed: false }) => {
    const u = new Unit();
    u.movieClip = {
      texture,
      x: 50,
      y: 60,
      rotation: 0.3,
      pivotX: 10,
      pivotY: 20,
      scaleX: 2,
      scaleY: -1,
      color: 0x123456,
      alpha: 0.4,
    };
    return u;
  };
  return { classes, api, ui: new NativeUI(api), lives, life, unit };
}

test('live miniature copies animation, tint, pivot and rendered pose without owning textures', () => {
  const f = fixture(),
    parent = new Display(),
    owner = f.unit(),
    texture = owner.movieClip.texture;
  const marker = new MapLiveMiniature(f.ui, parent, owner, false, f.life);
  marker.update(0.1);
  const image: any = marker.layer.getChildAt(0),
    glow: any = marker.layer.get_filter();
  assert.deepEqual([marker.layer.get_x(), marker.layer.get_y()], [5, 6]);
  assert.deepEqual(
    [image.get_x(), image.get_y(), image.get_scaleX(), image.get_scaleY()],
    [0, 0, 0.5, -0.25],
  );
  assert.deepEqual(
    [
      image.values.pivotX,
      image.values.pivotY,
      image.values.rotation,
      image.values.color,
      image.get_alpha(),
    ],
    [10, 20, 0.3, 0x123456, 0.4],
  );
  assert.deepEqual(
    [glow.color, glow.alpha, glow.blur, glow.quality, glow.resolution, glow.smoothing],
    [0xff3344, 0.9, 1.25, 0.9, 2, 'bilinear'],
  );
  const animated = { name: 'hull2' };
  owner.movieClip.texture = animated;
  marker.update(0.1);
  assert.equal(image.texture, animated);
  assert.equal(image.adjustments, 1);
  owner.active = false;
  marker.update(0.1);
  assert.equal(image.get_visible(), false);
  owner.active = true;
  owner.isAddedToCanvas = false;
  owner.x = 900;
  owner.y = 1000;
  marker.update(0.1);
  assert.equal(
    marker.layer.get_x(),
    90,
    'offscreen icon follows native position instead of stale drawn clip',
  );
  f.lives.set(owner, 1);
  assert.equal(marker.ownsCurrentLifecycle, false);
  marker.update(0.1);
  assert.equal(marker.layer.get_visible(), false);
  marker.dispose();
  assert.equal(image.disposed, true);
  assert.equal(glow.disposed, true);
  assert.equal(texture.disposed, false);
});

test('multipart boss miniatures preserve component offsets, explosion frames and special scale', () => {
  const f = fixture(),
    parent = new Display(),
    part = f.unit();
  part.movieClip.x = 150;
  part.movieClip.y = 250;
  const boss: any = {
    alive: true,
    awaitingActivation: false,
    x: 100,
    y: 200,
    rotation: 0,
    isHostile: false,
    allComponents: [part],
    key: 'normal',
  };
  const marker = new MapLiveMiniature(f.ui, parent, boss, true, f.life);
  marker.update(0.1);
  const image: any = marker.layer.getChildAt(0);
  assert.deepEqual(
    [marker.layer.get_x(), marker.layer.get_y(), image.get_x(), image.get_y(), image.get_scaleX()],
    [10, 20, 5, 5, 0.2],
  );
  assert.equal(marker.layer.get_filter().color, 0xffffff);
  part.alive = false;
  marker.update(0.1);
  assert.equal(image.get_visible(), false, 'dead hull is hidden');
  part.movieClip.texture = { name: 'explosion' };
  marker.update(0.1);
  assert.equal(image.get_visible(), true, 'new death animation frame remains visible');
  boss.key = 'GuaN7AnGeUW_U2c0bLlo6Q';
  marker.update(0.1);
  assert.equal(image.get_scaleX(), 0.15);
  f.lives.set(part, 1);
  marker.update(0.1);
  assert.equal(image.get_visible(), false, 'pooled components cannot appear in old boss');
  boss.allComponents.push(f.unit());
  marker.update(0.1);
  assert.equal(image.disposed, true);
  assert.equal(marker.layer.get_numChildren(), 2);
  boss.awaitingActivation = true;
  marker.update(0.1);
  assert.equal(marker.layer.get_visible(), false);
  marker.dispose();
  assert.equal(parent.children.length, 0);
});

test('map reconciliation handles spawn/death, active boss identity and pooled miniboss reuse', () => {
  const f = fixture(),
    boss: any = { alive: true, awaitingActivation: true },
    enemy: any = { alive: true, miniboss: true, id: 5 };
  const game: any = {
    bossManager: { bosses: [boss] },
    shipManager: { enemies: [enemy], enemiesById: { h: { 5: enemy } } },
  };
  const created: any[] = [];
  const controller = new MapLiveMiniatures(game, 0.1, (owner, isBoss) => {
    const start = f.life(owner);
    const marker: any = {
      owner,
      isBoss,
      disposed: false,
      updates: 0,
      get ownsCurrentLifecycle() {
        return start === f.life(owner);
      },
      dispose() {
        this.disposed = true;
      },
      update(scale: number) {
        assert.equal(scale, 0.1);
        this.updates++;
      },
    };
    created.push(marker);
    return marker;
  });
  controller.update();
  assert.equal(created.length, 1);
  assert.equal(created[0].isBoss, false);
  boss.awaitingActivation = false;
  controller.update();
  assert.equal(created.length, 2);
  assert.equal(created[1].isBoss, true);
  controller.update();
  assert.equal(created.length, 2);
  f.lives.set(enemy, 1);
  controller.update();
  assert.equal(created[0].disposed, true);
  assert.equal(created.length, 3);
  game.shipManager.enemiesById.h[5] = {};
  controller.update();
  assert.equal(created[2].disposed, true);
  game.shipManager.enemiesById.h[5] = enemy;
  enemy.miniboss = false;
  enemy.name = 'Emperor Xhersix lvl 150';
  controller.update();
  assert.equal(created.length, 4);
  enemy.alive = false;
  boss.alive = false;
  controller.update();
  assert.equal(created[3].disposed, true);
  assert.equal(created[1].disposed, true);
  enemy.alive = true;
  game.shipManager.enemies = [];
  controller.update();
  assert.equal(created.length, 4);
  controller.dispose();
});

test('native map hook replaces only its own skull layers and restores them on cleanup', () => {
  const f = fixture(),
    hooks = new Hooks(),
    cleanups: Function[] = [],
    listeners = new Map();
  const boss: any = {
    alive: true,
    awaitingActivation: false,
    x: 0,
    y: 0,
    isHostile: true,
    allComponents: [],
  };
  const game: any = {
    bossManager: { bosses: [boss] },
    shipManager: { enemies: [], enemiesById: { h: {} } },
  };
  class MapView extends Display {
    static SCALE = 0.1;
    g = game;
    mapContainer = new Display();
    mapBosses = [{ layer: new Display() }];
    load() {
      this.mapContainer.addChild(this.mapBosses[0].layer);
      return 42;
    }
    update() {
      return 43;
    }
    dispose() {}
  }
  f.classes['core.hud.components.map.Map'] = MapView;
  Object.assign(f.api, {
    before: (t: any, k: string, fn: Function) => cleanups.push(hooks.add(t, k, 'before', fn)),
    after: (t: any, k: string, fn: Function) => cleanups.push(hooks.add(t, k, 'after', fn)),
    on: (n: string, fn: Function) => listeners.set(n, fn),
    defer: (fn: Function) => cleanups.push(fn),
  });
  installMapLiveMiniatures(f.api, game);
  const map = new MapView();
  assert.equal(map.load(), 42);
  assert.equal(map.mapBosses[0].layer.get_visible(), false);
  assert.equal(map.mapContainer.children.length, 2);
  assert.equal(map.update(), 43);
  const other = new MapView();
  other.g = {} as any;
  other.load();
  assert.equal(other.mapBosses[0].layer.get_visible(), true);
  map.dispose();
  assert.equal(map.mapBosses[0].layer.get_visible(), true);
  assert.equal(map.mapContainer.children.length, 1);
  map.load();
  cleanups.reverse().forEach((fn) => fn());
  assert.equal(map.mapBosses[0].layer.get_visible(), true);
});

test('map texture keys isolate source kind and scale while preserving native rasterization', () => {
  const hooks = new Hooks(),
    cleanups: Function[] = [],
    calls: any[] = [];
  const textures = {
    imageFromSprite(sprite: any, key: any) {
      calls.push([sprite, key]);
      return key;
    },
  };
  const map = { SCALE: 0.1 },
    sprite = {};
  class Body {
    body = { key: 'shared' };
    addOrbits() {
      return textures.imageFromSprite(sprite, this.body.key);
    }
  }
  class Elite extends Body {
    addOrbits() {
      return textures.imageFromSprite(sprite, this.body.key);
    }
  }
  const classes: any = {
    'textures.TextureManager': textures,
    'core.hud.components.map.Map': map,
    'core.hud.components.map.MapBodyBase': Body,
    'core.hud.components.map.MapEliteArea': Elite,
  };
  installMapTextureKeys({
    cls: (name: string) => classes[name],
    around: (t: any, k: string, fn: Function) => cleanups.push(hooks.add(t, k, 'around', fn)),
  } as any);
  assert.equal(new Body().addOrbits(), 'map-orbits:shared:0.1');
  assert.equal(new Elite().addOrbits(), 'map-elite:shared:0.1');
  map.SCALE = 0.02;
  assert.equal(new Body().addOrbits(), 'map-orbits:shared:0.02');
  assert.equal(textures.imageFromSprite(sprite, 'shared'), 'shared');
  assert.ok(
    calls.every(([value]) => value === sprite),
    'original native sprite is unchanged',
  );
  cleanups.reverse().forEach((fn) => fn());
  assert.equal(new Body().addOrbits(), 'shared');
});
