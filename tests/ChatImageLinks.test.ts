import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ChatDiscordImageLink as Link } from '../src/chat/ChatDiscordImageLink';
import { ChatImageShortcutStore as Store } from '../src/chat/ChatImageShortcutStore';
import type { API } from '../src/api/Types';

test('image links retain source offsets and signed URLs while excluding markup attributes', () => {
  const url = 'https://cdn.discordapp.com/attachments/a/cat%20face.PNG?ex=123&amp;hm=abc';
  const text = `<font color='https://hidden.invalid/x.png'>See (${url}).</font>`;
  const link = Link.firstIn(text)!;
  assert.equal(link.rawUrl, url);
  assert.equal(text.substring(link.sourceBegin, link.sourceEnd), url);
  assert.equal(link.fileName, 'cat face.PNG');
  assert.equal(Link.firstIn('<a href="https://hidden.invalid/x.png">nothing</a>'), null);
  assert.equal(Link.firstIn('<broken https://hidden.invalid/x.png'), null);
  assert.equal(
    Link.firstIn('https://a.test/page then http://b.test/yes.gif')?.rawUrl,
    'http://b.test/yes.gif',
  );
  assert.equal(Link.parseAt('https://a.test/a(1).webp)', 0), null);
  assert.equal(Link.parseAt('(https://a.test/a.webp)', 1)?.rawUrl, 'https://a.test/a.webp');
  for (const value of [
    'ftp://a.test/a.png',
    'https://a.test/page',
    'https://a.test/a.svg',
    'https://a.test/a.png/next',
  ])
    assert.equal(Link.parseAt(value, 0), null);
  assert.equal(Link.parseAt('https://a.test/' + 'a'.repeat(4096) + '.png', 0), null);
});

test('source image fallbacks preserve authentication and original-first order', () => {
  const original =
    'https://cdn.discordapp.com/attachments/a/b.gif?ex=123&amp;hm=abc&width=10&height=20&format=webp&animated=true&quality=lossless';
  assert.deepEqual(Link.parseAt(original, 0)!.candidateUrls(5000, 1), [
    original.replace('&amp;', '&'),
    'https://media.discordapp.net/attachments/a/b.gif?ex=123&hm=abc&width=4096&height=16&format=png',
  ]);
  assert.deepEqual(Link.parseAt('https://i.imgur.com/a.webp?x=y', 0)!.candidateUrls(100, 100), [
    'https://i.imgur.com/a.webp?x=y',
    'https://i.imgur.com/a.png?x=y',
  ]);
  assert.deepEqual(Link.parseAt('https://media2.tenor.com/a.webp', 0)!.candidateUrls(100, 100), [
    'https://media2.tenor.com/a.webp',
    'https://media2.tenor.com/a.gif',
  ]);
  assert.deepEqual(Link.parseAt('https://example.test/a.webp', 0)!.candidateUrls(100, 100), [
    'https://example.test/a.webp',
  ]);
  assert.equal(Link.isEmbedChannel('CLAN'), true);
  assert.equal(Link.isEmbedChannel('private'), true);
  assert.equal(Link.isEmbedChannel('qolaf'), true);
  for (const mode of ['local', 'global', 'group', 'privateSaved', null])
    assert.equal(Link.isEmbedChannel(mode), false);
  assert.equal(
    Link.simpleLabelMarkup('a https://x.test/a.png; b http://x.test/b.gif!'),
    "a <font color='#66d5ff'>[Image]</font>; b <font color='#66d5ff'>[Image]</font>!",
  );
});

function memory(initial: unknown = []) {
  let saved = initial;
  const storage: API['storage'] = {
    get: <T>(_key: string, _fallback: T) => structuredClone(saved) as T,
    set: (_key, value) => {
      saved = structuredClone(value);
    },
  };
  return storage;
}

test('shortcuts normalize, sort, persist, reload and reject partial image URLs', () => {
  const storage = memory();
  const warmed: string[] = [];
  const store = new Store(storage, (link) => warmed.push(link.rawUrl));
  assert.equal(store.save(' Zed ', ' https://x.test/z.gif '), null);
  assert.equal(store.save('a_+-', 'https://x.test/a.png?token=signed'), null);
  assert.deepEqual(
    store.entries().map((entry) => entry.name),
    ['a_+-', 'zed'],
  );
  assert.equal(store.resolve(' ZED '), 'https://x.test/z.gif');
  assert.equal(warmed.length, 2);
  assert.match(store.save('bad name', 'https://x.test/a.png')!, /Shortcut must/);
  assert.match(store.save('bad', 'https://x.test/a.png extra')!, /direct HTTP/);
  assert.match(store.save('bad', 'https://x.test/a.png.')!, /direct HTTP/);
  assert.equal(warmed.length, 2);
  const entries = store.entries();
  entries[0].url = 'changed';
  assert.equal(store.resolve('a_+-'), 'https://x.test/a.png?token=signed');
  const reloaded = new Store(storage, () => {});
  assert.deepEqual(reloaded.entries(), store.entries());
  assert.equal(reloaded.remove(' ZED '), true);
  assert.equal(reloaded.remove('missing'), false);
  assert.equal(new Store(storage, () => {}).resolve('zed'), null);
});

test('shortcut limit allows replacing existing entries and tolerates unavailable storage', () => {
  const storage = memory([
    null,
    { name: 3, url: 'x' },
    { name: 'bad name', url: 'https://x.test/a.png' },
    { name: 'bad', url: 'https://x.test/a.png junk' },
  ]);
  const store = new Store(storage, () => {});
  assert.deepEqual(store.entries(), []);
  for (let i = 0; i < 64; i++) assert.equal(store.save(`n${i}`, 'https://x.test/a.png'), null);
  assert.match(store.save('overflow', 'https://x.test/a.png')!, /limit reached/);
  assert.equal(store.save('N0', 'https://x.test/b.gif'), null);
  assert.equal(store.entries().length, 64);
  assert.equal(new Store(storage, () => {}).resolve('n0'), 'https://x.test/b.gif');
  const unavailable = new Store(
    {
      get() {
        throw Error('denied');
      },
      set() {
        throw Error('quota');
      },
    },
    () => {},
  );
  assert.equal(unavailable.save('__proto__', 'https://x.test/a.png'), null);
  assert.equal(unavailable.resolve('__proto__'), 'https://x.test/a.png');
  assert.equal(unavailable.remove('__proto__'), true);
});
