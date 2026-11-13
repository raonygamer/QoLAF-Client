import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import { bindGameClasses } from '../src/game/Bindings';
import { installPreparedWarp } from '../src/login/PreparedWarp';
import { installWarpTransition } from '../src/login/WarpTransition';
// @ts-expect-error actual host dispatcher
import { Hooks } from './fixtures/HostCore.js';

function fixture() {
  type Room = { id: string };
  const requests: Array<{ success: (rooms: Room[]) => void; failure: (error: Error) => void }> = [];
  const results: Room[][] = [];
  const failures: Error[] = [];
  const cleanups: Array<() => void> = [];
  let clockResets = 0;
  class Service {
    connected = true;
    get_connected() {
      return this.connected;
    }
    get_roomId() {
      return 'service';
    }
  }
  class Manager {
    serviceConnection = new Service();
    desiredRoom = '';
    desiredType = 'normal';
    roomStateMachine: { currentRoom: Scene | null } = { currentRoom: null };
    dataManager = { loadKey: () => ({}) };
    client = {
      multiplayer: {
        listRooms(
          _type: string,
          _criteria: object,
          _limit: number,
          _offset: number,
          success: (rooms: Room[]) => void,
          failure: (error: Error) => void,
        ) {
          requests.push({ success, failure });
        },
      },
    };
    get_desiredRoomId() {
      return this.desiredRoom;
    }
    get_desiredSystemType() {
      return this.desiredType;
    }
    joinGame(system: string, _data: { level: number; warpJump: boolean }) {
      this.client.multiplayer.listRooms(
        'game',
        { solarSystemKey: system, service: 'service' },
        1000,
        0,
        (rooms) => results.push(rooms),
        (error) => failures.push(error),
      );
    }
    joinServiceRoom() {}
  }
  const manager = new Manager();
  class Scene {
    enableTrackFPS = true;
    leaving = false;
    addedListeners = 0;
    get_me() {
      return { get_level: () => 50, get_isWarpJumping: () => false };
    }
    get_isLeaving() {
      return this.leaving;
    }
    fadeIntoState(_state: Warp) {}
    update() {}
    addEventListener() {
      this.addedListeners++;
    }
    warpJump(system: string) {
      manager.joinGame(system, { level: 50, warpJump: true });
    }
    exit() {}
  }
  class Warp {
    destination = 'destination';
    roomId = '';
    systemType = 'normal';
    exit() {}
  }
  const scene = new Scene();
  manager.roomStateMachine.currentRoom = scene;
  const classes: Record<string, unknown> = {
    'core.scene.Game': Scene,
    'core.states.gameStates.WarpJumpState': Warp,
    'joinRoom.JoinRoomManager': Manager,
    'joinRoom.JoinRoomLocator': { getService: () => manager },
    'core.states.menuStates.Login': {},
  };
  const hooks = new Hooks((error: unknown) => {
    throw error;
  });
  const api = {
    cls: (name: string) => classes[name] ?? {},
    before(target: object, name: string, callback: unknown) {
      const off = hooks.add(target, name, 'before', callback);
      cleanups.push(off);
      return off;
    },
    around(target: object, name: string, callback: unknown) {
      const off = hooks.add(target, name, 'around', callback);
      cleanups.push(off);
      return off;
    },
    defer: (off: () => void) => cleanups.push(off),
  } as unknown as API;
  bindGameClasses(api);
  installWarpTransition(api, () => {
    clockResets++;
  });
  installPreparedWarp(api);
  return {
    scene,
    manager,
    requests,
    results,
    failures,
    state: new Warp(),
    clockResets: () => clockResets,
    replaceService: () => {
      manager.serviceConnection = new Service();
    },
    dispose: () => cleanups.reverse().forEach((off) => off()),
  };
}

test('warp discovery reuses early and late results only after visual commit', () => {
  for (const early of [true, false]) {
    const f = fixture();
    try {
      f.scene.fadeIntoState(f.state);
      assert.equal(f.requests.length, 1);
      if (early) f.requests[0].success([{ id: 'room' }]);
      assert.equal(f.results.length, 0);
      f.scene.warpJump('destination');
      assert.equal(f.requests.length, 1);
      if (!early) f.requests[0].success([{ id: 'room' }]);
      assert.deepEqual(f.results, [[{ id: 'room' }]]);
      assert.equal(f.clockResets(), 1);
    } finally {
      f.dispose();
    }
  }
});

test('cancelled, failed and mismatched preparations fall back to fresh discovery', () => {
  for (const reason of ['exit', 'service', 'failure', 'level', 'type', 'destination'] as const) {
    const f = fixture();
    try {
      f.scene.fadeIntoState(f.state);
      const old = f.requests[0];
      if (reason === 'exit') f.state.exit();
      if (reason === 'service') f.manager.joinServiceRoom();
      if (reason === 'failure') old.failure(new Error('lookup failed'));
      if (reason === 'type') f.manager.desiredType = 'elite';
      f.manager.joinGame(reason === 'destination' ? 'other' : 'destination', {
        level: reason === 'level' ? 51 : 50,
        warpJump: true,
      });
      assert.equal(f.requests.length, 2, reason);
      old.success([{ id: 'stale' }]);
      assert.equal(f.results.length, 0);
      f.requests[1].success([{ id: 'fresh' }]);
      assert.deepEqual(f.results, [[{ id: 'fresh' }]]);
    } finally {
      f.dispose();
    }
  }
});

test('a replaced Service cancels a consumed preparation and restores the old scene listener', () => {
  const f = fixture();
  try {
    f.scene.fadeIntoState(f.state);
    f.scene.warpJump('destination');
    f.replaceService();
    f.requests[0].success([{ id: 'stale' }]);
    assert.equal(f.results.length, 0);
    assert.equal(f.scene.addedListeners, 1);
  } finally {
    f.dispose();
  }
});

test('committed discovery failure is delivered once and unload restores a waiting scene', () => {
  for (const unload of [false, true]) {
    const f = fixture();
    let disposed = false;
    try {
      f.scene.fadeIntoState(f.state);
      f.scene.warpJump('destination');
      if (unload) {
        f.dispose();
        disposed = true;
        assert.equal(f.scene.addedListeners, 1);
      }
      const error = new Error('discovery failed');
      f.requests[0].failure(error);
      f.requests[0].failure(error);
      f.requests[0].success([{ id: 'late' }]);
      assert.deepEqual(f.failures, unload ? [] : [error]);
      assert.equal(f.results.length, 0);
    } finally {
      if (!disposed) f.dispose();
    }
  }
});
