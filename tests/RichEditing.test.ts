import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RichBitmapTextNavigation as Navigation } from '../src/chat/rich/RichBitmapTextNavigation';
import { RichBitmapEmojiResolver as Emoji } from '../src/chat/rich/RichBitmapEmojiResolver';
import { RichBitmapMarkupParser as Parser } from '../src/chat/rich/RichBitmapMarkupParser';
import { RichBitmapTypedMarkup as TypedMarkup } from '../src/chat/rich/RichBitmapTypedMarkup';
import { ChatDiscordImageLink } from '../src/chat/ChatDiscordImageLink';

const plain = (value: string) =>
  Parser.parse(
    value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
    13,
    0xffffff,
  );

test('source editing boundaries preserve emoji selectors, joined sequences, flags and malformed surrogates', () => {
  for (const cluster of ['😀', '☀️', '👨‍👩‍👧', '👍🏽', '🇧🇷']) {
    const value = 'A' + cluster + 'B';
    assert.equal(Navigation.nextBoundary(value, 1), 1 + cluster.length);
    assert.equal(Navigation.previousBoundary(value, 1 + cluster.length), 1);
    for (let i = 2; i < 1 + cluster.length; i++) {
      assert.equal(Navigation.isBoundary(value, i), false);
      assert.equal(Navigation.snapBackward(value, i), 1);
      assert.equal(Navigation.snapForward(value, i), 1 + cluster.length);
    }
  }
  assert.equal(Navigation.nextBoundary('\ud83dX', 0), 1);
  assert.equal(Emoji.resolve('☀', 0).isEmoji, false);
  assert.equal(Emoji.resolve('☀️', 0).isEmoji, true);
  assert.equal(Emoji.resolve('😀︎', 0).isEmoji, false);
  assert.equal(Emoji.resolve('🏽', 0).isIgnored, true);
});

test('typed markup promotes a completed edited fragment and preserves literal untouched markup', () => {
  const text = '<font color="#f00">red</font>';
  const previous = plain(text.slice(0, -1));
  const candidate = plain(text);
  const result = TypedMarkup.promote(
    candidate,
    previous,
    text.length - 1,
    text.length - 1,
    text.length,
    13,
    0xffffff,
  );
  assert.ok(result);
  assert.equal(result.markup.text, 'red');
  assert.deepEqual(result.markup.colors, [0xff0000, 0xff0000, 0xff0000]);
  assert.equal(result.caret, 3);
  assert.equal(TypedMarkup.promote(candidate, candidate, 0, 0, 0, 13, 0xffffff), null);
  const invalid = plain('<unknown><font color="#f00">red</font></unknown>');
  assert.equal(
    TypedMarkup.promote(invalid, plain(''), 0, 0, invalid.text.length, 13, 0xffffff),
    null,
  );
});

test('artifact colors keep AS3 uint conversion and image links retain original source boundaries', () => {
  const artifact = Parser.parse('$artifact:player:item$', 13, 0xffffff, null, () => ({
    label: 'item',
    color: 0xffaa44 + 0.5,
  }));
  assert.equal(artifact.atoms[0].displayColor, 0xffaa44);
  const source = 'Look https://example.org/image.png?x=1&amp;y=2.';
  const link = ChatDiscordImageLink.firstIn(source)!;
  assert.ok(link);
  assert.equal(link.rawUrl, 'https://example.org/image.png?x=1&amp;y=2');
  assert.equal(source.slice(link.sourceBegin, link.sourceEnd), link.rawUrl);
  const projected = Parser.parse(source, 13, 0xffffff, null, null, false, true);
  assert.equal(projected.text, 'Look [Image].');
  assert.equal(projected.copyTextForVisibleRange(5, 12), link.rawUrl);
});
