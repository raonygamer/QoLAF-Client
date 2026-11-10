import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { EmojiShortcodeCatalog as Catalog } from '../src/chat/EmojiShortcodeCatalog';
import { EmojiPickerCatalog } from '../src/chat/EmojiPickerCatalog';
import { ChatEmojiAutocompleteModel } from '../src/chat/ChatEmojiAutocompleteModel';

const hash = (values: unknown[]) =>
  createHash('sha256').update(JSON.stringify(values)).digest('hex');

test('all CLDR names, canonical shortcodes and search terms match original generated source', () => {
  const indices = Array.from({ length: 1391 }, (_, index) => index);
  assert.equal(Catalog.ENTRY_COUNT, 1391);
  // Golden hashes independently computed from the original AS3 literal arrays.
  assert.equal(
    hash(indices.map((i) => Catalog.shortNameAt(i))),
    '3e3b9f8a90e26a2f11d4a1a4e81064847e66c52a468c0524c9a874df2a300453',
  );
  assert.equal(
    hash(indices.map((i) => Catalog.shortcodeAt(i))),
    'f122e963e9dc8587175d67f046c9864fffd0e5ce3e402f08385bcc6bedc3db77',
  );
  assert.equal(
    hash(indices.map((i) => Catalog.searchTermsAt(i))),
    'ca6c43218e004fa7872c210257f75792476a8fcd62bd22b502b8af242f323ba9',
  );
  for (const index of indices) {
    assert.equal(Catalog.findExact(Catalog.shortcodeAt(index)), index);
    assert.equal(Catalog.scalarAt(index), EmojiPickerCatalog.scalarAtFlat(index));
    assert.ok(Catalog.emojiAt(index).length > 0);
  }
  for (const [alias, index] of [
    ['+1', 190],
    ['-1', 191],
    ['thumbsdown', 191],
    ['thumbsup', 190],
  ] as const) {
    assert.equal(Catalog.findExact(alias), index);
    assert.equal(Catalog.matchRankAt(index, alias), 0);
  }
  assert.equal(Catalog.findExact(''), -1);
  assert.equal(Catalog.scalarAt(-1), 0);
  assert.equal(Catalog.emojiAt(1391), '');
});

test('emoji ranking preserves picker order, cached suggestions and wraparound selection', () => {
  const model = new ChatEmojiAutocompleteModel(5);
  assert.equal(model.update(''), true);
  assert.deepEqual(
    model.matches.map((m) => m.commandName),
    [0, 1, 2, 3, 4].map((i) => Catalog.shortcodeAt(i)),
  );
  const first = model.selectedSuggestion;
  assert.equal(first?.displayCommand, ':grinning_face:');
  assert.equal(first?.completionText, Catalog.emojiAt(0));
  assert.equal(first?.emojiScalar, Catalog.scalarAt(0));
  model.selectPrevious();
  assert.equal(model.selectedIndex, 4);
  model.selectNext();
  assert.equal(model.selectedIndex, 0);
  model.selectIndex(20);
  assert.equal(model.selectedIndex, 0);
  model.matches.length = 0;
  assert.equal(model.matches.length, 5);
  model.update('GRINNING_FACE');
  assert.equal(model.selectedSuggestion, first);
  model.update('thumbsup');
  assert.equal(model.complete(), Catalog.emojiAt(190));
  model.update('totally_no_such_emoji');
  assert.equal(model.active, false);
  assert.equal(model.complete(), null);
  model.update(null);
  assert.equal(model.query, '');
  assert.equal(model.selectedIndex, -1);
  const all = new ChatEmojiAutocompleteModel(1391);
  all.update('face');
  const ranks = all.matches.map((m) =>
    Catalog.matchRankAt(Catalog.findExact(m.commandName), 'face'),
  );
  assert.deepEqual(
    ranks,
    [...ranks].sort((a, b) => a - b),
  );
  assert.equal(Catalog.matchRankAt(0, 'grinning_face'), 0);
  assert.equal(Catalog.matchRankAt(0, 'grinning'), 1);
  assert.equal(Catalog.matchRankAt(0, 'face'), 2);
  assert.equal(Catalog.matchRankAt(0, 'cheerful'), 3);
  assert.equal(Catalog.matchRankAt(0, 'cheer'), 4);
  assert.equal(Catalog.matchRankAt(0, 'inning'), 5);
  assert.equal(Catalog.matchRankAt(0, 'eerfu'), 6);
  assert.equal(Catalog.findExact('cheerful'), -1); // Keyword search must not become an exact alias.
});
