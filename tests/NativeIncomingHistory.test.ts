import { bindGameClasses, type GameScene } from '../src/game/Bindings';
// @ts-expect-error real host dispatcher
import { Hooks as ContactHooks } from './fixtures/HostCore.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import type { API, Raw } from '../src/api/Types';
import { installNativeIncomingHistory as installHistory } from '../src/telemetry/NativeIncomingHistory';

function installNativeIncomingHistory(api: API, game: unknown): void {
  class ContactFixture {
    get_pos() {
      return { x: 0, y: 0 };
    }
    enter() {}
    execute() {}
    shoot() {}
    destroy() {}
    explode() {}
  }
  const hooks = new ContactHooks();
  const completeAPI = {
    ...api,
    after:
      api.after ??
      ((target: object, key: string, callback: Function) => {
        const off = hooks.add(target, key, 'after', callback);
        api.defer(off);
        return off;
      }),
    around:
      api.around ??
      ((target: object, key: string, callback: Function) => {
        const off = hooks.add(target, key, 'around', callback);
        api.defer(off);
        return off;
      }),
  } as API;
  const fallback = new Map<string, typeof ContactFixture>();
  bindGameClasses({
    ...completeAPI,
    cls: (name: string) => {
      if (!fallback.has(name)) fallback.set(name, class extends ContactFixture {});
      return api.cls(name) ?? fallback.get(name);
    },
  });
  installHistory(completeAPI, game as GameScene);
}

test('native wall attribution preserves explicit causes and clears evidence on landing or pooled reuse', () => {
  class Player {
    g: any;
    ship: any;
    isMe = true;
    isLanded = false;
    isWarpJumping = false;
    name = 'Pilot';
    get_name() {
      return this.name;
    }
    get_isWarpJumping() {
      return false;
    }
    land() {
      this.isLanded = true;
    }
    startLanded() {
      this.isLanded = true;
    }
  }
  class Ship {
    g: any;
    player: any;
    alive = true;
    pos = { x: -200, y: 0 };
    collisionRadius = 10;
    get_pos() {
      return this.pos;
    }
    reset() {}
  }
  const player = new Player() as Player & Raw;
  const ship = new Ship();
  player.ship = ship;
  ship.player = player;
  const game: any = {
    playerManager: { me: player },
    isLeaving: false,
    get_isLeaving() {
      return this.isLeaving;
    },
    get_me: () => player,
  };
  player.g = ship.g = game;
  const classes: Raw = { 'core.player.Player': Player, 'core.ship.PlayerShip': Ship };
  const releases: Function[] = [];
  const api = {
    cls: (name: string) => classes[name],
    defer: (fn: Function) => {
      releases.push(fn);
    },
    before(target: Raw, method: string, hook: Function) {
      const original = target[method];
      target[method] = function (this: Raw, ...args: unknown[]) {
        hook.apply(this, args);
        return original.apply(this, args);
      };
      releases.push(() => {
        target[method] = original;
      });
    },
  } as unknown as API;
  installNativeIncomingHistory(api, game);
  player.recordIncomingWeaponHit({
    unit: { get_type: () => 'enemy', get_name: () => 'Enemy lvl 20' },
    get_name: () => 'Laser',
    dmg: { type: 0 },
  });
  assert.equal(player.deathMessageWeapon('Enemy lvl 20', '', 0), 'Laser');
  player.recordIncomingWeaponHit({ unit: null });
  assert.equal(player.deathMessageWeapon('Enemy lvl 20', '', 0), 'Laser');
  const record = () => player.recordDeathLineContact(0, -100, 0, 100, -200, 0);
  record();
  assert.equal(player.deathMessageWeapon('Pilot', 'suicide', 0), 'Death Line');
  assert.equal(player.deathMessageWeapon('Enemy', 'Laser', 0), 'Laser');
  assert.equal(player.deathMessageWeapon('Pilot', 'sun', 0), 'sun');
  ship.pos.x = -190;
  assert.equal(player.deathMessageWeapon('Pilot', 'suicide', 0), 'suicide');
  ship.pos.x = -200;
  player.land();
  player.isLanded = false;
  assert.equal(player.deathMessageWeapon('Pilot', 'suicide', 0), 'suicide');
  record();
  ship.reset();
  assert.equal(player.deathMessageWeapon('Pilot', 'suicide', 0), 'suicide');
  record();
  player.ship = new Ship();
  player.ship.pos.x = -200;
  assert.equal(player.deathMessageWeapon('Pilot', 'suicide', 0), 'suicide');
  for (const release of releases.reverse()) release();
  assert.equal(player.recordDeathLineContact, undefined);
});

test('cached fatal dispatch changes only displayed cause and preserves the fatal packet through death', async () => {
  // @ts-expect-error actual host hooks
  const { Hooks } = await import('./fixtures/HostCore.js');
  const hooks = new Hooks();
  const releases: Function[] = [];
  const notes: unknown[] = [];
  const analytics: unknown[] = [];
  let deathText = '';
  let packetSeen: unknown;
  let game: any;
  class Player {
    g: any;
    ship: any;
    id = 'self';
    name = 'Pilot';
    get_name() {
      return this.name;
    }
    get_isWarpJumping() {
      return false;
    }
    isMe = true;
    enterKilled(message: any) {
      packetSeen = message;
      new Killed(this, message).enter();
    }
  }
  class Ship {
    g: any;
    player: any;
    alive = true;
    pos = { x: -200, y: 0 };
    collisionRadius = 10;
    get_pos() {
      return this.pos;
    }
    reset() {}
    destroy() {
      this.alive = false;
    }
  }
  class Killed {
    g = game;
    deathInfo = {
      set_text: (text: string) => {
        deathText = text;
      },
    };
    constructor(
      public player: any,
      public m: any,
    ) {}
    enter() {
      this.player.ship.destroy();
      this.player.ship = null;
      this.deathInfo.set_text('native suicide');
    }
  }
  const player = new Player() as Player & Raw;
  const ship = new Ship();
  player.ship = ship;
  ship.player = player;
  const Log = {
    writeDeathNote(_player: any, _killer: string, cause: string) {
      notes.push(cause);
    },
  };
  const killed = Object.assign(
    function (message: any) {
      const cause = message.getString(2);
      Log.writeDeathNote(player, message.getString(1), cause);
      analytics.push(cause);
      player.enterKilled(message);
    },
    { __id__: 42 },
  );
  const bound = killed.bind(null);
  game = {
    playerManager: { me: player, killed, hx__closures__: { 42: bound } },
    isLeaving: false,
    get_isLeaving() {
      return this.isLeaving;
    },
    get_me: () => player,
  };
  player.g = ship.g = game;
  const Connection = {
    runMessageHandler(_type: string, handler: Function, message: any) {
      handler(message);
    },
  };
  const classes: Raw = {
    'core.player.Player': Player,
    'core.ship.PlayerShip': Ship,
    'core.states.player.Killed': Killed,
    'playerio.Connection': Connection,
    'core.hud.components.chat.MessageLog': Log,
    'core.weapon.Damage': { TYPE_HTML: ['energy'] },
  };
  installNativeIncomingHistory(
    {
      cls: (name: string) => classes[name],
      defer: (fn: Function) => releases.push(fn),
      before: (target: any, name: string, fn: Function) =>
        releases.push(hooks.add(target, name, 'before', fn)),
      around: (target: any, name: string, fn: Function) =>
        releases.push(hooks.add(target, name, 'around', fn)),
    } as any,
    game,
  );
  player.recordDeathLineContact(0, -100, 0, 100, -200, 0);
  const values = Object.freeze(['self', 'Pilot', 'suicide', 0, 0]);
  const message = Object.freeze({
    type: 'killed',
    length: 5,
    getString: (index: number) => values[index],
    getInt: (index: number) => values[index],
  });
  Connection.runMessageHandler('killed', bound, message);
  assert.deepEqual(notes, ['Death Line']);
  assert.deepEqual(analytics, ['suicide']);
  assert.equal(packetSeen, message);
  assert.match(deathText, /DEATH LINE/);
  assert.match(deathText, /energy damage$/);
  assert.equal(message.getString(2), 'suicide');
  // A death note outside the exact dispatch scope must not inherit its evidence.
  Log.writeDeathNote(player, 'Pilot', 'suicide');
  assert.deepEqual(notes, ['Death Line', 'suicide']);
  for (const release of releases.reverse()) release();
});
