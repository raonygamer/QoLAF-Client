import assert from 'node:assert/strict';
import test from 'node:test';
import type { API } from '../src/api/Types';
import { bindGameClasses, type GameScene } from '../src/game/Bindings';
import { ClientIPCService } from '../src/ipc/ClientIPCService';
import type { IPCMessage } from '../src/ipc/ClientIPCCodec';
import { EmperorReadyNotifier } from '../src/ipc/EmperorReadyNotifier';

function fixture() {
  let now = 100;
  let tick = () => {};
  let pings = 0;
  const messages: IPCMessage[] = [];
  const notices: string[] = [];
  const handlers = new Map<string, (message: IPCMessage) => void>();
  const player = { alive: true, get_id: () => 50, get_pos: () => ({ x: 4500, y: 0 }) };
  const names = ['Emperor Xhersix', 'Emperor Yhgvis', 'Emperor Zharix'];
  const enemies = names.map((name, index) => ({
    alive: true,
    hp: 1000,
    shieldHp: 0,
    get_id: () => index + 1,
    get_name: () => name,
    get_pos: () => ({ x: 4600, y: 0 }),
    isAddedToCanvas: true,
    hasFreshResourceSnapshot: true,
    isServerTargeting: (id: number) => id === 50,
    isReconstructing: false,
    reconstructionStartedAt: -1,
  }));
  const state = {
    get_isLeaving: () => false,
    get_connected: () => true,
    get_me: () => ({ ship: player }),
    room: { id: 'arena' },
    solarSystem: { key: 'BC26CB28-5F73-BE5D-88EC-1D3F2676306D' },
    shipManager: { enemies },
    messageLog: {},
  };
  const game = state as unknown as GameScene;
  const ipc = {
    connected: true,
    paused: false,
    sessionId: 'session',
    addMessageHandler: (type: string, handler: (message: IPCMessage) => void) =>
      handlers.set(type, handler),
    removeMessageHandler: (type: string) => handlers.delete(type),
    broadcast: (message: IPCMessage) => {
      messages.push(message);
      return true;
    },
  } as unknown as ClientIPCService;
  const previousInstance = Object.getOwnPropertyDescriptor(ClientIPCService, 'instance')!;
  Object.defineProperty(ClientIPCService, 'instance', { configurable: true, get: () => ipc });
  bindGameClasses({
    cls: (name: string) =>
      name === 'core.hud.components.chat.MessageLog'
        ? { write: (text: string) => notices.push(text) }
        : {},
  } as unknown as API);
  const api = {
    game,
    interval: (callback: () => void) => {
      tick = callback;
      return () => {
        tick = () => {};
      };
    },
  } as unknown as API;
  const tracker = new EmperorReadyNotifier(
    api,
    game,
    ipc,
    () => pings++,
    () => now,
  );
  return {
    tracker,
    state,
    enemies,
    player,
    messages,
    notices,
    handlers,
    names,
    advance: (ms: number) => {
      now += ms;
      tick();
    },
    now: () => now,
    pings: () => pings,
    dispose: () => {
      tracker.dispose();
      Object.defineProperty(ClientIPCService, 'instance', previousInstance);
    },
  };
}

test('Emperor status uses native getters, observation authority and reconstruction lifetime', () => {
  const f = fixture();
  try {
    assert.equal(f.tracker.coordinationAreaActive, true);
    assert.equal(f.pings(), 3);
    assert.ok(f.names.every((name) => f.tracker.status(name).ready));
    f.enemies[0].hasFreshResourceSnapshot = false;
    assert.match(f.tracker.manualPublish('xr')!, /naturally in view/);
    f.enemies[1].isReconstructing = true;
    f.enemies[1].reconstructionStartedAt = f.now();
    f.advance(100);
    assert.equal(f.tracker.status(f.names[1]).reconstructMs, 9900);
    f.advance(10000);
    assert.equal(f.tracker.status(f.names[1]).known, false);
    // A real AI transition ends the cycle, rather than extending the timer.
    f.enemies[1].isReconstructing = false;
    f.advance(100);
    assert.equal(f.tracker.status(f.names[1]).ready, true);
    f.enemies.forEach((enemy) => {
      enemy.hasFreshResourceSnapshot = false;
    });
    f.advance(15001);
    assert.ok(f.names.every((name) => !f.tracker.status(name).known));
  } finally {
    f.dispose();
  }
  assert.equal(f.handlers.size, 0);
});

test('Emperor victory waits for removal and emits only once per trio', () => {
  const f = fixture();
  try {
    for (const enemy of f.state.shipManager.enemies)
      f.tracker.enemyKilled(enemy as unknown as Parameters<EmperorReadyNotifier['enemyKilled']>[0]);
    assert.equal(f.notices.length, 0);
    f.state.shipManager.enemies.splice(0);
    f.advance(100);
    assert.equal(f.notices.length, 1);
    assert.match(f.notices[0], /Three Emperors were defeated!/);
    f.advance(100);
    assert.equal(f.notices.length, 1);
    assert.equal(
      f.messages.filter((message) => message.type === EmperorReadyNotifier.victoryType).length,
      1,
    );
  } finally {
    f.dispose();
  }
});

test('a reconstruction first seen after hot enable cannot publish a ready status', () => {
  const f = fixture();
  try {
    const enemy = f.enemies[0];
    enemy.isReconstructing = true;
    enemy.reconstructionStartedAt = -1;
    const sent = f.messages.length;
    f.advance(100);
    assert.equal(f.tracker.status(f.names[0]).known, false);
    assert.match(f.tracker.manualPublish('xr')!, /naturally in view/);
    assert.equal(
      f.messages.slice(sent).some((message) => message.fields[2] === f.names[0]),
      false,
    );
    enemy.isReconstructing = false;
    f.advance(100);
    assert.equal(f.tracker.status(f.names[0]).ready, true);
  } finally {
    f.dispose();
  }
});
