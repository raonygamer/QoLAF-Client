import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import { bindGameClasses } from '../src/game/Bindings';
import { installNativeBeamResources } from '../src/weapon/NativeBeamResources';
import { retainedEmitterLifetime } from '../src/rendering/EmitterLifetime';
// @ts-expect-error actual host dispatcher
import { Hooks } from './fixtures/HostCore.js';
// @ts-expect-error captured native destructor
import { createNativeBeamDestroy } from './fixtures/NativeBeamDestroy.js';

test('beam effects are retained until native teardown and pooled lines are released once', () => {
  const cleanups: Array<() => void> = [];
  class Weapon {
    alive = true;
    destroy() {
      this.alive = false;
    }
  }
  const native = createNativeBeamDestroy(Weapon);
  class Effect {
    retainedAtCreation = retainedEmitterLifetime();
    alive = true;
    killed = 0;
    played = 0;
    killEmitter() {
      this.killed++;
      this.alive = false;
    }
    play() {
      this.played++;
    }
  }
  class Line {
    visible = true;
    cleared = 0;
    set_visible(value: boolean) {
      this.visible = value;
    }
    clear() {
      this.cleared++;
    }
  }
  class Batch {
    clears = 0;
    disposed = 0;
    removed = 0;
    clear() {
      this.clears++;
    }
    removeFromParent() {
      this.removed++;
    }
    dispose() {
      this.disposed++;
    }
  }
  const requestedKeys: Array<string | null> = [];
  class EmitterFactory {
    static create(key: string | null): Effect[] {
      requestedKeys.push(key);
      return [new Effect()];
    }
  }
  class Beam extends Weapon {
    failInitialization = false;
    _fire = true;
    twin = true;
    drawBeam = true;
    oldDrawBeam = true;
    effectsInitialized = false;
    startEffect: Effect[] = [];
    startEffect2: Effect[] = [];
    endEffect: Effect[] = [];
    lines = [new Line(), new Line()];
    lineBatch: Batch | null = new Batch();
    returned: Line[] = [];
    g = {
      beamLinePool: {
        removeLine: (line: Line) => {
          assert.equal(this.alive, false);
          this.returned.push(line);
          this.destroy();
        },
      },
      canvasEffects: { removeChild: (_batch: Batch) => {} },
    };
    set_fire(value: boolean) {
      this._fire = value;
    }
    initEffects() {
      if (this.failInitialization) throw new Error('initialization failed');
      assert.deepEqual(EmitterFactory.create(''), []);
      assert.deepEqual(EmitterFactory.create(null), []);
      this.startEffect = EmitterFactory.create('start');
      this.startEffect2 = [new Effect()];
      this.endEffect = [new Effect()];
      this.effectsInitialized = true;
    }
    destroy() {
      return native.call(this);
    }
  }
  const hooks = new Hooks((error: unknown) => {
    throw error;
  });
  const hook =
    (kind: string) => (target: object, name: string, callback: (...args: never[]) => unknown) => {
      const off = hooks.add(target, name, kind, callback);
      cleanups.push(off);
      return off;
    };
  const api = {
    cls: (name: string) =>
      name === 'core.weapon.Beam'
        ? Beam
        : name === 'core.particle.EmitterFactory'
          ? EmitterFactory
          : class {},
    around: hook('around'),
    after: hook('after'),
  } as unknown as API;
  bindGameClasses(api);
  installNativeBeamResources(api);
  try {
    const broken = new Beam();
    broken.failInitialization = true;
    assert.throws(() => broken.initEffects(), /initialization failed/);
    assert.equal(retainedEmitterLifetime(), false);
    assert.equal(EmitterFactory.create(null).length, 1, 'failed init restores scope');
    requestedKeys.length = 0;
    const beam = new Beam();
    beam.initEffects();
    assert.equal(retainedEmitterLifetime(), false);
    assert.deepEqual(requestedKeys, ['start']);
    assert.equal(EmitterFactory.create('').length, 1, 'outside beam init remains native');
    const effects = [...beam.startEffect, ...beam.startEffect2, ...beam.endEffect];
    assert.ok(effects.every((effect) => effect.retainedAtCreation));
    assert.deepEqual(
      effects.map((effect) => effect.played),
      [1, 1, 0],
    );
    const batch = beam.lineBatch!;
    const lines = [...beam.lines];
    beam.destroy();
    beam.destroy();
    assert.equal(beam.alive, false);
    assert.equal(beam._fire, false);
    assert.equal(beam.effectsInitialized, false);
    assert.ok(effects.every((effect) => effect.killed === 1));
    assert.deepEqual(beam.returned, lines);
    assert.ok(lines.every((line) => !line.visible && line.cleared === 1));
    assert.equal(beam.lines.length, 0);
    assert.equal(beam.startEffect.length, 0);
    assert.equal(batch.disposed, 1);
    assert.equal(beam.lineBatch, null);
  } finally {
    cleanups.reverse().forEach((off) => off());
  }
  assert.equal(EmitterFactory.create('')[0].retainedAtCreation, false);
});
