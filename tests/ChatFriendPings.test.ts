import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ChatFriendPingFormatter as Formatter } from '../src/chat/ChatFriendPingFormatter';
import { RichBitmapMarkupParser as Parser } from '../src/chat/rich/RichBitmapMarkupParser';
import { friendPingTargets, snapshotFriendPings } from '../src/chat/ChatFriendPingTargets';
import { installNativeFriendPings } from '../src/chat/NativeFriendPings';
// @ts-expect-error actual host hooks
import { Hooks } from './fixtures/HostCore.js';

test('ping recognition preserves source boundaries, longest names and HTML style stacks', () => {
  const names = [' Raony ', 'RAONY', 'Raony Gamer', 'A&B', '__proto__'];
  const source =
    "<font color='#ff0000'>@Ra</font>ony @RAONY GAMER, a@Raony @@Raony @Raony_ @A&amp;B @__proto__";
  const original = Parser.parse(source, 14, 0xffffff);
  const formatted = Formatter.format(source, names);
  const parsed = Parser.parse(formatted, 14, 0xffffff);
  assert.equal(parsed.text, original.text);
  const matches = Formatter.findMatches(source, names);
  assert.deepEqual(
    matches.map((match) => match.name),
    ['Raony', 'Raony Gamer', 'A&B', '__proto__'],
  );
  for (let index = 0; index < parsed.text.length; index++) {
    const ping = matches.some((match) => index >= match.begin && index < match.end);
    assert.equal(parsed.colors[index], ping ? Formatter.PING_COLOR : original.colors[index]);
  }
  assert.equal(Formatter.contains('(@raony!)', 'Raony'), true);
  assert.equal(Formatter.contains('@Raony123', 'Raony'), false);
  assert.equal(
    Formatter.format('<font title="@Raony">unrelated</font>', names),
    '<font title="@Raony">unrelated</font>',
  );
  assert.match(Formatter.format('@Raony', names, 1), /#000001/);
});

test('ping snapshots use own/online/offline priority and survive player and friend mutations', () => {
  const live = {
    id: 'friend',
    get_name: () => 'Pilot',
    get_level: () => 90,
    get_activeSkin: () => 'skin',
    clanName: 'Clan',
    getActiveFleetObj: () => ({ shipHue: 0.5 }),
  };
  const online = { id: 'friend', name: 'Pilot', level: 2 };
  const game: any = {
    get_me: () => ({ get_name: () => 'Me' }),
    client: { connectUserId: 'self' },
    solarSystem: { key: 'fulzar', name: 'Fulzar' },
    room: { id: 'room', data: { systemType: 'ELITE' } },
    playerManager: { get_players: () => [live] },
    dataManager: { loadKey: () => ({ name: 'Fulzar' }) },
  };
  const api: any = {
    cls: () => ({
      onlineFriends: [online],
      friends: [
        { id: 'self', name: 'Me' },
        { id: 'friend', name: 'Pilot' },
        { id: 'offline', name: 'Offline' },
      ],
    }),
  };
  const targets = friendPingTargets(api, game);
  assert.deepEqual(
    targets.map((target) => target.playerId),
    ['self', 'friend', 'offline'],
  );
  const snapshots = snapshotFriendPings('x @Pilot and @Offline', targets);
  assert.equal(snapshots[0].level, 90);
  assert.equal(snapshots[0].systemType, 'elite');
  assert.equal(snapshots[0].solarSystem, 'Fulzar');
  assert.equal(snapshots[0].shipHue, 0.5);
  assert.equal(snapshots[0].containsVisibleIndex(2), true);
  assert.equal(snapshots[0].containsVisibleIndex(8), false);
  targets[1].name = 'Changed';
  online.name = 'Changed';
  live.clanName = 'Changed';
  assert.equal(snapshots[0].name, 'Pilot');
  assert.equal(snapshots[0].clanName, 'Clan');
  assert.equal(snapshots[1].systemType, '');
});

test('native pings run after length/filter checks, preserve supporter/sender/roles and restore hooks', () => {
  const hooks = new Hooks();
  const cleanup: (() => void)[] = [];
  const received: any[] = [];
  const game: any = {
    get_me: () => ({ get_name: () => 'Pilot' }),
    client: { connectUserId: 'self' },
    messageLog: { updateTexts: (message: any) => received.push(message) },
  };
  const log: any = {
    g: game,
    colorRights: (rights: string, text: string) => (rights ? '[mod] ' + text : text),
    writeChatMsg(
      channel: string,
      body: string,
      id: string,
      name: string | null,
      rights = '',
      supporter = false,
    ) {
      if (body.length > 250) return;
      body = body.replace('profanity', '*********');
      const text = this.colorRights(
        rights,
        (supporter ? "<font color='#ffff66'>&#9733;</font>" : '') +
          (name != null ? name + ': ' : '') +
          body,
      );
      game.messageLog.updateTexts({ text: '[' + channel + '] ' + text });
    },
  };
  const api: any = {
    cls: (name: string) => (name.endsWith('MessageLog') ? log : {}),
    around: (object: any, key: string, fn: Function) =>
      cleanup.push(hooks.add(object, key, 'around', fn)),
  };
  let notifications = 0;
  installNativeFriendPings(api, game, () => {
    notifications++;
  });
  log.writeChatMsg('local', '@Pilot profanity', 'sender', '@Pilot', 'mod', true);
  const row = received[0];
  assert.match(
    row.text,
    /\[mod\] <font color='#ffff66'>&#9733;<\/font>@Pilot: <font color='#66aaff'>@Pilot<\/font> \*{9}$/,
  );
  assert.equal(row.pings.at(-1).playerId, 'self');
  assert.equal(notifications, 1);
  log.writeChatMsg('local', '@Pilot', 'self', 'Another Name');
  log.writeChatMsg('local', '@Pilot', 'sender', 'PILOT');
  log.writeChatMsg('local', '@Pilot', null, null);
  log.writeChatMsg('local', '@PilotSuffix', 'sender', 'Other');
  assert.equal(
    notifications,
    1,
    'own identity, own name, system messages and partial matches are silent',
  );
  log.writeChatMsg('local', '@Pilot', 'sender', 'Other');
  assert.equal(notifications, 2);
  const acceptedCount = received.length;

  log.writeChatMsg('local', '@Pilot '.repeat(40), 'sender', 'Sender');
  assert.equal(
    received.length,
    acceptedCount,
    'native length rejection happens before markup expansion',
  );
  assert.equal(notifications, 2);
  game.messageLog.updateTexts({ text: '@Pilot system message' });
  assert.equal(received.at(-1).pings, undefined, 'receive context cannot leak to system messages');
  cleanup.reverse().forEach((fn) => fn());
  log.writeChatMsg('local', '@Pilot', 'sender', 'Sender');
  assert.equal(received.at(-1).text, '[local] Sender: @Pilot');
});
