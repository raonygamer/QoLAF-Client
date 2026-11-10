import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Display } from './fixtures/NativeGame';
import {
  XhersixTorpedoWarningBatch,
  installTorpedoWarnings,
} from '../src/projectile/XhersixTorpedoWarningBatch';
import { xhersixTorpedoWeaponKey } from '../src/projectile/XhersixTorpedoCue';
// @ts-expect-error actual host hooks
import { Hooks } from './fixtures/HostCore.js';

test('source torpedo collision mesh uses contact radius, separate opacity edges and bounded batching', () => {
  let mesh: Mesh;
  class Vertices {
    count = 0;
    set_numVertices(count: number) {
      this.count = count;
    }
  }
  class Indices {
    triangles: number[][] = [];
    quads: number[][] = [];
    addTriangle(...args: number[]) {
      this.triangles.push(args);
    }
    addQuad(...args: number[]) {
      this.quads.push(args);
    }
  }
  class Mesh extends Display {
    points: number[][] = [];
    alphas: number[] = [];
    color = 0;
    constructor(
      public vertices: Vertices,
      public indices: Indices,
    ) {
      super();
      mesh = this;
    }
    set_color(value: number) {
      this.color = value;
    }
    setVertexPosition(index: number, x: number, y: number) {
      this.points[index] = [x, y];
    }
    setVertexAlpha(index: number, alpha: number) {
      this.alphas[index] = alpha;
    }
  }
  class Batch extends Display {
    items: any[] = [];
    clear() {
      this.items = [];
    }
    canAddMesh() {
      return this.items.length < 1;
    }
    addMesh(ring: Mesh) {
      this.items.push({ x: ring.get_x(), y: ring.get_y(), radius: ring.get_scaleX() });
    }
  }
  const classes: any = {
    'starling.display.MeshBatch': Batch,
    'starling.display.Mesh': Mesh,
    'starling.rendering.VertexData': Vertices,
    'starling.rendering.IndexData': Indices,
  };
  const batch = new XhersixTorpedoWarningBatch({ cls: (name: string) => classes[name] } as any);
  new Display().addChild(batch.node as any);
  assert.equal(mesh!.vertices.count, 196);
  assert.equal(mesh!.indices.triangles.length, 64);
  assert.equal(mesh!.indices.quads.length, 64);
  assert.equal(mesh!.color, 0xff3030);
  assert.equal(mesh!.alphas[0], 0.12);
  for (let i = 0; i <= 64; i++) {
    const first = 1 + i * 3;
    assert.ok(Math.abs(Math.hypot(...mesh!.points[first]) - 0.92) < 1e-12);
    assert.ok(Math.abs(Math.hypot(...mesh!.points[first + 1]) - 1) < 1e-12);
    assert.deepEqual(mesh!.points[first], mesh!.points[first + 2]);
    assert.deepEqual(mesh!.alphas.slice(first, first + 3), [0.12, 0.8, 0.8]);
  }
  const clip = new Display();
  clip.set_x(51);
  clip.set_y(92);
  const projectile: any = {
    alive: true,
    isEnemy: true,
    isVisible: true,
    weapon: { key: xhersixTorpedoWeaponKey, dmgRadius: 120 },
    collisionRadius: 25,
    get_movieClip: () => clip,
  };
  const snapshot = { ...projectile };
  batch.addProjectile(projectile);
  batch.addProjectile({ ...projectile, collisionRadius: 37 });
  assert.deepEqual(
    (batch.node as any).items,
    [{ x: 51, y: 92, radius: 25 }],
    'contact radius, not explosion area; batch capacity respected',
  );
  assert.deepEqual(projectile, snapshot, 'no projectile mutation');
  batch.clear();
  batch.addProjectile({ ...projectile, collisionRadius: 37 });
  assert.equal((batch.node as any).items[0].radius, 37, 'runtime changes remain authoritative');
  for (const override of [
    { alive: false },
    { isEnemy: false },
    { isVisible: false },
    { weapon: { key: 'other' } },
    { collisionRadius: NaN },
    { collisionRadius: Infinity },
    { collisionRadius: 0 },
    { get_movieClip: () => null },
  ]) {
    batch.clear();
    batch.addProjectile({ ...projectile, ...override });
    assert.equal((batch.node as any).items.length, 0);
  }
  batch.dispose();
  assert.equal(mesh!.disposed, true);
  assert.equal(batch.node.disposed, true);
});

test('warning hook observes native drawing exactly once and clears on settings changes', () => {
  const hooks = new Hooks(),
    cleanups: Function[] = [];
  let enabled = true,
    draws = 0,
    created = 0,
    disposed = 0;
  const items: any[] = [];
  const game: any = { canvasProjectiles: new Display() };
  class Projectile {
    g = game;
    alive = true;
    isEnemy = true;
    isVisible = true;
    isAddedToCanvas = true;
    weapon = { key: xhersixTorpedoWeaponKey };
    collisionRadius = 25;
    clip = new Display();
    get_movieClip() {
      return this.clip;
    }
    draw() {
      draws++;
      this.clip.set_x(-4);
      this.clip.set_y(6);
      return 'native draw';
    }
  }
  const projectile = new Projectile();
  class Manager {
    update() {
      projectile.draw();
      return 'native update';
    }
  }
  game.projectileManager = new Manager();
  const classes: any = {
    'core.projectile.ProjectileManager': Manager,
    'core.projectile.Projectile': Projectile,
    'core.scene.SceneBase': {
      clientSettings: {
        get showXhersixTorpedoWarnings() {
          return enabled;
        },
      },
    },
  };
  const node = new Display();
  installTorpedoWarnings(
    {
      cls: (name: string) => classes[name],
      defer: (fn: Function) => cleanups.push(fn),
      around: (target: any, name: string, fn: Function) =>
        cleanups.push(hooks.add(target, name, 'around', fn)),
      after: (target: any, name: string, fn: Function) =>
        cleanups.push(hooks.add(target, name, 'after', fn)),
    } as any,
    game,
    () => {
      created++;
      return {
        node,
        clear: () => {
          items.length = 0;
        },
        addProjectile: (p: Projectile) => items.push([p.clip.get_x(), p.clip.get_y()]),
        dispose: () => disposed++,
      } as any;
    },
  );
  assert.equal(game.projectileManager.update(), 'native update');
  assert.equal(draws, 1);
  assert.equal(created, 1);
  assert.deepEqual(items, [[-4, 6]]);
  projectile.draw();
  assert.equal(items.length, 1, 'outside manager draw does not append stale geometry');
  enabled = false;
  game.projectileManager.update();
  assert.deepEqual(items, []);
  enabled = true;
  projectile.isAddedToCanvas = false;
  game.projectileManager.update();
  assert.deepEqual(items, []);
  projectile.isAddedToCanvas = true;
  game.projectileManager.update();
  assert.equal(items.length, 1);
  assert.equal(created, 1);
  cleanups.reverse().forEach((fn) => fn());
  assert.equal(disposed, 1);
  assert.equal(game.projectileManager.update(), 'native update');
});
