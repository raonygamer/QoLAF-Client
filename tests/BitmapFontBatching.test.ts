import assert from 'node:assert/strict';
import { test } from 'node:test';
// @ts-expect-error actual host hook implementation
import { Hooks } from './fixtures/HostCore.js';
import { installBitmapFontBatching } from '../src/ui/BitmapFontBatching';

test('native bitmap font batching reaches upstream instances, preserves layout args and unhooks cleanly', () => {
  const errors: unknown[] = [];
  const hooks = new Hooks((error: unknown) => errors.push(error));
  const cleanups: (() => void)[] = [];
  const calls: unknown[][] = [];
  class Font {
    fillMeshBatch(batch: any, ...args: unknown[]) {
      calls.push([batch.batchable, ...args]);
    }
  }
  const upstream = new Font();
  installBitmapFontBatching({
    cls: () => Font,
    before: (target: any, key: string, fn: Function) =>
      cleanups.push(hooks.add(target, key, 'before', fn)),
  } as any);
  const batch = {
    batchable: false,
    set_batchable(value: boolean) {
      this.batchable = value;
    },
  };
  const format = { font: 'font26', size: 26 };
  const options = { wordWrap: false };
  upstream.fillMeshBatch(batch, 600, 30, 'Safe Zone', format, options);
  assert.deepEqual(calls[0], [true, 600, 30, 'Safe Zone', format, options]);
  cleanups.reverse().forEach((fn) => fn());
  batch.batchable = false;
  upstream.fillMeshBatch(batch, 600, 30, 'Safe Zone', format, options);
  assert.equal(calls[1][0], false);
  assert.deepEqual(errors, []);
});
