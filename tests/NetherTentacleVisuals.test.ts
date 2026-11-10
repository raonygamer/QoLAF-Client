import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NetherTentacleVisuals, isNetherTentacle } from '../src/rendering/NetherTentacleVisuals';
import { Display } from './fixtures/NativeGame';

function fixture() {
  let time = 100;
  const acquired: Line[] = [],
    released: Line[] = [];
  class Enemy {
    hasFaction(name: string) {
      return name === 'Nether';
    }
  }
  class Line extends Display {
    thickness = 0;
    end: number[] = [];
    args: any[] = [];
    init(...args: any[]) {
      this.args = args;
    }
    lineTo(x: number, y: number) {
      this.end = [x, y];
    }
    clear() {}
  }
  const style = {
    ai: 'instant',
    color: 0x4477ff,
    glowColor: 0x1122ff,
    thickness: 2,
    alpha: 0.8,
    frequency: 30,
  };
  const game: any = {
    canvas: new Display(),
    canvasEffects: new Display(),
    stage: {},
    dataManager: { loadKey: () => style },
    beamLinePool: {
      getLine() {
        const line = new Line();
        acquired.push(line);
        return line;
      },
      removeLine(line: Line) {
        released.push(line);
      },
    },
  };
  const api: any = {
    cls: (name: string) =>
      name === 'core.ship.EnemyShip' ? Enemy : name === 'starling.display.Sprite' ? Display : null,
  };
  const projectile: any = {
    unit: new Enemy(),
    weapon: { key: '0O4EOmZ-_USlz3RhlUCQ4Q', range: 375 },
    pos: { x: 10, y: 20 },
    rotation: 0,
    range: 375,
    ttl: 1,
  };
  const visuals = new NetherTentacleVisuals(api, game, () => time >>> 0);
  return { api, game, projectile, visuals, acquired, released, at: (now: number) => (time = now) };
}

test('tentacle snapshots survive projectile reuse and start their fade at the first displayed frame', () => {
  const { visuals, projectile, acquired, released, at } = fixture();
  visuals.addProjectile(projectile);
  assert.equal(acquired.length, 2);
  projectile.pos.x = 999;
  projectile.range = 0;
  projectile.ttl = 0;
  projectile.unit = null;
  at(400);
  visuals.draw();
  assert.equal(acquired[1].get_alpha(), 0.8);
  assert.deepEqual(acquired[1].end, [385, 20]);
  assert.equal(acquired[1].get_x(), 10);
  at(575);
  visuals.draw();
  assert.equal(acquired[1].get_alpha(), 0.4);
  at(700);
  visuals.draw();
  assert.equal(acquired[0].get_visible(), false);
  assert.equal(acquired[1].get_visible(), true);
  at(750);
  visuals.draw();
  assert.equal(released.length, 2);
  assert.equal(acquired[0].parent, null);
  visuals.dispose();
  visuals.dispose();
  assert.equal(released.length, 2);
});

test('pending tentacles expire without flashing after a long stall; elapsed time handles wraparound', () => {
  const first = fixture();
  first.visuals.addProjectile(first.projectile);
  first.at(601);
  first.visuals.draw();
  assert.equal(first.released.length, 2);
  assert.equal(first.acquired[1].get_visible(), false);
  first.visuals.dispose();
  const second = fixture();
  second.at(0xfffffff0);
  second.visuals.addProjectile(second.projectile);
  second.visuals.draw();
  second.at(0x20);
  second.visuals.draw();
  assert.ok(Math.abs(second.acquired[1].get_alpha() - (0.8 * (350 - 48)) / 350) < 1e-10);
  second.visuals.dispose();
  assert.equal(second.released.length, 2);
});

test('tentacles enforce source geometry/capacity limits and return partial allocations', () => {
  const { api, game, projectile, visuals, acquired, released } = fixture();
  assert.equal(isNetherTentacle(api, { ...projectile, unit: {} }), false);
  projectile.range = 100000;
  visuals.addProjectile(projectile);
  assert.equal(acquired.length, 0);
  projectile.range = 375;
  const getLine = game.beamLinePool.getLine;
  let calls = 0;
  game.beamLinePool.getLine = () => {
    if (++calls === 2) throw Error('allocation');
    return getLine();
  };
  visuals.addProjectile(projectile);
  assert.equal(released.length, 1);
  assert.equal(acquired[0].parent, null);
  game.beamLinePool.getLine = getLine;
  for (let i = 0; i < 129; i++) visuals.addProjectile(projectile);
  assert.equal(acquired.length, 257);
  visuals.dispose();
  assert.equal(released.length, 257);
});
