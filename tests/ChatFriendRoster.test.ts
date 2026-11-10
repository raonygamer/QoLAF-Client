import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ChatFriendRoster } from '../src/chat/ChatFriendRoster';

test('friend roster uses persistent IDs, unique live names and cached skin textures', () => {
  const online: any = { id: 'account', name: 'Pilot' };
  const offline: any = { name: 'Earlier' };
  const ambiguous: any = { name: 'Duplicate' };
  const player = {
    id: 'account',
    get_name: () => 'Pilot',
    get_activeSkin: () => 'painted',
    getActiveFleetObj: () => ({ shipHue: 0.4, shipBrightness: 0.1 }),
  };
  const texture = {};
  let loads = 0;
  const classes: any = {
    'core.player.Player': { onlineFriends: [online], friends: [offline, ambiguous] },
    'core.hud.components.chat.MessageLog': {
      textQueue: [
        { playerName: 'Earlier', playerKey: 'session-only' },
        { playerName: 'EARLIER', playerId: 'persistent-earlier' },
      ],
    },
    'textures.TextureLocator': { getService: () => ({ getTexturesMainByKey: () => [texture] }) },
  };
  const roster = new ChatFriendRoster({ cls: (name: string) => classes[name] } as any, {
    playerManager: {
      get_players: () => [
        player,
        { id: 'one', name: 'Duplicate' },
        { id: 'two', name: 'Duplicate' },
      ],
    },
    dataManager: {
      loadKey(table: string, key: string) {
        loads++;
        if (key === 'broken') throw Error('missing');
        return table === 'Skins' ? { ship: 'ship' } : { bitmap: 'atlas' };
      },
    },
  });
  assert.equal(roster.records()[0], online);
  assert.equal(online.playerId, 'account');
  assert.equal(online.skin, 'painted');
  assert.equal(online.previewShipHue, 0.4);
  assert.equal(online.previewShipContrast, 0);
  assert.equal(offline.playerId, 'persistent-earlier');
  assert.equal(ambiguous.playerId, '');
  assert.equal(roster.texture('painted'), texture);
  assert.equal(roster.texture('painted'), texture);
  assert.equal(loads, 2);
  assert.equal(roster.texture('broken'), null);
  assert.equal(roster.texture('broken'), null);
  assert.equal(loads, 3);
});

test('friend refresh is lazy, throttles synchronous callbacks and ignores disposed callbacks', () => {
  let now = 0,
    requests = 0,
    ready = 0;
  let pending = () => {};
  const roster = new ChatFriendRoster(
    {} as any,
    {
      friendManager: {
        updateOnlineFriends(callback: () => void) {
          requests++;
          pending = callback;
          callback();
        },
      },
    },
    () => now,
  );
  const refresh = () =>
    roster.refresh(() => {
      ready++;
      refresh();
    });
  refresh();
  assert.equal(requests, 1);
  assert.equal(ready, 1);
  now = 29999;
  refresh();
  assert.equal(requests, 1);
  now = 30000;
  refresh();
  assert.equal(requests, 2);
  roster.dispose();
  pending();
  now = 60000;
  refresh();
  assert.equal(requests, 2);
  assert.equal(ready, 2);
});
