import { NativeUI } from '../src/ui/NativeUI';
import type { Texture } from '../src/game/Bindings';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { portedClasses } from '../src/ported/Registry';
import { registry, Stage, Display } from './fixtures/NativeGame';
import { providerFor, validCredentials } from '../src/login/LoginProfiles';
import { ProgressBar } from '../src/ui/ProgressBar';
import { bindGameClasses } from '../src/game/Bindings';
import type { API } from '../src/api/Types';
function context() {
  const classes = registry(),
    cleanups: Function[] = [];
  const api = {
    cls: (name: string) => classes[name],
    defer: (fn: Function) => {
      cleanups.push(fn);
      return fn;
    },
  } as unknown as API;
  bindGameClasses({ cls: (name: string) => api.cls(name) ?? {} } as unknown as API);
  return { api, cleanups };
}
test('source-ported login chooser keeps its dimensions, selection, paging and protected Steam profile', () => {
  const { api, cleanups } = context();
  const { resolve } = portedClasses(api);
  let chosen: any;
  let removed: any;
  const Panel = resolve('core.hud.components.LoginProfilePanel');
  const panel = new Panel(
    () => {},
    (p: any) => (removed = p),
    (p: any) => (chosen = p),
    () => {},
    () => {},
    () => {},
  );
  const stage = new Stage();
  stage.addChild(panel);
  const profiles = Array.from({ length: 7 }, (_, i) => ({
    id: 'site:' + i,
    type: 'site',
    label: 'player' + i + '@example.com',
    detail: 'Simple account',
    accountName: 'Pilot ' + i,
    removable: true,
  }));
  panel.setProfiles(
    [{ id: 'steam', type: 'steam', label: 'Steam', removable: true }, ...profiles],
    'site:6',
  );
  assert.equal(Panel.PANEL_WIDTH, 460);
  assert.equal(Panel.PANEL_HEIGHT, 361);
  assert.equal(panel.selectedProfileId, 'site:6');
  panel.loginSelected();
  assert.equal(chosen.id, 'site:6');
  assert.equal(panel.profiles[0].type, 'steam');
  panel.selectedProfileId = 'steam';
  panel.removeSelected();
  assert.equal(removed, undefined);
  panel.selectedProfileId = 'site:1';
  panel.removeSelected();
  assert.equal((removed as any).id, 'site:1');
  panel.dispose();
  for (const cleanup of cleanups.reverse()) cleanup();
});
test('native progress bar retains original multibar capacity and obscured-player text', () => {
  const { api } = context();
  const resolve = api.cls;
  const graphics = { beginGradientFill() {}, drawRect() {}, endFill() {} };
  api.cls = (name: string): any => {
    if (name === 'openfl.display.Shape')
      return class {
        get_graphics() {
          return graphics;
        }
      };
    if (name === 'openfl.geom.Matrix')
      return class {
        createGradientBox() {}
      };
    if (name === 'openfl.display.BitmapData')
      return class {
        draw() {}
        dispose() {}
      };
    return resolve(name);
  };
  bindGameClasses({ cls: (name: string) => api.cls(name) ?? {} } as unknown as API);
  const bar = new ProgressBar(300, 14, 0x3377ff);
  const node = bar.node as unknown as Display;
  bar.set(25000, 22500);
  bar.update(1 / 60);
  const texts = node.children
    .filter((child: any) => typeof child.get_text === 'function')
    .map((child: any) => child.get_text());
  assert.deepEqual(texts, ['22500 / 25000', '3x']);
  bar.obscured = true;
  bar.update(1 / 60);
  assert.deepEqual(
    node.children
      .filter((c: any) => typeof c.get_text === 'function')
      .map((c: any) => c.get_text()),
    ['??? / ???', '???x'],
  );
  bar.dispose();
});
test('profile providers preserve AS3 credential-shape detection without treating long email passwords as tokens', () => {
  assert.equal(providerFor('', 'player@example.com', 'x'.repeat(64)), 'simple');
  assert.equal(providerFor('', '123456', 'x'.repeat(64)), 'kongregate');
  assert.equal(providerFor('', 'a'.repeat(32), 'b'.repeat(32)), 'armor');
  assert.equal(validCredentials('simple', 'player@example.com', 'secret'), true);
  assert.equal(validCredentials('kongregate', 'abc', 'x'.repeat(64)), false);
});

test('optional texture lookup preserves null while required texture lookup rejects missing art', () => {
  const texture = {} as Texture;
  const requests: string[][] = [];
  const manager = {
    getTextureGUIByTextureName(name: string) {
      requests.push([name]);
      return name === 'present' ? texture : null;
    },
    getTextureByTextureName(name: string, atlas: string) {
      requests.push([name, atlas]);
      return name === 'present' ? texture : null;
    },
  };
  const ui = new NativeUI({
    cls: (name: string) =>
      name === 'textures.TextureLocator' ? { getService: () => manager } : undefined,
  } as unknown as API);
  assert.equal(ui.findTexture('missing', 'icons'), null);
  assert.equal(ui.findTexture('present', 'icons'), texture);
  assert.equal(ui.texture('present'), texture);
  assert.throws(() => ui.texture('missing'), /Missing game texture: missing/);
  assert.deepEqual(requests, [
    ['missing', 'icons'],
    ['present', 'icons'],
    ['present'],
    ['missing'],
  ]);
});
