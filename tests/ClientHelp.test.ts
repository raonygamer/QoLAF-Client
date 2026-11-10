import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ClientHelpContent } from '../src/dialogs/ClientHelpContent';
import { ClientChangelogTextChunks } from '../src/dialogs/ClientChangelogTextChunks';
import { RichBitmapMarkupParser } from '../src/chat/rich/RichBitmapMarkupParser';

test('source guide retains its tabs and long colored pages within bitmap limits', () => {
  const pages = new ClientHelpContent('1409', true).createPages();
  assert.deepEqual(
    pages.map((page) => page.label),
    [
      'Start',
      'Commands',
      'Targeting',
      'Aim Assist',
      'Ship visuals',
      'Automations',
      'QoL / settings',
    ],
  );
  assert.match(pages[0].content, /TypeScript port/);
  assert.match(pages[0].content, /server 1409/);
  assert.match(pages[0].content, /Port in development/);
  for (const page of pages) {
    const expected = RichBitmapMarkupParser.parse(page.content, 12, 0xffffff);
    const chunks = ClientChangelogTextChunks.split(page.content).map((chunk) =>
      RichBitmapMarkupParser.parse(chunk, 12, 0xffffff),
    );
    assert.ok(chunks.every((chunk) => chunk.text.length <= 2000));
    assert.equal(chunks.map((chunk) => chunk.text).join(''), expected.text, page.label);
    assert.deepEqual(
      chunks.flatMap((chunk) => chunk.colors),
      expected.colors,
      page.label,
    );
  }
  assert.equal(new ClientHelpContent('1409', false).createPages().length, 6);
});

test('custom command guide preserves aliases and escapes plugin-supplied metadata', () => {
  const pages = new ClientHelpContent('1409', true, [
    {
      fullName: 'test:run',
      ownsBareName: true,
      usage: ' <file>',
      description: '<font color="#ff0000">literal</font>',
      mandatory: [{ name: 'file', description: 'A <path>', hasDefault: false }],
      optional: [
        { name: 'mode', description: 'Quiet & fast', hasDefault: true, defaultValue: '<auto>' },
      ],
      allowExtraArguments: true,
    },
  ]).createPages();
  const commands = pages.find((page) => page.label === 'Commands')!.content;
  assert.match(commands, /\/run \(also \/test:run\) &lt;file&gt;/);
  assert.match(commands, /&lt;font color=&quot;#ff0000&quot;&gt;literal&lt;\/font&gt;/);
  assert.match(commands, /required file - A &lt;path&gt;/);
  assert.match(commands, /default &lt;auto&gt;/);
  assert.match(commands, /extra arguments allowed/);
});
