import { test } from 'node:test';
import assert from 'node:assert/strict';
import { portedClasses } from '../src/Ported/Registry';
import { registry, Stage, Display } from './Fixtures/NativeGame';
import { providerFor, validCredentials } from '../src/Login/LoginProfiles';
import { ProgressBar } from '../src/UI/ProgressBar';
import { NativeUI } from '../src/UI/NativeUI';
import type { API } from '../src/Api/Types';
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
  const bar = new ProgressBar(new NativeUI(api), 300, 14, 0x3377ff);
  bar.set(25000, 22500);
  bar.update(1 / 60);
  const texts = bar.node.children
    .filter((child: any) => typeof child.get_text === 'function')
    .map((child: any) => child.get_text());
  assert.deepEqual(texts, ['22500 / 25000', '3x']);
  bar.obscured = true;
  bar.update(1 / 60);
  assert.deepEqual(
    bar.node.children
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
