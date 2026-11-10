import assert from 'node:assert/strict';
import { test } from 'node:test';
import { installNativeIpcAuthentication } from '../src/ipc/NativeIpcAuthentication';
import { ClientIpcService } from '../src/ipc/ClientIpcService';
// @ts-expect-error actual plugin host hook dispatcher
import { Hooks } from './fixtures/HostCore.js';

function fixture(t: { after(fn: () => void): void }, hot = false) {
  ClientIpcService.shutdown();
  const joins: any[][] = [];
  const primaryJoins: string[] = [];
  const timers = new Set<() => void>();
  const native = {
    connectUserId: 'owner',
    multiplayer: { createJoinRoom: (...args: any[]) => joins.push(args) },
  };
  class Manager {
    static getServiceRoomID(index: number) {
      return `Service-1410_${index}`;
    }
    static isValidServiceRoomId(id: string) {
      return /^Service-\d+_\d+$/.test(id);
    }
    client = native;
    room: any = null;
    serviceConnection: any = { connected: true, roomId: 'Service-1410_0' };
    login = { showRoomConnectionStatus: (text: string) => reports.push(text) };
    onJoinedServiceRoom() {}
    joinServiceRoom(id: string) {
      primaryJoins.push(id);
    }
    joinServiceRoomAttempt(id: string) {
      primaryJoins.push(id);
    }
    reconnectServiceRoom(id: string, success: Function, _failure: Function) {
      primaryJoins.push(id);
      success(this.serviceConnection);
    }
    handleRooms(rooms: any[]) {
      this.room = rooms[0];
    }
    createJoin() {
      primaryJoins.push(this.room.id);
    }
  }
  class Login {
    init() {}
  }
  class Scene {
    duplicateLogin() {}
  }
  class Root {
    onExitGame() {}
  }
  const reports: string[] = [];
  const classes: Record<string, any> = {
    'joinRoom.JoinRoomManager': Manager,
    Login: Login,
    'core.scene.SceneBase': Scene,
    RymdenRunt: Root,
    'core.hud.components.chat.MessageLog': { write: (text: string) => reports.push(text) },
  };
  const hooks = new Hooks();
  const cleanups: Function[] = [];
  const api: any = {
    game: hot
      ? { client: native, serviceConnection: { connected: true, roomId: 'Service-1410_0' } }
      : null,
    raw: { classes },
    cls: (name: string) => classes[name],
    defer: (fn: Function) => cleanups.push(fn),
  };
  for (const mode of ['around', 'before', 'after'])
    api[mode] = (object: any, key: string, fn: Function) => {
      const off = hooks.add(object, key, mode, fn);
      cleanups.push(off);
      return off;
    };
  const events = new EventTarget();
  const environment = {
    now: () => 1000,
    random: () => 0.2,
    interval: (fn: () => void) => {
      timers.add(fn);
      return () => {
        timers.delete(fn);
      };
    },
    defer: (fn: () => void) => fn(),
    debug: () => {},
  };
  installNativeIpcAuthentication(api, events, environment);
  const cleanup = () => {
    cleanups
      .splice(0)
      .reverse()
      .forEach((fn) => fn());
    ClientIpcService.shutdown();
  };
  t.after(cleanup);
  return {
    classes,
    Manager,
    Login,
    Scene,
    Root,
    manager: new Manager(),
    native,
    joins,
    primaryJoins,
    timers,
    reports,
    events,
    cleanup,
  };
}

test('IPC belongs to authenticated owner, uses current server version and survives primary reconnect', (t) => {
  const f = fixture(t);
  f.manager.onJoinedServiceRoom();
  const first = ClientIpcService.instance;
  assert.ok(first);
  assert.equal(f.joins.length, 1);
  assert.deepEqual(f.joins[0].slice(0, 5), [
    ClientIpcService.roomId,
    'service',
    false,
    {},
    { client_version: 1410 },
  ]);
  f.manager.onJoinedServiceRoom();
  let recovered = false;
  f.manager.reconnectServiceRoom(
    'Service-1410_1',
    () => {
      recovered = true;
    },
    () => assert.fail(),
  );
  assert.equal(recovered, true);
  assert.equal(ClientIpcService.instance, first);
  assert.equal(f.joins.length, 1);
  f.manager.client = { ...f.native, connectUserId: 'second-owner' };
  f.manager.onJoinedServiceRoom();
  assert.notEqual(ClientIpcService.instance, first);
  assert.equal(f.joins.length, 2);
  new f.Login().init();
  assert.equal(ClientIpcService.instance, null);
  assert.equal(f.timers.size, 0);
});

test('reserved IPC destination cannot become the primary service or game room', (t) => {
  const f = fixture(t),
    reserved = ClientIpcService.roomId;
  assert.equal(f.Manager.isValidServiceRoomId(reserved), false);
  assert.equal(f.Manager.isValidServiceRoomId('Service-1410_0'), true);
  f.manager.joinServiceRoom(reserved);
  f.manager.joinServiceRoomAttempt(reserved);
  f.manager.reconnectServiceRoom(
    reserved,
    () => assert.fail(),
    () => assert.fail(),
  );
  f.manager.handleRooms([
    { id: reserved },
    { id: 'bad', data: { primaryService: reserved } },
    { id: 'good' },
  ]);
  assert.equal(f.manager.room.id, 'good');
  f.manager.room = { id: reserved };
  f.manager.createJoin();
  assert.deepEqual(f.primaryJoins, []);
  assert.equal(f.joins.length, 0);
  f.manager.serviceConnection.roomId = reserved;
  f.manager.onJoinedServiceRoom();
  assert.equal(f.joins.length, 0);
});

test('page cache resume restores one IPC owner; duplicate login and unload release lifetime', (t) => {
  const f = fixture(t);
  f.manager.onJoinedServiceRoom();
  f.events.dispatchEvent(new Event('pagehide'));
  assert.equal(ClientIpcService.instance, null);
  const resume = Object.assign(new Event('pageshow'), { persisted: true });
  f.events.dispatchEvent(resume);
  assert.equal(f.joins.length, 2);
  new f.Scene().duplicateLogin();
  f.events.dispatchEvent(resume);
  assert.equal(f.joins.length, 2, 'duplicate-login owner must not reconnect from page cache');
  f.manager.onJoinedServiceRoom();
  new f.Root().onExitGame();
  assert.equal(ClientIpcService.instance, null);
  f.cleanup();
  f.events.dispatchEvent(resume);
  assert.equal(ClientIpcService.instance, null);
  assert.equal(f.timers.size, 0);
});

test('hot activation starts IPC immediately and cleanup restores the class registry and server address', (t) => {
  const previousVersion = ClientIpcService.serverVersion;
  const f = fixture(t, true);
  assert.equal(f.joins.length, 1);
  assert.equal(ClientIpcService.roomId, 'Service-1410_24');
  assert.equal(f.classes['core.ipc.ClientIpcService'], ClientIpcService);
  f.cleanup();
  assert.equal(f.classes['core.ipc.ClientIpcService'], undefined);
  assert.equal(ClientIpcService.serverVersion, previousVersion);
  assert.equal(ClientIpcService.instance, null);
  assert.equal(f.timers.size, 0);
});
