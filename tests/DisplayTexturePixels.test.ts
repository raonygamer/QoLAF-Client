import assert from 'node:assert/strict';
import { test } from 'node:test';
// @ts-expect-error actual host hook implementation
import { Hooks } from './fixtures/HostCore.js';
import { installDisplayTexturePixels } from '../src/ui/DisplayTexturePixels';

test('vector texture pixels normalize after drawing on initial upload and native restoration', () => {
  const errors: unknown[] = [];
  const hooks = new Hooks((error: unknown) => errors.push(error));
  const cleanups: (() => void)[] = [];
  const order: unknown[][] = [];
  class Bitmap {
    normalized = false;
    draw(source: object, matrix: object) {
      this.normalized = false;
      order.push(['draw', source, matrix]);
    }
    getPixel32(x: number, y: number) {
      this.normalized = true;
      order.push(['pixels', x, y]);
      return 0x0044bbff;
    }
  }
  const matrix = { tx: -5, ty: 7 };
  const source = {};
  const textures = {
    textureFromDisplayObject(display: object, key: string) {
      const upload = () => {
        const bitmap = new Bitmap();
        bitmap.draw(display, matrix);
        order.push(['upload', bitmap.normalized, key]);
        return bitmap;
      };
      return { bitmap: upload(), restore: upload };
    },
  };
  const classes: any = { 'textures.TextureManager': textures, 'openfl.display.BitmapData': Bitmap };
  const api: any = { cls: (name: string) => classes[name] };
  for (const kind of ['before', 'after'])
    api[kind] = (target: any, name: string, callback: Function) =>
      cleanups.push(hooks.add(target, name, kind, callback));
  installDisplayTexturePixels(api);
  try {
    const texture = textures.textureFromDisplayObject(source, 'map-orbits:body:0.1');
    assert.equal(texture.bitmap.normalized, true);
    assert.equal(texture.restore().normalized, true);
    assert.deepEqual(order.slice(0, 3), [
      ['draw', source, matrix],
      ['pixels', 0, 0],
      ['upload', true, 'map-orbits:body:0.1'],
    ]);
    const unrelated = new Bitmap();
    unrelated.draw({}, matrix);
    assert.equal(unrelated.normalized, false, 'unrelated bitmap drawing is untouched');
    assert.deepEqual(errors, []);
  } finally {
    cleanups.reverse().forEach((fn) => fn());
  }
  assert.equal(textures.textureFromDisplayObject(source, 'unhooked').bitmap.normalized, false);
});
