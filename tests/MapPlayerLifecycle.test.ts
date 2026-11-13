import assert from 'node:assert/strict';
import { test } from 'node:test';
// @ts-expect-error actual host hook implementation
import { Hooks } from './fixtures/HostCore.js';
import { installMapPlayerLifecycle } from '../src/map/MapPlayerLifecycle';
import type { API } from '../src/api/Types';
import { bindGameClasses } from '../src/game/Bindings';
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
    player: { ship: { alive: boolean; hp: number; get_landed?: () => boolean } | null } | null = { ship: { alive: true, hp: 100, get_landed: () => false } };
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
  const classes: Record<string, unknown> = {
    'core.hud.components.map.MapPlayer': Marker,
    'com.greensock.TweenMax': { killTweensOf: (target: unknown) => killed.push(target) },
  };
  const hook = (kind: string) => (target: object, name: string, fn: (...args: never[]) => unknown) => {
    const off = hooks.add(target, name, kind, fn);
    cleanups.push(off);
    return off;
  };
  const api = {
    cls: (name: string) => classes[name] ?? Marker,
    around: hook('around'),
    before: hook('before'),
  } as unknown as API;
  bindGameClasses(api);
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
      { alive: true, hp: 0, get_landed: () => false },
      { alive: true, hp: 100, get_landed: () => true },
    ]) {
      marker.player!.ship = ship;
      marker.supporterImage.set_visible(true);
      const before = marker.draws;
      marker.update();
      assert.equal(marker.draws, before);
      for (const part of [marker.layer, marker.text, marker.supporterImage])
        assert.equal(part.get_visible(), false);
      marker.player!.ship = { alive: true, hp: 100, get_landed: () => false };
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
  restored.player!.ship!.alive = false;
  restored.update();
  assert.equal(restored.draws, 1, 'cleanup restores upstream behavior');
});
