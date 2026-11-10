import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RadarTelemetry } from '../src/UI/RadarTelemetry';
import { defaults } from '../src/Settings/Settings';

class Node {
  children: Node[] = [];
  text = '';
  x = 0;
  y = 0;
  visible = true;
  set_touchable() {}
  set_alpha() {}
  addChild(node: Node) {
    this.children.push(node);
  }
  set_text(text: string) {
    this.text = text;
  }
  set_x(x: number) {
    this.x = x;
  }
  set_y(y: number) {
    this.y = y;
  }
  set_visible(visible: boolean) {
    this.visible = visible;
  }
}

test('radar source wording, placement, timing, service room and ship lifecycle', () => {
  const ui: any = {
    api: { cls: () => undefined },
    sprite: () => new Node(),
    text: () => new Node(),
    dispose() {},
  };
  const ship = { alive: true, landed: false, lifecycleId: 1, course: { speed: { x: 10, y: 0 } } };
  const game = {
    me: { ship },
    clock: { latency: 21.6 },
    hud: { radar: { x: 8, y: 600, visible: true } },
    serviceConnection: { get_connected: () => true, get_roomId: () => 'service-test' },
  };
  const config = { ...defaults };
  const telemetry = new RadarTelemetry(ui, game, config);
  telemetry.update(0.1);
  const node = telemetry.node as Node;
  assert.deepEqual(
    node.children.filter((label) => label.visible).map((label) => label.text),
    ['Frames/sec: --', 'Latency: 22 ms', 'Current speed: 360 km/h', 'Service: service-test'],
  );
  assert.equal(node.x, 8);
  assert.equal(node.y, 600 - 60 - 18);
  ship.course.speed.x = 0;
  ship.lifecycleId++;
  telemetry.update(0.1);
  assert.equal(
    node.children[2].text,
    'Current speed: 0 km/h',
    'new lifecycle cannot inherit the old speed average',
  );
  config.show_radar_latency = false;
  telemetry.update(0.1);
  assert.equal(node.y, 600 - 45 - 18);
  assert.equal(node.children[3].visible, false);
  game.hud.radar.visible = false;
  telemetry.update(0.1);
  assert.equal(node.visible, false);
});

test('DPS occupies the original third radar row and responds to its source setting', () => {
  const ui: any = {
    api: { cls: () => undefined },
    sprite: () => new Node(),
    text: () => new Node(),
    dispose() {},
  };
  const game = {
    me: { ship: { alive: true, course: { speed: { x: 0, y: 0 } } } },
    clock: { latency: 10 },
    hud: { radar: { x: 8, y: 600, visible: true } },
  };
  let partial = true;
  const damage: any = {
    now: () => 1000,
    estimate: {
      perSecond: () => 123.6,
      isPartial: () => partial,
    },
  };
  const config = { ...defaults };
  const telemetry = new RadarTelemetry(ui, game, config, damage);
  telemetry.update(0.1);
  const node = telemetry.node as Node;
  assert.equal(node.children[2].text, 'Current DPS: ~124 (partial)');
  assert.equal(node.y, 600 - 75 - 18);
  partial = false;
  telemetry.update(0.1);
  assert.equal(node.children[2].text, 'Current DPS: ~124');
  config.show_radar_dps = false;
  telemetry.update(0.1);
  assert.equal(node.children[2].text, 'Current speed: 0 km/h');
  assert.equal(node.children[4].visible, false);
  assert.equal(node.y, 600 - 60 - 18);
});
