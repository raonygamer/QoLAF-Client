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
  assert.match(pages[0].content, /1\.2\.0 TS \(Public\)/);
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

test('displayed automation example imports and runs through the browser module lifecycle', async () => {
  const { AutomationManager } = await import('../src/automation/AutomationManager');
  const page = new ClientHelpContent('1409', true)
    .createPages()
    .find((page) => page.label === 'Automations')!;
  const text = RichBitmapMarkupParser.parse(page.content, 12, 0xffffff).text.replace(
    /\u00a0/g,
    ' ',
  );
  const start = text.indexOf('export default class AutomationScript');
  assert.ok(start >= 0);
  const end = text.indexOf('\n}', start) + 2;
  const code = text.slice(start, end);
  const errors: unknown[] = [];
  const manager = new AutomationManager(
    { path: 'help-example', read: () => [], write() {} },
    {
      fetch: async () => code,
      compile: async (source) =>
        (await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64')))
          .default,
    },
    {
      registerOwnedCommand: (_owner, name) => name,
      unregisterOwnedCommand: () => true,
      unregisterOwner() {},
      unregisterNamespace() {},
    },
    123,
    (...args) => errors.push(args),
    () => {},
  );
  try {
    manager.attachGame({});
    const module = await manager.importCode(code, 'help', 'Example.js');
    assert.equal(module.initialized, true);
    assert.equal(manager.start('example'), true);
    manager.update(33);
    manager.render(8);
    manager.stop('example');
    assert.equal(module.running, false);
    assert.equal(module.lastError, '');
  } finally {
    manager.dispose();
  }
  assert.deepEqual(errors, []);
});

test('current command examples follow the supplied server version', () => {
  const text = new ClientHelpContent('1413', true)
    .createPages()
    .map((page) => page.content)
    .join('\n');
  assert.match(text, /Service-1413_0/);
  assert.match(text, /Service-1413_&lt;int&gt;/);
  assert.doesNotMatch(text, /Service-1409/);
});
