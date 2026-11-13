import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
// @ts-expect-error actual host lifecycle and hook dispatcher
import { PluginHost } from './fixtures/HostCore.js';
import { Game, registry } from './fixtures/NativeGame';
// @ts-expect-error captured upstream SDK encoder
import { bytesFromString } from './fixtures/PlayerIOUnicode.js';

const plugin = (await import(pathToFileURL(process.cwd() + '/dist/qolaf-client.js').href)).default;

for (const missingSDK of [true, false])
  test(`missing ${missingSDK ? 'SDK encoder' : 'native class'} cannot attach a partial game session or start font work`, async (t) => {
    const previousSDK = Object.getOwnPropertyDescriptor(globalThis, '_pio');
    Object.defineProperty(globalThis, '_pio', {
      configurable: true,
      writable: true,
      value: missingSDK ? undefined : { binaryserializer: { bytesFromString } },
    });
    t.after(() => {
      if (previousSDK) Object.defineProperty(globalThis, '_pio', previousSDK);
      else Reflect.deleteProperty(globalThis, '_pio');
    });
    const errors: unknown[][] = [];
    const host = new PluginHost({
      storage: { getItem: () => null, setItem() {} },
      importer: async () => ({ default: plugin }),
      log: {
        info: (...args: unknown[]) => errors.push(args),
        error: (...args: unknown[]) => errors.push(args),
      },
    });
    t.after(() => host.dispose());
    await host.load('https://example.com/client.js');
    const classes = registry();
    // Deliberately absent native class models an incompatible upstream update.
    delete classes['starling.filters.FragmentFilter'];
    const text = classes['starling.text.TextField'];
    const originalFont = { name: 'original-font' };
    text.registerBitmapFont(originalFont, 'DAIDRR');
    host.classesReady(classes);
    const game = new Game();
    const children = [...game.hud.container.children];
    host.created(game);
    game.runGameLoop();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(errors.length, 1, 'report the setup failure without a second session exception');
    assert.match(
      String(errors[0][1]),
      missingSDK ? /PlayerIO string serializer is unavailable/ : /starling.filters.FragmentFilter/,
    );
    assert.deepEqual(game.hud.container.children, children);
    assert.equal(Object.hasOwn(game, 'targetSystem'), false);
    assert.equal(text.getBitmapFont('DAIDRR'), originalFont);
  });
