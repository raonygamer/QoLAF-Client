import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import { bindGameClasses } from '../src/game/Bindings';
import { installTeleportAnimation } from '../src/ship/TeleportScaleAnimation';
// @ts-expect-error actual host hook dispatcher
import { Hooks } from './fixtures/HostCore.js';

function fixture(animate = false) {
  const timers: Array<{ delay: number; callback: () => void; killed: boolean; kill(): void }> = [];
  const cleanups: Array<() => void> = [];
  const logs: unknown[][] = [];
  let failEffects = false;
  class Heading {
    pos = { x: 0, y: 0 };
    parseMessage(message: Message, index: number) {
      this.pos = { x: message.getNumber(index), y: message.getNumber(index + 1) };
      return index + 2;
    }
  }
  class Message {
    constructor(
      readonly deadline = 2000,
      readonly destination = 100,
    ) {}
    getString() {
      return 'player';
    }
    getNumber(index: number) {
      return [0, this.deadline, 10, 20, this.destination, 200][index];
    }
  }
  class Emitter {
    killed = 0;
    killEmitter() {
      this.killed++;
      if (failEffects) throw Error('effect failure');
    }
    dispose() {}
  }
  const markers: Emitter[] = [];
  const Tween = {
    delayedCall(delay: number, callback: () => void) {
      const timer = {
        delay,
        callback,
        killed: false,
        kill() {
          this.killed = true;
        },
      };
      timers.push(timer);
      return timer;
    },
    to() {},
    killTweensOf() {},
  };
  class Ship {
    g!: Scene;
    player!: Player;
    alive = true;
    isTeleporting = false;
    channelingEnd = 0;
    generation = 1;
    _mc = null;
    course = new Heading();
    weapon = {
      fire: true,
      projectiles: [{ ttl: 500 }],
      get_fire() {
        return this.fire;
      },
      set_fire(value: boolean) {
        this.fire = value;
      },
    };
    weapons = [this.weapon];
    get_weapon() {
      return this.weapon;
    }
    get_lifecycleId() {
      return this.generation;
    }
    get_landed() {
      return false;
    }
    get_radius() {
      return 5;
    }
    get_pos() {
      return this.course.pos;
    }
    set_course(course: Heading) {
      this.course = course;
    }
    reset() {
      this.generation++;
    }
    destroy() {
      this.alive = false;
    }
    land() {}
    switchTexturesByObj() {}
  }
  class Player {
    ship = new Ship();
    isLanded = false;
  }
  class Manager {
    constructor(readonly g: Scene) {}
    get_playersById() {
      return { h: { player: this.g.player } };
    }
    m_teleportToPosition(_message: Message) {
      throw Error('unexpected native handler');
    }
  }
  class Scene {
    time = 1000;
    leaving = false;
    player = new Player();
    playerManager = new Manager(this);
    focuses = 0;
    cleaned = 0;
    emitterManager = {
      clean: () => {
        this.cleaned++;
        if (failEffects) throw Error('effect failure');
      },
    };
    constructor() {
      this.player.ship.g = this;
      this.player.ship.player = this.player;
    }
    get_isLeaving() {
      return this.leaving;
    }
    get_me() {
      return this.player;
    }
    focusGameObject() {
      this.focuses++;
    }
    exit() {
      this.leaving = true;
    }
  }
  const classes: Record<string, object> = {
    'core.player.PlayerManager': Manager,
    'core.ship.PlayerShip': Ship,
    'core.scene.Game': Scene,
    'core.player.Player': Player,
    'movement.Heading': Heading,
    'com.greensock.TweenMax': Tween,
    'core.particle.Emitter': Emitter,
    'core.particle.EmitterFactory': {
      create(key: string) {
        if (failEffects) throw Error('effect failure');
        if (key !== '5BSaDIEYj0mEuVkMVp1JGw') return [];
        const marker = new Emitter();
        markers.push(marker);
        return [marker];
      },
    },
    'core.scene.SceneBase': { clientSettings: { animateTeleportScaling: animate } },
  };
  const hooks = new Hooks((error: unknown) => {
    throw error;
  });
  const hook =
    (kind: string) => (target: object, name: string, callback: (...args: never[]) => unknown) => {
      const off = hooks.add(target, name, kind, callback);
      cleanups.push(off);
      return off;
    };
  const api = {
    cls: (name: string) => classes[name] ?? class {},
    before: hook('before'),
    around: hook('around'),
    defer: (off: () => void) => cleanups.push(off),
    log: (...values: unknown[]) => logs.push(values),
  } as unknown as API;
  bindGameClasses(api);
  installTeleportAnimation(api);
  const game = new Scene();
  return {
    game,
    timers,
    markers,
    logs,
    Message,
    Ship,
    Manager,
    failEffects: () => {
      failEffects = true;
    },
    close: () => cleanups.reverse().forEach((off) => off()),
  };
}

test('teleport honors channel and transition deadlines despite presentation failures', () => {
  for (const animate of [false, true]) {
    const f = fixture(animate);
    try {
      const ship = f.game.player.ship;
      f.game.playerManager.m_teleportToPosition(new f.Message());
      assert.equal(f.logs.length, 0);
      assert.equal(ship.weapon.fire, false);
      assert.equal(ship.weapon.projectiles[0].ttl, 0);
      assert.deepEqual(ship.get_pos(), { x: 10, y: 20 });
      assert.equal(f.timers[0].delay, 1);
      f.failEffects();
      f.timers[0].callback();
      assert.equal(f.timers[1].delay, animate ? 0.12 : 0.24);
      f.timers[1].callback();
      assert.deepEqual(ship.get_pos(), { x: 100, y: 200 });
      assert.equal(ship.isTeleporting, false);
      assert.equal(f.game.focuses, 1);
      f.timers[1].callback();
      assert.equal(f.game.focuses, 1);
    } finally {
      f.close();
    }
  }
});

test('replaced and reset teleport timers cannot move reused ships', () => {
  const f = fixture();
  try {
    const ship = f.game.player.ship;
    f.game.playerManager.m_teleportToPosition(new f.Message());
    const stale = f.timers[0];
    f.game.playerManager.m_teleportToPosition(new f.Message(2000, 300));
    assert.equal(stale.killed, true);
    stale.callback();
    assert.equal(f.timers.length, 2);
    f.timers[1].callback();
    ship.reset();
    assert.equal(f.timers[2].killed, true);
    f.timers[2].callback();
    assert.deepEqual(ship.get_pos(), { x: 10, y: 20 });
    assert.equal(f.game.focuses, 0);
  } finally {
    f.close();
  }
});

test('overdue channels retain the full transition and stale ownership cancels arrival', () => {
  for (const invalidate of ['leave', 'ship', 'manager', 'land', 'lifecycle'] as const) {
    const f = fixture();
    try {
      const ship = f.game.player.ship;
      f.game.playerManager.m_teleportToPosition(new f.Message(500));
      assert.equal(f.timers.length, 1);
      assert.equal(f.timers[0].delay, 0.24);
      if (invalidate === 'leave') f.game.exit();
      else if (invalidate === 'ship') f.game.player.ship = new f.Ship();
      else if (invalidate === 'manager') f.game.playerManager = new f.Manager(f.game);
      else if (invalidate === 'land') f.game.player.isLanded = true;
      else ship.generation++;
      f.timers[0].callback();
      assert.deepEqual(ship.get_pos(), { x: 10, y: 20 });
      assert.equal(f.game.focuses, 0);
    } finally {
      f.close();
    }
  }
});

test('pooled markers are not killed by an old teleport callback', () => {
  const f = fixture();
  try {
    f.game.playerManager.m_teleportToPosition(new f.Message());
    assert.equal(f.markers.length, 1);
    f.markers[0].dispose();
    f.timers[0].callback();
    f.timers[1].callback();
    assert.equal(f.markers[0].killed, 0);
    assert.deepEqual(f.game.player.ship.get_pos(), { x: 100, y: 200 });
  } finally {
    f.close();
  }
});
