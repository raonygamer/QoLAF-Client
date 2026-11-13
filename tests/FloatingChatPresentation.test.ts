import { bindGameClasses } from '../src/game/Bindings';
import assert from 'node:assert/strict';
import test from 'node:test';
import { createFloatingChatFormatter } from '../src/chat/FloatingChatPresentation';
import { TrustedMessengerPresentation } from '../src/chat/TrustedMessengerPresentation';

function fixture() {
  const rightsSeen: string[] = [];
  const log = {
    profanities: {},
    writeChatMsg: () => assert.fail('auxiliary formatting must not dispatch main chat'),
    colorRights: (rights: string, text: string) => {
      rightsSeen.push(rights);
      return text;
    },
    colorCoding: (text: string) => text,
  };
  class Game {}
  const api: any = {
    cls: (name: string) =>
      name === 'core.scene.Game' ? Game : name.endsWith('MessageLog') ? log : {},
  };
  const game = {
    get_me: () => ({
      id: 'self',
      get_name: () => 'Me',
      get_level: () => 1,
      getActiveFleetObj: () => null,
    }),
    client: { connectUserId: 'self' },
  };
  Object.setPrototypeOf(game, Game.prototype);
  bindGameClasses(api);
  return { format: createFloatingChatFormatter(api, game), rightsSeen };
}

test('floating presentation retains source supporter, escaped identity, role and ping metadata', () => {
  const f = fixture();
  const row = f.format('local', 'Hello @Me', 'other', '<Someone&>', '', true)!;
  assert.match(
    row.text,
    /^\[local\] <font color='#ffff66'>&#11088;<\/font> &lt;Someone&amp;&gt;: Hello /,
  );
  assert.equal(row.playerId, 'other');
  assert.equal(row.playerKey, 'other');
  assert.equal(row.playerName, '<Someone&>');
  assert.equal(row.pings.length, 1);
  assert.equal(row.pings[0].playerId, 'self');
  f.format('local', 'hi', 'steam76561199032900322', 'Dev', '', false);
  assert.equal(f.rightsSeen.at(-1), 'client_dev');
  assert.equal(f.format('local', 'x'.repeat(251), 'other', 'Name', '', false), null);
});

test('trusted relay presentation uses wire identity and omits only its global channel prefix', () => {
  const f = fixture();
  const row = f.format(
    'global',
    'A: <notice>',
    TrustedMessengerPresentation.playerId,
    'Relay',
    '',
    false,
  )!;
  assert.equal(row.text, "<font color='#e879d0'>[announcement]: &lt;notice&gt;</font>");
  assert.match(
    f.format('local', 'A: notice', TrustedMessengerPresentation.playerId, 'Relay', '', false)!.text,
    /^\[local\]/,
  );
  assert.equal(
    f.format('global', 'A: notice', 'impostor', 'Relay', '', false)!.text,
    '[global] Relay: A: notice',
  );
});
