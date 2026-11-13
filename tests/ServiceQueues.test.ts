import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import { bindGameClasses, type GameScene } from '../src/game/Bindings';
import {
  installServiceViews,
  disconnectServiceViews,
  reconnectServiceViews,
} from '../src/service/ServiceViews';
// @ts-expect-error production hook dispatcher
import { Hooks } from './fixtures/HostCore.js';

test('queue disconnect silently dismisses stale choices and sounds; reconnect only refreshes state', () => {
  const sounds: Array<() => void> = [];
  const sent: Array<[string, unknown]> = [];
  let plays = 0;
  let removedCleanup = 0;
  class Popup {
    events = new Map<string, () => void>();
    disposed = false;
    text = '';
    constructor(_type: string) {
      this.events.set('removedFromStage', () => removedCleanup++);
    }
    setPopupText(text: string) {
      this.text = text;
    }
    updateTime(text: string) {
      this.text = text;
    }
    addEventListener(type: string, callback: () => void) {
      this.events.set(type, callback);
    }
    removeEventListeners(type: string) {
      this.events.delete(type);
    }
    removeFromParent(_dispose: boolean) {
      this.events.get('removedFromStage')?.();
      this.disposed = true;
      this.events.clear();
    }
  }
  class Friends {
    updateOnlineFriends() {}
    onOnlineFriends() {}
  }
  class Manager {
    queues: Queue[] = [];
    handleQueueInfo() {}
  }
  class Scene {
    static trackEvent() {}
    connected = true;
    leaving = false;
    queueManager = new Manager();
    friendManager = null;
    hud = { resize() {} };
    serviceConnection = { get_connected: () => this.connected };
    get_isLeaving() {
      return this.leaving;
    }
    get_me() {
      return { get_level: () => 150 };
    }
    addChildToOverlay(_popup: Popup) {}
    removeChildFromOverlay(popup: Popup, dispose: boolean) {
      popup.removeFromParent(dispose);
    }
    sendToServiceRoom(type: string, args: unknown) {
      sent.push([type, args]);
    }
    rpcServiceRoom(type: string, _callback: unknown) {
      sent.push([type, null]);
    }
    handleServiceDisconnect() {}
    exit() {}
    dispose() {}
  }
  class Queue {
    type = 'pvp';
    isWaiting = true;
    isInQueue = true;
    isReady = true;
    accepted = true;
    startTime = 100;
    avgTime = 200;
    roomId: string | null = 'old';
    solarSystem: string | null = 'old';
    acceptPopup: Popup | null = null;
    expire = false;
    constructor(public g: Scene) {}
    update() {}
    getTimeout() {
      if (this.expire) this.acceptPopup = null;
      return '03';
    }
    createAcceptPopup() {}
    getPopup(): Popup | null {
      return this.acceptPopup;
    }
  }
  const classes: Record<string, unknown> = {
    'core.friend.FriendManager': Friends,
    'core.scene.Game': Scene,
    'core.queue.QueueManager': Manager,
    'core.queue.QueueInfoHolder': Queue,
    'core.hud.components.dialogs.QueuePopupMessage': Popup,
    'sound.SoundLocator': {
      getService: () => ({
        preCacheSound: (_key: string, done: () => void) => sounds.push(done),
        play: () => plays++,
      }),
    },
  };
  const cleanup: Array<() => void> = [];
  const hooks = new Hooks((error: unknown) => {
    throw error;
  });
  const register = (kind: string) => (owner: object, name: string, callback: unknown) => {
    const off = hooks.add(owner, name, kind, callback);
    cleanup.push(off);
    return off;
  };
  bindGameClasses({ cls: (name: string) => classes[name] ?? {} } as unknown as API);
  installServiceViews({
    before: register('before'),
    around: register('around'),
    defer: (off: () => void) => cleanup.push(off),
  } as unknown as API);
  const scene = new Scene();
  const game = scene as unknown as GameScene;
  const queue = new Queue(scene);
  scene.queueManager.queues.push(queue);
  try {
    queue.createAcceptPopup();
    const first = queue.acceptPopup!;
    const staleAccept = first.events.get('accept')!;
    const staleClose = first.events.get('close')!;
    queue.createAcceptPopup();
    assert.equal(queue.acceptPopup, first, 'duplicate popup suppressed');
    scene.connected = false;
    disconnectServiceViews(game);
    assert.equal(first.disposed, true);
    assert.equal(removedCleanup, 1, 'stage cleanup survives silent dismissal');
    assert.deepEqual(
      [queue.isWaiting, queue.isInQueue, queue.isReady, queue.accepted],
      [false, false, false, false],
    );
    assert.deepEqual(
      [queue.startTime, queue.avgTime, queue.roomId, queue.solarSystem],
      [0, 0, null, null],
    );
    assert.equal(queue.getTimeout(), '00');
    sounds.shift()!();
    staleAccept();
    staleClose();
    assert.equal(plays, 0);
    assert.deepEqual(sent, []);
    scene.connected = true;
    reconnectServiceViews(game);
    assert.deepEqual(sent, [['RequestQueueInfo', null]]);
    queue.createAcceptPopup();
    const second = queue.acceptPopup!;
    staleAccept();
    staleClose();
    assert.equal(queue.acceptPopup, second);
    assert.equal(sent.length, 1);
    sounds.shift()!();
    assert.equal(plays, 1);
    second.events.get('accept')!();
    assert.deepEqual(sent[1], ['acceptMatch', ['pvp']]);
    assert.equal(queue.accepted, true);
    assert.equal(queue.acceptPopup, null);
    queue.createAcceptPopup();
    const declined = queue.getPopup();
    assert.ok(declined);
    declined.events.get('close')!();
    assert.deepEqual(sent[2], ['declineMatch', ['pvp']]);
    assert.equal(queue.isWaiting, false);
    queue.createAcceptPopup();
    queue.expire = true;
    assert.doesNotThrow(() => queue.update(), 'timeout may clear popup during update');
  } finally {
    cleanup.reverse().forEach((off) => off());
  }
});
