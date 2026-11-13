import type { API } from '../src/api/Types';
import { registerServicePool } from '../src/service/ServicePools';
import type { ServiceConnectionPool } from '../src/service/ServiceConnectionPool';
import { bindGameClasses, type GameScene } from '../src/game/Bindings';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RadarTelemetry } from '../src/ui/RadarTelemetry';
import { defaults } from '../src/settings/Settings';

function bindRadarFixtures(): void {
  bindGameClasses({
    cls: (name: string) =>
      name === 'textures.TextureLocator'
        ? { getService: () => ({ getTextureMainByTextureName: () => null }) }
        : {},
  } as unknown as API);
}

class Node {
  children: Node[] = [];
  text = '';
  x = 0;
  y = 0;
  visible = true;
  width = 420;
  height = 15;
  set_batchable() {}
  set_wordWrap() {}
  set_autoSize() {}
  get_text() {
    return this.text;
  }
  get_width() {
    return this.width;
  }
  get_height() {
    return this.height;
  }
  set_width(value: number) {
    this.width = value;
  }
  set_height(value: number) {
    this.height = value;
  }
  get_textBounds() {
    return { height: Math.ceil((this.text.length * 5) / this.width) * 15 };
  }
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
    place: (node: Node, x: number, y: number) => {
      node.set_x(x);
      node.set_y(y);
    },
    dispose() {},
  };
  const ship = {
    alive: true,
    get_pos: () => ({ x: 0, y: 0 }),
    get_landed: () => false,
    generation: 1,
    get_lifecycleId() {
      return this.generation;
    },
    course: { speed: { x: 10, y: 0 } },
    get_course() {
      return this.course;
    },
  };
  const game = {
    get_isLeaving: () => false,
    get_connected: () => true,
    me: { ship },
    get_me() {
      return this.me;
    },
    get_stage() {
      return null;
    },
    clock: { latency: 21.6 },
    hud: {
      radar: {
        x: 8,
        y: 600,
        visible: true,
        get_x() {
          return this.x;
        },
        get_y() {
          return this.y;
        },
        get_visible() {
          return this.visible;
        },
      },
    },
    serviceConnection: { get_connected: () => true, get_roomId: () => 'service-test' },
  };
  const config = { ...defaults };
  bindRadarFixtures();
  const telemetry = new RadarTelemetry(ui, game as unknown as GameScene, config);
  telemetry.update(0.1);
  const node = telemetry.node as unknown as Node;
  const labels = node.children.slice(1, 7);
  assert.deepEqual(
    labels.filter((label) => label.visible).map((label) => label.text),
    [
      'Frames/sec: --',
      'Latency: 22 ms',
      'Current speed: 360 km/h',
      'Service: service-test',
      'Service IPC: disconnected',
    ],
  );
  assert.equal(node.x, 8);
  assert.equal(node.y, 600 - 75 - 18);
  ship.course.speed.x = 0;
  ship.generation++;
  telemetry.update(0.1);
  assert.equal(
    labels[3].text,
    'Current speed: 0 km/h',
    'new lifecycle cannot inherit the old speed average',
  );
  config.show_radar_latency = false;
  telemetry.update(0.1);
  assert.equal(node.y, 600 - 60 - 18);
  assert.equal(labels[1].visible, false);
  game.hud.radar.visible = false;
  telemetry.update(0.1);
  assert.equal(node.visible, false);
});

test('DPS occupies the original third radar row and responds to its source setting', () => {
  const ui: any = {
    api: { cls: () => undefined },
    sprite: () => new Node(),
    text: () => new Node(),
    place: (node: Node, x: number, y: number) => {
      node.set_x(x);
      node.set_y(y);
    },
    dispose() {},
  };
  const game = {
    get_isLeaving: () => false,
    get_connected: () => true,
    me: {
      ship: {
        alive: true,
        get_pos: () => ({ x: 0, y: 0 }),
        get_landed: () => false,
        course: { speed: { x: 0, y: 0 } },
        get_course() {
          return this.course;
        },
      },
    },
    get_me() {
      return this.me;
    },
    get_stage() {
      return null;
    },
    clock: { latency: 10 },
    hud: {
      radar: {
        x: 8,
        y: 600,
        visible: true,
        get_x() {
          return this.x;
        },
        get_y() {
          return this.y;
        },
        get_visible() {
          return this.visible;
        },
      },
    },
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
  bindRadarFixtures();
  const telemetry = new RadarTelemetry(ui, game as unknown as GameScene, config, damage);
  telemetry.update(0.1);
  const node = telemetry.node as unknown as Node;
  const labels = node.children.slice(1, 7);
  assert.equal(labels[2].text, 'Current DPS: ~124 (partial)');
  assert.equal(node.y, 600 - 90 - 18);
  partial = false;
  telemetry.update(0.1);
  assert.equal(labels[2].text, 'Current DPS: ~124');
  config.show_radar_dps = false;
  telemetry.update(0.1);
  assert.equal(labels[3].text, 'Current speed: 0 km/h');
  assert.equal(labels[2].visible, false);
  assert.equal(node.y, 600 - 75 - 18);
});

test('service rows include auxiliary rooms and wrap before positioning the boss block', () => {
  const ui = {
    api: { cls: () => undefined },
    sprite: () => new Node(),
    text: () => new Node(),
    place: (node: Node, x: number, y: number) => {
      node.set_x(x);
      node.set_y(y);
    },
    dispose() {},
  };
  const stage = {
    stageWidth: 116,
    get_stageWidth() {
      return this.stageWidth;
    },
  };
  const game = {
    get_isLeaving: () => false,
    get_connected: () => true,
    hud: {
      radar: {
        x: 8,
        y: 600,
        visible: true,
        get_x() {
          return this.x;
        },
        get_y() {
          return this.y;
        },
        get_visible() {
          return this.visible;
        },
      },
    },
    stage,
    get_me() {
      return null;
    },
    get_stage() {
      return stage;
    },
    serviceConnection: { get_connected: () => true, get_roomId: () => 'primary' },
  } as unknown as GameScene;
  let rooms = ['Service-1409_1', 'Service-1409_2'];
  const release = registerServicePool(game, {
    connectedRoomIds: (owner: GameScene) => {
      assert.equal(owner, game);
      return rooms;
    },
  } as unknown as ServiceConnectionPool);
  const config = {
    ...defaults,
    show_radar_fps: false,
    show_radar_latency: false,
    show_radar_dps: false,
    show_radar_speed: false,
    show_radar_service: true,
  };
  bindRadarFixtures();
  const telemetry = new RadarTelemetry(
    ui as unknown as import('../src/ui/NativeUI').NativeUI,
    game,
    config,
  );
  try {
    telemetry.update(0.1);
    const node = telemetry.node as unknown as Node;
    const labels = node.children.slice(1, 7);
    assert.equal(labels[4].text, 'Service: primary / Service-1409_1 / Service-1409_2');
    assert.equal(labels[5].text, 'Service IPC: disconnected');
    assert.equal(labels[4].width, 100);
    assert.equal(labels[4].height, 45);
    assert.equal(labels[5].y, 45);
    assert.equal(node.children[7].y, 75);
    assert.equal(node.y, 600 - 75 - 18);
    rooms = [];
    telemetry.update(0.1);
    assert.equal(labels[4].height, 15);
    assert.equal(labels[5].y, 15);
    config.show_radar_service = false;
    telemetry.update(0.1);
    assert.equal(labels[4].visible, false);
    assert.equal(labels[5].visible, false);
    assert.equal(node.visible, false);
  } finally {
    telemetry.dispose();
    release();
  }
});
