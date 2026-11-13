import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Display } from './fixtures/NativeGame';
import { BossSpawnCatalog } from '../src/map/BossSpawnCatalog';
import { BossSpawnLocation } from '../src/map/BossSpawnLocation';
import { BossSpawnAreaRing } from '../src/map/BossSpawnAreaRing';
import { BossSpawnMarker } from '../src/map/BossSpawnMarker';
import { BossSpawnMarkerManager, installBossSpawnMarkers } from '../src/map/BossSpawnMarkerManager';
import { MinibossSpawnHeat } from '../src/map/MinibossSpawnHeat';
import { NativeUI } from '../src/ui/NativeUI';
// @ts-expect-error actual host hooks
import { Hooks } from './fixtures/HostCore.js';

const description = {
  name: 'Hidden boss',
  detail: 'Miniboss spawn area',
  boss: false,
  innerRadius: 30,
  outerRadius: 100,
};

test('catalog keeps hidden anchors, physical heat options and exact Nether identities distinct', () => {
  const enemies = {
    a: { name: 'A', miniBoss: true },
    b: { name: 'B', miniBoss: true },
    ordinary: { name: 'C' },
  };
  const spawn = {
    hidden: true,
    enemy: 'a',
    enemy2: 'b',
    enemies: ['b'],
    innerRadius: '30',
    outerRadius: 10,
  };
  assert.deepEqual(BossSpawnCatalog.describeSpawner(spawn, enemies), {
    ...description,
    name: 'A',
    innerRadius: 30,
    outerRadius: 30,
  });
  assert.equal(BossSpawnCatalog.describeSpawnerHeat(spawn, enemies), null);
  assert.equal(BossSpawnCatalog.describeSpawner({ ...spawn, hidden: false }, enemies), null);
  assert.equal(
    BossSpawnCatalog.describeSpawner({ hidden: true, enemies: ['a'] }, enemies),
    null,
    'named hidden anchors use source primary/secondary fields',
  );
  const physical = {
    ...spawn,
    hidden: false,
    hasSecondSpawn: true,
    enemies: ['a', { key: 'b', name: 'fake', probability: 0 }, { name: 'A' }],
  };
  assert.equal(BossSpawnCatalog.describeSpawnerHeat(physical, enemies)?.name, 'A / B');
  assert.equal(
    BossSpawnCatalog.describeSpawnerHeat(
      { enemies: [...Array(512).fill('ordinary'), 'a'] },
      enemies,
    ),
    null,
  );
  assert.equal(
    BossSpawnCatalog.describeSpawnerHeat(
      { enemy: 'a', innerRadius: NaN, outerRadius: Infinity },
      enemies,
    )?.outerRadius,
    0,
  );
  assert.equal(
    BossSpawnCatalog.describeBoss({ boss: 'boss', active: false }, { boss: { name: 'Boss' } }),
    null,
  );
  assert.deepEqual(
    BossSpawnCatalog.describeBoss(
      { boss: 'boss', randomSpawnPoint: true, event: 'x' },
      { boss: { name: 'Boss' } },
    ),
    {
      name: 'Boss',
      detail: 'Random spawn anchor (event)',
      boss: true,
      innerRadius: 0,
      outerRadius: 0,
    },
  );
  const blob = 'qPt44KawmEuVs6VFL5vJ9g';
  assert.equal(
    BossSpawnCatalog.isNetherBlobSpawner({ hidden: true, enemies: [{ key: blob }] }),
    true,
  );
  assert.equal(BossSpawnCatalog.isNetherBlobSpawner({ hidden: false, enemy: blob }), false);
  assert.equal(BossSpawnCatalog.isNetherBlobSpawner({ hidden: true, enemy2: blob }), false);
  assert.equal(
    BossSpawnCatalog.isNetherBlobSpawner({ hidden: true, enemy2: blob, hasSecondSpawn: true }),
    true,
  );
});

test('locations follow native orbits, exact live boss bodies and pooled gravity anchors', () => {
  const anchor: any = { x: 10, y: 20 },
    gravity: any = {
      type: 'sun',
      obj: { bitmap: 'inkBvexWnU6i7SjD6pd7wA' },
      x: 100,
      y: 200,
      gravityDistance: 90000,
      gravityForce: 1,
    };
  const lives = new WeakMap(),
    life = (o: any) => lives.get(o) ?? 0;
  const game = { bossManager: { bosses: [{ parentBody: {}, alive: true }] } };
  const location = new BossSpawnLocation(anchor, { ...description, boss: true }, game, life);
  location.setGravityBody(gravity);
  assert.equal(location.gravityRadius, 300);
  assert.equal(location.gravityX, 100);
  assert.equal(location.bossAlive, false);
  game.bossManager.bosses.push({ parentBody: anchor, alive: true });
  assert.equal(location.bossAlive, true);
  (game.bossManager.bosses[1] as any).awaitingActivation = true;
  assert.equal(location.bossAlive, false);
  anchor.x = 44;
  assert.equal(location.x, 44);
  anchor.renderX = 45;
  assert.equal(location.x, 45);
  gravity.gravityForce = 0;
  assert.equal(location.gravityRadius, 0);
  gravity.gravityForce = 1;
  lives.set(gravity, 1);
  assert.equal(location.gravityRadius, 0);
  lives.set(anchor, 1);
  assert.equal(location.valid, false);
  location.dispose();
  assert.equal(location.valid, false);
});

function fixture() {
  const meshes: Mesh[] = [];
  class Vertices {
    count = 0;
    set_numVertices(value: number) {
      this.count = value;
    }
  }
  class Indices {
    quads: number[][] = [];
    addQuad(...values: number[]) {
      this.quads.push(values);
    }
  }
  class Mesh extends Display {
    points: number[][] = [];
    alphas: number[] = [];
    writes = 0;
    constructor(
      public vertices: Vertices,
      public indices: Indices,
    ) {
      super();
      meshes.push(this);
    }
    setVertexPosition(i: number, x: number, y: number) {
      this.points[i] = [x, y];
      this.writes++;
    }
    setVertexAlpha(i: number, alpha: number) {
      this.alphas[i] = alpha;
    }
    set_color(value: number) {
      this.values.color = value;
    }
  }
  class Sprite extends Display {
    globalToLocal(point: any, result: any) {
      result.x = point.x;
      result.y = point.y;
      return result;
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
  class Text extends Display {
    format = { set_color() {} };
    constructor(
      x: number,
      y: number,
      public text: string,
      size: number,
    ) {
      super();
      this.set_x(x);
      this.set_y(y);
      this.set_width((text.length * size) / 2);
      this.set_height(size);
    }
    get_format() {
      return this.format;
    }
    set_batchable(value: boolean) {
      this.values.batchable = value;
    }
  }
  class Quad extends Display {
    set_rotation(value: number) {
      this.values.rotation = value;
    }
    constructor(w: number, h: number, color: number) {
      super();
      this.set_width(w);
      this.set_height(h);
      this.values.color = color;
    }
  }
  const settings = { showBossSpawnMarkers: true, showMinibossSpawnHeatmap: true };
  const classes: any = {
    'starling.display.Sprite': Sprite,
    'starling.display.Quad': Quad,
    'starling.display.Mesh': Mesh,
    'starling.rendering.VertexData': Vertices,
    'starling.rendering.IndexData': Indices,
    'openfl.geom.Point': Point,
    'core.hud.components.TextBitmap': Text,
    'core.scene.SceneBase': { clientSettings: settings },
  };
  const api: any = { cls: (key: string) => classes[key] };
  return { api, ui: new NativeUI(api), meshes, classes, settings, Sprite };
}

test('heat geometry covers source disks, annuli and zero-width rings without rebuilding on zoom', () => {
  const f = fixture();
  for (const [inner, outer] of [
    [0, 100],
    [30, 100],
    [100, 100],
  ]) {
    const anchor = { x: 10, y: 20 };
    const location = new BossSpawnLocation(
      anchor,
      { ...description, innerRadius: inner, outerRadius: outer },
      null,
      () => 0,
    );
    const heat = new MinibossSpawnHeat(f.ui, location),
      mesh = f.meshes.at(-1)!;
    assert.equal(mesh.vertices.count, 160);
    assert.equal(mesh.indices.quads.length, 128);
    assert.equal(mesh.values.color, 0xe36b43);
    assert.equal(mesh.values.blendMode, 'normal');
    let area = 0;
    for (const [a, b, c, d] of mesh.indices.quads)
      for (const [i, j, k] of [
        [a, b, c],
        [b, d, c],
      ]) {
        const [p, q, r] = [mesh.points[i], mesh.points[j], mesh.points[k]];
        area += Math.abs((q[0] - p[0]) * (r[1] - p[1]) - (r[0] - p[0]) * (q[1] - p[1])) / 2;
      }
    const max = inner === outer ? 1.03 : 1,
      min = inner / outer;
    const expected = 16 * Math.sin((2 * Math.PI) / 32) * (max * max - min * min);
    assert.ok(Math.abs(area - expected) < 1e-10);
    assert.ok(mesh.alphas.slice(-32).every((alpha) => alpha === 0));
    if (inner) assert.ok(mesh.alphas.slice(0, 32).every((alpha) => alpha === 0));
    const writes = mesh.writes;
    heat.update(0.1);
    assert.equal(mesh.get_scaleX(), 10);
    assert.equal(mesh.get_x(), 1);
    anchor.x = 50;
    heat.update(2);
    assert.equal(mesh.get_x(), 100);
    assert.equal(mesh.writes, writes);
    heat.update(1, { left: 1000, right: 1100, top: 1000, bottom: 1100 });
    assert.equal(mesh.get_visible(), false);
    heat.dispose();
    assert.equal(mesh.disposed, true);
    assert.equal(location.valid, true, 'borrowed anchor remains owned by manager');
  }
  for (const [inner, outer] of [
    [0, 0],
    [-1, 1],
    [10, 1],
    [0, NaN],
  ]) {
    const location = new BossSpawnLocation(
      { x: 0, y: 0 },
      { ...description, innerRadius: inner, outerRadius: outer },
      null,
      () => 0,
    );
    const heat = new MinibossSpawnHeat(f.ui, location);
    heat.update();
    assert.equal(heat.node.get_visible(), false);
    heat.dispose();
  }
});

test('dashed source rings cache geometry and markers hide only for their own active boss', () => {
  const f = fixture(),
    ring = new BossSpawnAreaRing(f.ui, 0xff8a72),
    mesh = f.meshes[0];
  ring.setGeometry(100, 2);
  const writes = mesh.writes;
  ring.setGeometry(100, 2);
  assert.equal(mesh.writes, writes);
  assert.equal(mesh.vertices.count, 384);
  assert.equal(mesh.indices.quads.length, 96);
  assert.deepEqual(mesh.points[0], [99, 0]);
  assert.deepEqual(mesh.points[1], [101, 0]);
  assert.ok(
    Math.abs(Math.atan2(mesh.points[2][1], mesh.points[2][0]) - (0.65 * Math.PI * 2) / 96) < 1e-10,
  );
  const anchor = { x: 10, y: 20 },
    game = { bossManager: { bosses: [] as any[] } };
  const location = new BossSpawnLocation(anchor, { ...description, boss: true }, game, () => 0);
  const marker = new BossSpawnMarker(f.ui, location);
  marker.update(1, 2);
  assert.equal(marker.node.get_visible(), true);
  assert.equal(marker.node.get_x(), 10);
  assert.equal(marker.node.getChildAt(marker.node.get_numChildren() - 1).get_scaleX(), 2);
  game.bossManager.bosses.push({ alive: true, parentBody: anchor });
  marker.update(1);
  assert.equal(marker.node.get_visible(), false);
  game.bossManager.bosses[0].alive = false;
  marker.update(1);
  assert.equal(marker.node.get_visible(), true);
  marker.dispose();
  assert.equal((marker.node as unknown as Display).disposed, true);
});

test('world and map hooks share configured locations but own and dispose separate displays', () => {
  const f = fixture(),
    hooks = new Hooks(),
    cleanups: Function[] = [],
    listeners = new Map();
  Object.assign(f.api, {
    before: (t: any, k: string, fn: Function) => cleanups.push(hooks.add(t, k, 'before', fn)),
    after: (t: any, k: string, fn: Function) => cleanups.push(hooks.add(t, k, 'after', fn)),
    on: (name: string, fn: Function) => listeners.set(name, fn),
    defer: (fn: Function) => cleanups.push(fn),
  });
  class ObjectBase {
    x = 50;
    y = 50;
    reset() {
      this.x = 0;
      this.y = 0;
    }
  }
  const hidden = Object.assign(new ObjectBase(), {
    obj: { hidden: true, enemy: 'a', outerRadius: 100 },
  });
  const physical = Object.assign(new ObjectBase(), {
    obj: { hidden: false, enemies: [{ key: 'a' }], outerRadius: 200 },
  });
  const body = Object.assign(new ObjectBase(), {
    obj: { boss: 'b' },
    spawners: [hidden, physical],
  });
  const game: any = {
    initSolarSystemComplete: false,
    canvasBodies: new f.Sprite(),
    canvas: new f.Sprite(),
    stage: { stageWidth: 800, stageHeight: 600 },
    bodyManager: { bodies: [body] },
    bossManager: { bosses: [] },
    dataManager: {
      loadTable: (name: string) =>
        name === 'Bosses' ? { b: { name: 'Boss' } } : { a: { miniBoss: true, name: 'Mini' } },
    },
  };
  class MapView extends f.Sprite {
    static SCALE = 0.1;
    g = game;
    mapContainer = new f.Sprite();
    load() {
      this.addChild(this.mapContainer);
      this.mapContainer.set_mask(new Display());
      return 77;
    }
    update() {
      return 88;
    }
    dispose() {
      super.dispose();
    }
  }
  Object.assign(f.classes, {
    'core.GameObject': ObjectBase,
    'core.hud.components.map.Map': MapView,
  });
  installBossSpawnMarkers(f.api, game);
  const frame = () => listeners.get('frame')({ game });
  frame();
  assert.equal(game.canvasBodies.children.length, 0);
  game.initSolarSystemComplete = true;
  frame();
  assert.equal(game.canvasBodies.children.length, 2);
  const [heatLayer, markerLayer] = game.canvasBodies.children;
  assert.equal(heatLayer.children.length, 1);
  assert.equal(markerLayer.children.length, 2);
  const map = new MapView();
  assert.equal(map.load(), 77);
  assert.equal(map.update(), 88);
  assert.equal(map.mapContainer.children.length, 2);
  assert.equal(map.children.length, 2, 'map plus heat legend');
  f.settings.showBossSpawnMarkers = false;
  f.settings.showMinibossSpawnHeatmap = false;
  frame();
  map.update();
  assert.equal(markerLayer.get_visible(), false);
  assert.equal(heatLayer.get_visible(), false);
  assert.equal(map.mapContainer.children[0].get_visible(), false);
  f.settings.showBossSpawnMarkers = true;
  frame();
  assert.equal(markerLayer.get_visible(), true);
  hidden.reset();
  frame();
  assert.equal(markerLayer.children[1].get_visible(), false, 'anchor reuse invalidates marker');
  const mapLayer = map.mapContainer.children[1];
  map.dispose();
  assert.equal(mapLayer.disposed, true);
  cleanups.reverse().forEach((fn) => fn());
  assert.equal(game.canvasBodies.children.length, 0);
});
