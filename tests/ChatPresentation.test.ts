import { clientEchoText } from '../src/chat/ClientEcho';
import { bindGameClasses } from '../src/game/Bindings';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ChatProfanityFilter } from '../src/chat/ChatProfanityFilter';
import { ChatWordBoundary } from '../src/chat/ChatWordBoundary';
import { TrustedMessengerPresentation as Relay } from '../src/chat/TrustedMessengerPresentation';
import { ChatArtifactToken } from '../src/chat/rich/ChatArtifactToken';
import { installNativeChatPresentation } from '../src/chat/NativeChatPresentation';
// @ts-expect-error extracted native writer
import { nativeChatWriter } from './fixtures/NativeChatWriter.js';
// @ts-expect-error native host hooks
import { Hooks } from './fixtures/HostCore.js';

test('source profanity filtering preserves tags, entity spans, opaque IDs and whole Unicode words', () => {
  const filter = new ChatProfanityFilter({ bad: true, 'bad word': true, 'a+b': true, 'x*': true });
  assert.equal(
    filter.apply('bad badge bad words BAD WORD a+b x*'),
    '*** badge *** words *** **** *** **',
  );
  assert.equal(
    filter.apply("<font color='bad'>b<b>a</b>d</font>"),
    "<font color='bad'>*<b>*</b>*</font>",
  );
  assert.equal(filter.apply('b&#97;d bad<br>word'), '*** ***<br>****');
  const token = ChatArtifactToken.encode('bad', 'bad');
  assert.equal(filter.apply(token + ' bad'), token + ' ***');
  assert.equal(
    filter.apply('ébad badé bad_ bad\u0301 bad中 𐐀bad bad𐐀 —bad—'),
    'ébad badé bad_ bad\u0301 bad中 𐐀bad bad𐐀 —***—',
  );
  assert.equal(new ChatProfanityFilter({ '𐐀': true }).apply('&#x10400;'), '**');
  assert.equal(new ChatProfanityFilter({ 'a|b': true }).apply('a b a|b'), 'a b ***');
  for (const text of ['a', '_', 'é', '\u0301', '中', '𐐀'])
    for (let index = 0; index < text.length; index++)
      assert.equal(ChatWordBoundary.isWordAt(text, index), true);
  for (const text of ['😀', '—', '\ud800', '\udc00'])
    for (let index = 0; index < text.length; index++)
      assert.equal(ChatWordBoundary.isWordAt(text, index), false);
});

test('relay recognition requires the exact ID, escapes content and retains additional whitespace', () => {
  assert.equal(Relay.format('pretender', 'A: hello'), null);
  assert.equal(Relay.format(Relay.playerId, 'ordinary'), null);
  assert.equal(Relay.format(Relay.playerId, 'D( ): body'), null);
  assert.equal(Relay.format(Relay.playerId, 'D(name\n): body'), null);
  assert.equal(
    Relay.format(Relay.playerId, 'D(A&B):  <x>'),
    "<font color='#aa66ff'>[discord]</font> A&amp;B:  &lt;x&gt;",
  );
  assert.equal(
    Relay.format(Relay.playerId, 'A: @Pilot 😀\n'),
    "<font color='#e879d0'>[announcement]: @Pilot 😀\n</font>",
  );
});

function fixture(t: { after(fn: () => void): void }) {
  const hooks = new Hooks();
  const cleanups: Function[] = [];
  const rows: any[] = [];
  const sent: { type: string; values: unknown[] }[] = [];
  let pings = 0;
  const me = {
    id: 'self',
    get_name: () => 'Pilot',
    get_team: () => 1,
    get_level: () => 1,
    getActiveFleetObj: () => null,
  };
  const players: Record<string, any> = {};
  const errors: any[] = [];
  const game: any = {
    sendToServiceRoom: (type: string, values: unknown[]) => sent.push({ type, values }),
    get_me: () => me,
    client: {
      connectUserId: 'self',
      errorLog: { writeError: (...args: any[]) => errors.push(args) },
    },
    solarSystem: { type: 'normal' },
    time: 100,
    playerManager: {
      get_playersById: () => ({ h: players }),
      get_players: () => Object.values(players),
    },
    messageLog: { updateTexts: (row: any) => rows.push(row) },
  };
  const dictionary = { bad: true, 'a+b': true };
  const log: any = {
    g: game,
    profanities: dictionary,
    textQueue: [],
    extendedMaxLines: 100,
    colorCoding: (text: string) => text,
    colorRights: (rights: string, text: string) => (rights ? '[' + rights + '] ' + text : text),
  };
  class Regex {
    regex: RegExp;
    constructor(pattern: string, flags: string) {
      this.regex = new RegExp(pattern, flags);
    }
    match(text: string) {
      return this.regex.test(text);
    }
    replace(text: string, replacement: string) {
      return text.replace(this.regex, replacement);
    }
  }
  log.writeChatMsg = nativeChatWriter(log, Regex);
  class Game {}
  Object.setPrototypeOf(game, Game.prototype);
  const api: any = {
    cls: (name: string) =>
      name === 'core.scene.Game' ? Game : name.endsWith('.MessageLog') ? log : {},
    around: (target: any, key: string, hook: Function) =>
      cleanups.push(hooks.add(target, key, 'around', hook)),
  };
  bindGameClasses(api);
  installNativeChatPresentation(api, game, () => pings++);
  t.after(() => cleanups.reverse().forEach((fn) => fn()));
  return { log, rows, sent, game, dictionary, players, errors, pings: () => pings };
}

test('native writer retains checks and metadata while source relay expansion may exceed the wire limit', (t) => {
  const f = fixture(t);
  f.log.writeChatMsg('global', 'D(Name): <bad> @Pilot', Relay.playerId, 'Bot');
  const row = f.rows[0];
  assert.match(row.text, /^<font color='#aa66ff'>\[discord\]<\/font> Name: &lt;\*\*\*&gt;/);
  assert.doesNotMatch(row.text, /\[global\]|Bot:/);
  assert.equal(row.type, 'global');
  assert.equal(row.playerKey, Relay.playerId);
  assert.equal(row.playerId, Relay.playerId);
  assert.equal(row.playerName, 'Bot');
  assert.equal(f.pings(), 1);
  f.log.writeChatMsg('qolaf', 'A: @Pilot', Relay.playerId, 'Bot');
  assert.match(f.rows[1].text, /^\[qolaf\]/);
  assert.match(f.rows[1].text, /color='#e879d0'>@Pilot/);
  f.log.writeChatMsg('global', 'A: ' + '&'.repeat(240), Relay.playerId, 'Bot');
  assert.ok(f.rows[2].text.length > 250);
  f.log.writeChatMsg('global', 'A: ' + '&'.repeat(250), Relay.playerId, 'Bot');
  assert.equal(f.rows.length, 3);
  assert.equal(f.errors.length, 1);
  assert.equal(f.log.profanities, f.dictionary);
  f.game.solarSystem.type = 'pvp dom';
  f.players[Relay.playerId] = { get_team: () => 2, get_name: () => 'Bot' };
  f.log.writeChatMsg('local', 'A: @Pilot', Relay.playerId, 'Bot');
  assert.equal(f.rows.length, 3);
  assert.equal(f.pings(), 2);
});

test('native badges derive from IDs, retain staff rights, and cannot be granted by display name', (t) => {
  const f = fixture(t);
  f.log.writeChatMsg('local', 'b<b>a</b>d', 'simple1789865760026', 'Developer');
  assert.match(f.rows[0].text, /#ff6666'>\[client_dev\]<\/FONT> Developer: \*<b>\*<\/b>\*/);
  f.log.writeChatMsg('local', 'hello', 'simple1789865760026', 'Developer', 'mod');
  assert.match(f.rows[1].text, /\[mod\]/);
  assert.doesNotMatch(f.rows[1].text, /client_dev/);
  f.log.writeChatMsg('local', 'hello', 'other', 'simple1789865760026');
  assert.doesNotMatch(f.rows[2].text, /client_dev/);
  f.log.writeChatMsg('local', 'hello', 'simple1744094288719', 'Peer', '', true);
  assert.match(
    f.rows[3].text,
    /\[grinder\]<\/FONT> <font color='#ffff66'>&#11088;<\/font> Peer: hello/,
  );
  f.log.writeChatMsg('global', 'D(Name): hello', 'other', 'Bot');
  assert.equal(f.rows[4].text, '[global] Bot: D(Name): hello');
  f.log.writeChatMsg('local', 'hello', 'other', '');
  assert.equal(f.rows[5].text, '[local] hello');
});

test('native filter bypass and receive context restore across nested delivery and exceptions', (t) => {
  const f = fixture(t);
  const original = f.game.messageLog.updateTexts;
  let nested = false;
  f.game.messageLog.updateTexts = (row: any) => {
    if (!nested) {
      nested = true;
      f.log.writeChatMsg('local', 'bad', 'other', 'Other');
    }
    original(row);
  };
  f.log.writeChatMsg('global', 'A: bad', Relay.playerId, 'Bot');
  assert.equal(f.rows[0].text, '[local] Other: ***');
  assert.match(f.rows[1].text, /announcement.*\*\*\*/);
  assert.equal(f.log.profanities, f.dictionary);
  f.game.messageLog.updateTexts = () => {
    throw new Error('renderer failed');
  };
  assert.throws(() => f.log.writeChatMsg('local', 'bad', 'other', 'Other'), /renderer failed/);
  assert.equal(f.log.profanities, f.dictionary);
  assert.equal(f.log.colorRights('', 'ordinary'), 'ordinary');
  assert.equal(f.log.colorCoding('[global]'), '[global]');
});

test('exact echo requests retain source channel routing and precede team filtering', (t) => {
  const f = fixture(t);
  for (const channel of ['global', 'private']) {
    f.log.writeChatMsg(channel, 'echo.', 'other', 'Other');
    assert.deepEqual(f.sent.at(-1), {
      type: 'chatMsg',
      values: ['private', 'Other', clientEchoText()],
    });
  }
  for (const channel of ['local', 'team', 'group']) {
    f.log.writeChatMsg(channel, 'echo.', 'other', 'Other');
    assert.deepEqual(f.sent.at(-1), { type: 'chatMsg', values: ['local', clientEchoText()] });
  }
  const count = f.sent.length;
  f.log.writeChatMsg('global', 'echo.', 'self', 'Pilot');
  for (const text of ['Echo.', 'echo', ' echo.', 'echo. ', 'echo.' + 'x'.repeat(251)])
    f.log.writeChatMsg('global', text, 'other', 'Other');
  assert.equal(f.sent.length, count);
  f.game.solarSystem.type = 'pvp dom';
  f.players.enemy = { get_team: () => 2, get_name: () => 'Enemy' };
  const rows = f.rows.length;
  f.log.writeChatMsg('local', 'echo.', 'enemy', 'Enemy');
  assert.equal(f.sent.length, count + 1);
  assert.equal(f.rows.length, rows, 'native opposing-team message remains filtered');
});

test('native death and system rows may omit sender fields without producing player replies', (t) => {
  const f = fixture(t);
  f.log.writeChatMsg('death', "<FONT COLOR='#ff4444'>Pilot has died.</FONT>");
  assert.equal(f.rows.length, 1);
  assert.match(f.rows[0].text, /Pilot has died/);
  assert.doesNotMatch(f.rows[0].text, /undefined|null/);
  f.log.writeChatMsg('global', 'echo.');
  f.log.writeChatMsg('private', 'echo.', null, null);
  assert.deepEqual(f.sent, []);
  assert.deepEqual(f.errors, []);
  assert.equal(f.pings(), 0);
  assert.equal(f.log.profanities, f.dictionary);
});
