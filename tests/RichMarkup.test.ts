import { readFileSync } from 'node:fs';
import { test } from 'node:test';
// @ts-expect-error test-only execution of original AS3 method bodies
import { install } from './fixtures/As3Methods.js';
import { ChatArtifactToken } from '../src/chat/rich/ChatArtifactToken';
import { ChatArtifactTokenRegistry } from '../src/chat/rich/ChatArtifactTokenRegistry';
import { RichBitmapMarkup } from '../src/chat/rich/RichBitmapMarkup';
import { RichBitmapMarkupParser } from '../src/chat/rich/RichBitmapMarkupParser';
import { RichBitmapMarkupSerializer } from '../src/chat/rich/RichBitmapMarkupSerializer';

// Run the original assertions against the TypeScript classes. The helper only
// strips AS3 type syntax. The fixture documents one corrected entity-length
// typo, verified against the original parser itself; formatting assertions are unchanged.
const original = readFileSync(
  new URL('./fixtures/OriginalMarkupContract.as', import.meta.url),
  'utf8',
);
const methods = [...original.matchAll(/private (?:static )?function (\w+)\(/g)]
  .map((match) => match[1])
  .filter((name) => name !== 'run');
for (const name of methods.filter((name) => name.startsWith('test'))) {
  test('original rich-text contract: ' + name, () => {
    const suite = install(
      {
        DEFAULT_SIZE: 13,
        DEFAULT_COLOR: 0xffffff,
        ChatArtifactToken,
        ChatArtifactTokenRegistry,
        RichBitmapMarkup,
        RichBitmapMarkupParser,
        RichBitmapMarkupSerializer,
        getTimer: () => performance.now(),
      },
      original,
      methods,
    );
    suite[name]();
  });
}
