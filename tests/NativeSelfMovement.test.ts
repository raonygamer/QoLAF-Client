// @ts-expect-error actual host dispatcher
import { Hooks } from './fixtures/HostCore.js';
import { bindGameClasses } from '../src/game/Bindings';
import assert from 'node:assert/strict';
import test from 'node:test';
import type { API, Raw } from '../src/api/Types';
import { installNativeSelfMovement } from '../src/movement/NativeSelfMovement';

function fixture() {
  class Heading {
    time = 0;
    pos = { x: 0, y: 0 };
    speed = { x: 0, y: 0 };
    rotation = 0;
    accelerate = false;
    deaccelerate = false;
    rotateLeft = false;
    rotateRight = false;
    copy(other: any) {
      Object.assign(this, other, { pos: { ...other.pos }, speed: { ...other.speed } });
    }
    clone() {
      const value = new Heading();
      value.copy(this);
      return value;
    }
    almostEqual(other: any) {
      return this.pos.x === other.pos.x && this.pos.y === other.pos.y;
    }
    runCommand(command: any) {
      if (command.type === 0) this.accelerate = command.active;
    }
    parseMessage(message: any) {
      this.copy(message.heading);
    }
  }
  class Ship {
    g: any;
    course = new Heading();
    converger: any;
    get_course() {
      return this.course;
    }
    getConverger() {
      return this.converger;
    }
    get_usingBoost() {
      return false;
    }
    convergerUpdateHeading(heading: any) {
      this.converger.updateHeading(heading);
    }
    initCourse(heading: any) {
      this.course = this.converger.course = heading;
    }
    set_course(heading: any) {
      this.initCourse(heading);
    }
    runCommand(command: any) {
      this.course.runCommand(command);
    }
  }
  class PlayerShip extends Ship {
    alive = true;
    collisionRadius = 2;
    engine = { accelerate() {}, idle() {} };
    runConverger() {
      this.converger.updateHeading(this.course);
    }
    player: any;
    weapon = {};
    get_weapon() {
      return this.weapon;
    }
    boostDuration = 100;
    boostCD = 1000;
    boostNextRdy = 0;
    artifact_cooldownReduction = 0;
    hasBoost = true;
    _usingBoost = false;
    boostEndTime = 0;
    boost() {}
    speedBoostEffect: { killEmitter(): void }[] = [];
    boostEffect() {}
    updateHeading() {}
    reset() {}
  }
  class Converger {
    g: any;
    ship: any;
    course: any;
    target: any = null;
    updateHeading(heading: any) {
      heading.pos.x += heading.speed.x * 0.033;
      heading.pos.y += heading.speed.y * 0.033;
      heading.time += 33;
    }
    calculateOffset() {}
    setConvergeTarget(heading: any) {
      this.target = heading;
    }
    clearConvergeTarget() {
      this.target = null;
    }
    setCourse(heading: any) {
      this.course = this.ship.course = heading;
    }
  }
  const sent: any[] = [];
  const ship = new PlayerShip();
  const player = {
    id: 'self',
    isMe: true,
    ship,
    inSafeZone: false,
    isWarpJumping: false,
    get_inSafeZone() {
      return this.inSafeZone;
    },
    get_isWarpJumping() {
      return this.isWarpJumping;
    },
  };
  ship.player = player;
  const commandReceived = Object.assign(
    function (message: any) {
      ship.runCommand({ type: message.getInt(1), active: message.getBoolean(2) });
    },
    { __id__: 11 },
  );
  const bound = commandReceived.bind(null);
  const commands: any = {
    commands: [],
    commandReceived,
    hx__closures__: { 11: bound },
    sendCommand(command: any) {
      sent.push({ ...command });
    },
    addCommand() {},
    runCommand() {},
    clearCommands() {},
    addBoostCommand() {},
  };
  const sync: any = {
    playerCourse() {
      throw new Error('Self packet reached old immediate path');
    },
    playerUsedBoost() {},
    fastforwardMe() {},
  };
  const records: any[] = [];
  const game: any = {
    time: 99,
    get_me: () => player,
    commandManager: commands,
    shipManager: { shipSync: sync },
    playerManager: {
      me: player,
      playersById: { h: { self: player } },
      get_playersById() {
        return this.playersById;
      },
      update() {},
    },
    hud: { abilities: { initiateCooldown() {} } },
    recordHeadingDebug(...args: any[]) {
      records.push(args);
    },
  };
  ship.g = game;
  const converger = new Converger();
  Object.assign(converger, { g: game, ship, course: ship.course });
  ship.converger = converger;
  const Connection = {
    runMessageHandler(_type: string, handler: Function, message: any) {
      handler(message);
    },
  };
  class GameFixture {}
  Object.setPrototypeOf(game, GameFixture.prototype);
  const classes: any = {
    'core.scene.Game': GameFixture,
    'core.states.gameStates.PlayState': class {
      checkAccelerate() {}
    },
    'core.ship.Ship': Ship,
    'core.ship.PlayerShip': PlayerShip,
    'core.sync.Converger': Converger,
    'movement.Heading': Heading,
    'movement.Command': class {},
    'playerio.Connection': Connection,
  };
  const cleanup: Function[] = [];
  const hooks = new Hooks();
  const api = {
    cls: (name: string) => classes[name],
    defer(fn: Function) {
      cleanup.push(fn);
      return fn;
    },
    around(target: object, key: string, hook: Function) {
      const release = hooks.add(target, key, 'around', hook);
      cleanup.push(release);
      return release;
    },
    before(target: object, key: string, hook: Function) {
      const release = hooks.add(target, key, 'before', hook);
      cleanup.push(release);
      return release;
    },
  } as unknown as API;
  bindGameClasses({ ...api, cls: (name: string) => classes[name] ?? class {} });
  installNativeSelfMovement(api, game);
  return {
    game,
    ship,
    commands,
    sync,
    converger,
    sent,
    records,
    Connection,
    bound,
    Heading,
    cleanup: () => {
      for (const fn of cleanup.reverse()) fn();
    },
  };
}

test('native self integration queues packets, flushes before players, and dispatches monotonic commands', () => {
  const f = fixture();
  assert.equal(f.commands.addCommand(0, true), true);
  assert.equal(f.sent[0].time, 33);
  assert.equal(f.ship.course.accelerate, true);
  assert.equal(f.commands.addCommand(0, true), false);
  const heading = new f.Heading();
  heading.pos.x = 10;
  f.sync.playerCourse({ getString: () => 'self', heading }, 0);
  assert.equal(f.converger.target, null);
  f.game.playerManager.update();
  assert.equal((f.converger.target as unknown as Raw).pos.x, 10);
  assert.equal((f.converger.target as unknown as Raw).accelerate, true);
  f.commands.addCommand(0, false);
  assert.equal((f.converger.target as unknown as Raw).accelerate, false);
  assert.equal(f.ship.course.accelerate, false);
  assert.equal(f.sent[1].time, 33);
  f.cleanup();
});

test('cached self movement echoes are suppressed without suppressing unrelated callbacks', () => {
  const f = fixture();
  f.commands.addCommand(0, true);
  const echo = {
    type: 'command',
    length: 4,
    getString: () => 'self',
    getInt: () => 0,
    getBoolean: () => false,
  };
  f.Connection.runMessageHandler('command', f.bound, echo);
  assert.equal(f.ship.course.accelerate, true);
  let otherReceived = false;
  f.Connection.runMessageHandler(
    'command',
    () => {
      otherReceived = true;
    },
    echo,
  );
  assert.equal(otherReceived, true);
  f.cleanup();
});

test('explicit course replacement discards queued old transforms and resets command timestamp history', () => {
  const f = fixture();
  f.commands.addCommand(0, true);
  const old = new f.Heading();
  old.pos.x = 10;
  f.sync.playerCourse({ getString: () => 'self', heading: old }, 0);
  const replacement = new f.Heading();
  replacement.time = 1000;
  replacement.pos.x = 200;
  f.ship.initCourse(replacement);
  f.game.playerManager.update();
  assert.equal(f.ship.course.pos.x, 200);
  assert.equal(f.converger.target, null);
  assert.equal(f.commands.commands.length, 0);
  f.cleanup();
});

test('death-line prediction and replay sweep every step while authoritative replacement remains accepted', () => {
  const f = fixture();
  f.game.deathLineManager = { lines: [{ get_x: () => 0, get_y: () => -100, toX: 0, toY: 100 }] };
  let contacts = 0;
  f.ship.player.recordDeathLineContact = () => {
    contacts++;
  };
  f.ship.course.pos.x = -10;
  f.ship.course.speed.x = 1000;
  f.ship.course.time = 66;
  f.ship.updateHeading();
  assert.equal(f.ship.course.pos.x, -10);
  assert.equal(f.ship.course.speed.x, 0);
  assert.equal(f.ship.course.time, 99);
  assert.equal(contacts, 1);
  const replay = new f.Heading();
  replay.pos.x = -10;
  replay.speed.x = 1000;
  f.ship.convergerUpdateHeading(replay);
  assert.equal(replay.pos.x, -10);
  assert.equal(replay.speed.x, 0);
  assert.equal(contacts, 1);
  const corrected = new f.Heading();
  corrected.pos.x = 10;
  corrected.speed.x = 100;
  f.ship.initCourse(corrected);
  f.ship.updateHeading();
  assert.equal(f.ship.course.pos.x, 13.3);
  f.ship.player.isWarpJumping = true;
  f.ship.course.pos.x = -10;
  f.ship.course.speed.x = 1000;
  f.ship.updateHeading();
  assert.equal(f.ship.course.pos.x, 23);
  f.cleanup();
});

test('boost expires before death-line movement replacement with the actual host hook order', () => {
  const f = fixture();
  try {
    f.game.time = 99;
    f.ship.course.time = 99;
    f.commands.addBoostCommand();
    assert.equal(f.ship._usingBoost, true);
    let stopped = 0;
    f.ship.speedBoostEffect.push({
      killEmitter() {
        stopped++;
      },
    });
    f.game.time = 198;
    f.ship.updateHeading();
    assert.equal(f.ship._usingBoost, true, 'boost lasts through its timed interval');
    assert.equal(stopped, 0);
    f.game.time = 199;
    f.ship.updateHeading();
    assert.equal(f.ship._usingBoost, false, 'expiry clears the state that blocks turning');
    assert.equal(stopped, 1);
    assert.equal(f.ship.speedBoostEffect.length, 0);
    assert.equal(
      (f.ship as typeof f.ship & { boostEndedLastTick: boolean }).boostEndedLastTick,
      true,
    );
    f.ship.updateHeading();
    assert.equal(stopped, 1, 'expiry does not kill an emitter twice');
  } finally {
    f.cleanup();
  }
});
