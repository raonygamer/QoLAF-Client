import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readClipboardText, writeClipboardText } from '../src/ui/Clipboard';

test('clipboard uses native bridge, synchronous browser copy, then standards API', async () => {
  const names = ['window', 'document', 'HTMLElement', 'navigator'] as const;
  const descriptors = new Map(
    names.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
  );
  const set = (name: string, value: unknown) =>
    Object.defineProperty(globalThis, name, { configurable: true, value });
  const copied: string[] = [];
  class Element {
    value = '';
    style = { cssText: '' };
    focused = false;
    removed = false;
    focus() {
      this.focused = true;
    }
    select() {}
    remove() {
      this.removed = true;
    }
  }
  const focused = new Element();
  let input = new Element();
  let legacySucceeds = true;
  let asyncCalls = 0;
  try {
    set('window', {
      qolafClipboard: {
        writeText: async (text: string) => {
          copied.push(text);
        },
        readText: async () => 'native paste',
      },
    });
    set('navigator', {
      clipboard: {
        writeText: async (text: string) => {
          asyncCalls++;
          copied.push(text);
        },
        readText: async () => 'browser paste',
      },
    });
    set('HTMLElement', Element);
    set('document', {
      activeElement: focused,
      getSelection: () => null,
      createElement: () => (input = new Element()),
      body: { appendChild() {} },
      execCommand: (command: string) => {
        assert.equal(command, 'copy');
        if (legacySucceeds) copied.push(input.value);
        return legacySucceeds;
      },
    });
    await writeClipboardText('native 😀');
    assert.equal(await readClipboardText(), 'native paste');
    assert.equal(asyncCalls, 0);
    set('window', {});
    await writeClipboardText('browser legacy');
    assert.equal(input.removed, true);
    assert.equal(focused.focused, true);
    assert.equal(asyncCalls, 0);
    legacySucceeds = false;
    await writeClipboardText('browser async');
    assert.equal(asyncCalls, 1);
    assert.equal(await readClipboardText(), 'browser paste');
    assert.deepEqual(copied, ['native 😀', 'browser legacy', 'browser async']);
    set('navigator', {});
    await assert.rejects(writeClipboardText('unavailable'), /unavailable/);
    await assert.rejects(readClipboardText(), /Ctrl\+V/);
  } finally {
    for (const name of names) {
      const descriptor = descriptors.get(name);
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    }
  }
});
