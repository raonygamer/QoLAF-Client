import assert from 'node:assert/strict';
import { test } from 'node:test';
// @ts-expect-error actual host hook implementation
import { Hooks } from './fixtures/HostCore.js';
import { installMapPlayerLifecycle } from '../src/map/MapPlayerLifecycle';
import { Display } from './fixtures/NativeGame';

test('map player death and landing hide every marker part, reappearance restores badge and dispose cancels tween', () => {
  const hooks = new Hooks((error: unknown) => {
    throw error;
  });
  const cleanups: (() => void)[] = [];
  const killed: unknown[] = [];
  class Marker {
    layer = new Display();
    text = new Display();
    supporterImage = new Display();
    player: any = { ship: { alive: true, hp: 100, get_landed: () => false } };
    draws = 0;
    disposed = false;
    update() {
      this.layer.set_visible(true);
      this.text.set_visible(true);
      this.draws++;
      return 'native result';
    }
    dispose() {
      assert.deepEqual(killed, [this.layer]);
      this.disposed = true;
    }
  }
  const classes: any = {
    'core.hud.components.map.MapPlayer': Marker,
    'com.greensock.TweenMax': { killTweensOf: (target: unknown) => killed.push(target) },
  };
  const api: any = { cls: (name: string) => classes[name] };
  for (const kind of ['around', 'before'])
    api[kind] = (target: any, name: string, fn: Function) =>
      cleanups.push(hooks.add(target, name, kind, fn));
  installMapPlayerLifecycle(api);
  try {
    const marker = new Marker();
    marker.supporterImage.set_visible(false);
    assert.equal(marker.update(), 'native result');
    assert.equal(
      marker.supporterImage.get_visible(),
      false,
      'opening tween retains badge visibility ownership',
    );
    for (const ship of [
      null,
      { alive: false, hp: 100 },
      { alive: true, hp: 0 },
      { alive: true, hp: 100, get_landed: () => true },
    ]) {
      marker.player.ship = ship;
      marker.supporterImage.set_visible(true);
      const before = marker.draws;
      marker.update();
      assert.equal(marker.draws, before);
      for (const part of [marker.layer, marker.text, marker.supporterImage])
        assert.equal(part.get_visible(), false);
      marker.player.ship = { alive: true, hp: 100, get_landed: () => false };
      marker.update();
      for (const part of [marker.layer, marker.text, marker.supporterImage])
        assert.equal(part.get_visible(), true);
    }
    marker.player = null;
    marker.update();
    assert.equal(marker.supporterImage.get_visible(), false);
    marker.dispose();
    assert.equal(marker.disposed, true);
  } finally {
    cleanups.reverse().forEach((fn) => fn());
  }
  const restored = new Marker();
  restored.player.ship.alive = false;
  restored.update();
  assert.equal(restored.draws, 1, 'cleanup restores upstream behavior');
});
