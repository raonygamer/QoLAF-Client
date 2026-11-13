import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import { bindGameClasses } from '../src/game/Bindings';
import { installBodyVisuals } from '../src/world/BodyVisuals';
// @ts-expect-error production hook dispatcher
import { Hooks } from './fixtures/HostCore.js';

test('invisible anchors defer sprites but retain radius and explicit lazy access', () => {
  class Body {
    _mc: { radius: number } | null = null;
    obj: object | null = null;
    allocations = 0;
    atlases: Array<string | undefined> = [];
    switchTexturesByObj(_definition: unknown, atlas?: string) {
      this.allocations++;
      this.atlases.push(atlas);
      this._mc = { radius: 7 };
    }
    get_radius() {
      return this._mc!.radius;
    }
    get_movieClip() {
      return this._mc;
    }
  }
  const cleanups: Array<() => void> = [];
  const hooks = new Hooks((error: unknown) => {
    throw error;
  });
  const live = new Body();
  const api = {
    game: { bodyManager: { bodies: [live] } },
    defer: (cleanup: () => void) => cleanups.push(cleanup),
    cls: (name: string) => (name === 'core.solarSystem.Body' ? Body : {}),
    around(owner: object, method: string, callback: unknown) {
      const off = hooks.add(owner, method, 'around', callback);
      cleanups.push(off);
      return off;
    },
  } as unknown as API;
  bindGameClasses(api);
  installBodyVisuals(api);
  try {
    const definition = { type: 'hidden' };
    live.switchTexturesByObj(definition);
    live.obj = definition;
    assert.equal(live.allocations, 0);
    for (const type of ['hidden', 'boss']) {
      for (const bitmap of [null, undefined, '']) {
        const body = new Body();
        const definition = { type, bitmap };
        body.switchTexturesByObj(definition, 'texture_body.png');
        body.obj = definition; // Native BodyFactory assigns this after requesting textures.
        assert.equal(body.allocations, 0);
        assert.equal(body.get_radius(), 0.5);
        const clip = body.get_movieClip();
        assert.ok(clip);
        assert.equal(body.allocations, 1);
        assert.equal(body.get_movieClip(), clip);
        assert.equal(body.allocations, 1);
        assert.equal(body.get_radius(), 7);
        assert.deepEqual(body.atlases, ['texture_body.png']);
      }
      for (const override of [
        { bitmap: 'texture' },
        { effect: 'effect' },
        { effect: '' },
        { landable: true },
        { explorable: true },
        { canTriggerMission: true },
      ]) {
        const body = new Body();
        body.switchTexturesByObj({ type, ...override }, 'atlas');
        assert.equal(body.allocations, 1, JSON.stringify(override));
      }
    }
    for (const definition of [{ type: 'sun' }, { type: 'planet' }, null, {}]) {
      const body = new Body();
      body.switchTexturesByObj(definition);
      assert.equal(body.allocations, 1, 'other native paths must be preserved');
    }
    const changed = new Body();
    changed.obj = { type: 'boss' };
    changed.switchTexturesByObj(changed.obj);
    assert.equal(changed.allocations, 1, 'explicit later texture changes still run');
    const fresh = new Body();
    assert.equal(fresh.get_movieClip(), null, 'no fabricated definition during construction');
  } finally {
    cleanups.reverse().forEach((off) => off());
  }
  assert.equal(live.allocations, 1, 'unload restores fallback sprites for live anchors');
  assert.equal(live.get_radius(), 7);
  const vanilla = new Body();
  vanilla.switchTexturesByObj({ type: 'boss' });
  assert.equal(vanilla.allocations, 1, 'unload restores eager native allocation');
});
