import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import { bindGameClasses, type GameScene } from '../src/game/Bindings';
import type { ChatMessage } from '../src/game/ChatMessage';
import { ClientIPCService } from '../src/ipc/ClientIPCService';
import { ClientLoginNotices } from '../src/chat/ClientLoginNotices';

test('typed login notices stay local, escape names, deduplicate across rooms and release listeners', () => {
  const queue: ChatMessage[] = [];
  const log = {
    textQueue: queue,
    write(text: string, type: string) {
      queue.push({ text, type, timeout: 0 });
    },
  };
  const id = 'simple1547032044962';
  const client = { connectUserId: id };
  const game = {
    client,
    messageLog: {},
    get_me: () => ({ id }),
    get_isLeaving: () => false,
  } as unknown as GameScene;
  const api = {
    game,
    cls: (name: string) => (name === 'core.hud.components.chat.MessageLog' ? log : {}),
  } as unknown as API;
  bindGameClasses(api);
  type PeerHandler = (id: string, name: string) => void;
  const listeners = new Set<PeerHandler>();
  let loginId = 'abcdef012345';
  const transport = {
    connected: true,
    onlinePlayers: [{ id: 'peer', name: 'untrusted event name' }],
    addPeerHandler: (callback: PeerHandler) => listeners.add(callback),
    removePeerHandler: (callback: PeerHandler) => listeners.delete(callback),
    peerLoginInfo: (peer: string) => ({
      id: peer,
      name: '[error]' + '&'.repeat(50),
      loginId,
      version: '1.2.0',
      build: 'Public',
    }),
  } as unknown as ClientIPCService;
  const descriptor = Object.getOwnPropertyDescriptor(ClientIPCService, 'instance')!;
  Object.defineProperty(ClientIPCService, 'instance', { configurable: true, get: () => transport });
  let notices: ClientLoginNotices | undefined;
  try {
    notices = new ClientLoginNotices(api, game, transport);
    assert.equal(queue.length, 1);
    assert.ok(queue[0].text.includes('&#91;error&#93;'));
    assert.ok(queue[0].text.includes('... logged-in to the game with QoLAF 1.2.0 (Public)'));
    assert.equal(queue[0].clientDeveloperNoticeOwner, id);
    for (const callback of listeners) callback('peer', 'changed event name');
    assert.equal(queue.length, 1);
    notices.dispose();
    assert.equal(listeners.size, 0);
    const nextGame = { ...game } as GameScene;
    Object.assign(api, { game: nextGame });
    notices = new ClientLoginNotices(api, nextGame, transport);
    assert.equal(queue.length, 1, 'same account and login token survive scene replacement');
    loginId = '012345abcdef';
    for (const callback of listeners) callback('peer', 'ignored');
    assert.equal(queue.length, 2);
    client.connectUserId = 'another-account';
    loginId = '111111111111';
    for (const callback of listeners) callback('peer', 'ignored');
    assert.equal(queue.length, 2, 'mismatched authenticated account cannot receive notices');
    notices.dispose();
    notices.dispose();
    assert.equal(listeners.size, 0);
  } finally {
    notices?.dispose();
    Object.defineProperty(ClientIPCService, 'instance', descriptor);
  }
});
