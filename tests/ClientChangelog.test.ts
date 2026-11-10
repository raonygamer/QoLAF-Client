import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ClientChangelogContent } from '../src/dialogs/ClientChangelogContent';
import { ClientChangelogTextChunks } from '../src/dialogs/ClientChangelogTextChunks';
import { RichBitmapMarkupParser } from '../src/chat/rich/RichBitmapMarkupParser';

test('all original changelog releases retain text and styling within bitmap block budgets', () => {
  const releases = new ClientChangelogContent('1.1.22', false).createReleases();
  assert.equal(releases.length, 23);
  assert.equal(releases[0].label, 'v1.1.22');
  assert.equal(releases.at(-1)!.label, 'v1.0.79 and older');
  assert.match(releases[0].content, /Soft KoS/);
  for (const release of releases) {
    const original = RichBitmapMarkupParser.parse(release.content, 12, 0xffffff);
    const blocks = ClientChangelogTextChunks.split(release.content).map((chunk) =>
      RichBitmapMarkupParser.parse(chunk, 12, 0xffffff),
    );
    assert.ok(blocks.every((block) => block.text.length <= 2000));
    assert.equal(blocks.map((block) => block.text).join(''), original.text, release.label);
    assert.deepEqual(
      blocks.flatMap((block) => block.colors),
      original.colors,
      release.label,
    );
    assert.deepEqual(
      blocks.flatMap((block) => block.sizes),
      original.sizes,
      release.label,
    );
  }
});

test('a long formatted archive word keeps a surrogate pair in one block', () => {
  const html = `<font color='#03b1fc' size='16'>${'a'.repeat(1999)}🚀${'b'.repeat(2001)}</font>`;
  const blocks = ClientChangelogTextChunks.split(html).map((chunk) =>
    RichBitmapMarkupParser.parse(chunk, 12, 0xffffff),
  );
  assert.equal(blocks[0].text.length, 1999);
  assert.ok(blocks[1].text.startsWith('🚀'));
  assert.equal(
    blocks.map((block) => block.text).join(''),
    'a'.repeat(1999) + '🚀' + 'b'.repeat(2001),
  );
  assert.ok(blocks.flatMap((block) => block.colors).every((color) => color === 0x03b1fc));
});
