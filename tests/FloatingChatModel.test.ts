import assert from 'node:assert/strict';
import test from 'node:test';
import { FloatingChatModel, type FloatingChatHost } from '../src/chat/FloatingChatModel';
import { FloatingChatLayout } from '../src/chat/FloatingChatLayout';

function fixture() {
  const sent: unknown[][] = [],
    selected: unknown[][] = [],
    rendered: any[] = [];
  let clears = 0;
  const host: FloatingChatHost = {
    playerId: () => 'self',
    canModerate: () => false,
    knownPlayerNames: () => ['First', 'First Last', 'Zed'],
    maxLines: () => 3,
    formatRow: (type, text, id, name) =>
      text.length > 250 ? null : { type, text, playerId: id, playerName: name },
    append: (row) => rendered.push(row),
    clear: () => {
      clears++;
    },
    selectChannel: (...args) => {
      selected.push(args);
    },
    send: (...args) => {
      sent.push(args);
      return true;
    },
  };
  const model = new FloatingChatModel(host);
  return { model, host, sent, selected, rendered, clears: () => clears };
}
function packet(channel: string, body: string, id = 'other', name = 'Someone') {
  const fields = [channel, body, id, name, '', false];
  return {
    length: fields.length,
    getString: (i: number) => String(fields[i]),
    getBoolean: (i: number) => Boolean(fields[i]),
  };
}

test('floating commands remain isolated and preserve source channel selection semantics', () => {
  const f = fixture();
  for (const [command, mode] of [
    ['L', 'local'],
    ['global', 'global'],
    ['c', 'clan'],
    ['grp', 'group'],
  ]) {
    assert.equal(f.model.send('/' + command, 'local', null), true);
    assert.deepEqual(f.selected.at(-1), [mode, null]);
  }
  assert.equal(f.sent.length, 0, 'selecting a channel sends nothing');
  assert.equal(f.model.send('/go secret', 'local', null), false);
  assert.equal(f.model.send('/warp sol', 'local', null), false);
  assert.equal(f.model.send('/help', 'local', null), true);
  assert.equal(f.sent.length, 0);
  assert.equal(f.model.send('ordinary /warp text', 'local', null), true);
  assert.deepEqual(f.sent[0], ['local', 'ordinary /warp text', null]);
});

test('whispers use quoted or longest known names without consuming message content', () => {
  const f = fixture();
  for (const value of [
    '@first last hello there',
    '"@First Last" hello there',
    "@'First Last' hello there",
  ])
    assert.deepEqual(f.model.parsePrivateTarget(value), {
      target: 'First Last',
      body: 'hello there',
    });
  assert.deepEqual(f.model.parsePrivateTarget('@Firster hi'), { target: 'Firster', body: 'hi' });
  assert.equal(f.model.send('/w @First Last hi @Zed', 'local', null), true);
  assert.deepEqual(f.sent[0], ['private', 'hi @Zed', 'First Last']);
  assert.deepEqual(f.selected[0], ['privateSaved', 'First Last']);
});

test('reply belongs to the floating inbox and malformed or rejected rows cannot replace it', () => {
  const f = fixture();
  assert.equal(f.model.send('/r hello', 'local', null), false);
  f.model.receive(packet('private', 'hello', 'other', 'First Last'));
  f.model.receive(packet('private', 'echo', 'self', 'Me'));
  f.model.receive(packet('private', 'x'.repeat(251), 'third', 'Wrong'));
  f.model.receive({
    length: 6,
    getBoolean: () => assert.fail('Malformed string should abort row decoding first'),
    getString: () => {
      throw Error('malformed');
    },
  });
  f.model.receive(packet('unknown', 'ignored'));
  assert.equal(f.model.send('/reply welcome', 'local', null), true);
  assert.deepEqual(f.sent[0], ['private', 'welcome', 'First Last']);
  const separate = fixture();
  assert.equal(separate.model.send('/r nope', 'local', null), false);
  assert.equal(f.model.send('/clearchat', 'local', null), true);
  assert.equal(f.model.messages.length, 0);
  assert.equal(f.clears(), 1);
  assert.equal(f.model.send('/r still remembered', 'local', null), true);
});

test('retention, escaped status, and disposal stay local to the window', () => {
  const f = fixture();
  for (let i = 0; i < 5; i++) f.model.receive(packet('local', String(i)));
  assert.deepEqual(
    f.model.messages.map((row) => row.text),
    ['2', '3', '4'],
  );
  f.model.status('<bad&>', true);
  assert.equal(f.model.messages.at(-1)!.text, "<font color='#ff8d85'>&lt;bad&amp;&gt;</font>");
  f.model.dispose();
  f.model.receive(packet('local', 'late'));
  assert.equal(f.model.messages.length, 0);
  assert.equal(f.model.send('late', 'global', null), false);
});

test('floating geometry matches source dimensions and fits small stages without scaling', () => {
  const layout = new FloatingChatLayout(1);
  assert.deepEqual([layout.x, layout.y, layout.width, layout.height], [108, 98, 680, 460]);
  const content = layout.content(80);
  assert.deepEqual(
    [content.viewX, content.viewY, content.viewWidth, content.viewHeight, content.composerY],
    [8, 36, 664, 324, 362],
  );
  layout.constrain(320, 200);
  assert.deepEqual([layout.x, layout.y, layout.width, layout.height], [0, 0, 320, 200]);
  layout.constrain(1920, 1080);
  assert.deepEqual([layout.width, layout.height], [360, 240]);
});
