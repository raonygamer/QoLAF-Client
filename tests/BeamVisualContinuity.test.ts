import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  BeamVisualContinuity,
  type BeamVisualUnit,
  type BeamVisualSnapshot,
} from '../src/weapon/BeamVisualContinuity';
// @ts-expect-error original AS3 execution boundary
import { install } from './fixtures/As3Methods.js';
const source = readFileSync(new URL('./fixtures/weapon/Beam.as', import.meta.url), 'utf8');
const unit = (x = 0, y = 0): BeamVisualUnit => ({
  alive: true,
  renderX: x,
  renderY: y,
  renderRotation: 0,
  collisionRadius: 5,
});
function original(snapshot: BeamVisualSnapshot<BeamVisualUnit>) {
  const scope = {
    name: snapshot.name,
    g: { time: snapshot.time },
    _fire: snapshot.firing,
    unit: snapshot.unit,
    target: snapshot.target,
    secondaryTargets: snapshot.secondaryTargets,
    range: snapshot.range,
    angleVariance: snapshot.angleVariance,
    visualTarget: null as BeamVisualUnit | null,
    visualTargetGraceEnd: 0,
    visualStopEnd: 0,
    visualSecondaryTargets: [] as BeamVisualUnit[],
    visualSecondaryGraceEnd: 0,
    SKELETOR_LIGHTNING: 'Skeletor Lightning',
    VISUAL_CONNECTION_GRACE: 165,
    VISUAL_AIM_HYSTERESIS: 2.25 / 33,
    Util: {
      angleDifference(a: number, b: number) {
        const difference = a - b;
        return difference > Math.PI
          ? difference - 2 * Math.PI
          : difference < -Math.PI
            ? difference + 2 * Math.PI
            : difference;
      },
    },
    canRetainVisualTarget: (_target: BeamVisualUnit | null): boolean => false,
    resolveVisualTarget: (): BeamVisualUnit | null => null,
    resolveVisualSecondaryTargets: (): readonly BeamVisualUnit[] => [],
  };
  install(scope, source, [
    'canRetainVisualTarget',
    'resolveVisualTarget',
    'resolveVisualSecondaryTargets',
  ]);
  return scope;
}

test('beam hysteresis matches original range and angle boundary rules', () => {
  const snapshot = {
    name: 'Skeletor Lightning',
    time: 1000,
    firing: true,
    unit: unit(),
    target: null,
    secondaryTargets: [],
    range: 100,
    angleVariance: 0.2,
  };
  const baseline = original(snapshot),
    model = new BeamVisualContinuity<BeamVisualUnit>();
  for (const x of [0, 50, 100, 113, 113.001, -50])
    for (const y of [0, 5, 20, -20])
      for (const rotation of [0, Math.PI, -Math.PI, Math.PI * 2, -Math.PI * 2]) {
        snapshot.unit.renderRotation = rotation;
        const target = unit(x, y);
        assert.equal(model.canRetain(snapshot, target), baseline.canRetainVisualTarget(target));
      }
});

test('primary and chain retention match original across grace expiry and target death', () => {
  for (const name of ['Skeletor Lightning', 'Other']) {
    const target = unit(50),
      secondary = unit(70);
    const snapshot: BeamVisualSnapshot<BeamVisualUnit> = {
      name,
      time: 1000,
      firing: true,
      unit: unit(),
      target,
      secondaryTargets: [secondary],
      range: 100,
      angleVariance: 0.2,
    };
    const baseline = original(snapshot),
      model = new BeamVisualContinuity<BeamVisualUnit>();
    const compare = () => {
      baseline.target = snapshot.target;
      baseline.secondaryTargets = snapshot.secondaryTargets;
      baseline.g.time = snapshot.time;
      baseline._fire = snapshot.firing;
      assert.equal(model.resolveTarget(snapshot), baseline.resolveVisualTarget());
      assert.deepEqual(model.resolveSecondary(snapshot), baseline.resolveVisualSecondaryTargets());
    };
    compare();
    snapshot.target = null;
    snapshot.secondaryTargets = [];
    for (const time of [1001, 1100, 1166, 1167]) {
      snapshot.time = time;
      compare();
    }
    snapshot.firing = false;
    for (const time of [1200, 1365, 1366]) {
      snapshot.time = time;
      compare();
    }
    snapshot.target = target;
    snapshot.secondaryTargets = [secondary];
    compare();
    target.alive = secondary.alive = false;
    compare();
  }
});

test('stopping holds only Skeletor connections until the exact deadline and resuming cancels the hold', () => {
  const target = unit(50);
  const snapshot: BeamVisualSnapshot<BeamVisualUnit> = {
    name: 'Skeletor Lightning',
    time: 1000,
    firing: true,
    unit: unit(),
    target,
    secondaryTargets: [],
    range: 100,
    angleVariance: 0.2,
  };
  const model = new BeamVisualContinuity<BeamVisualUnit>();
  model.resolveTarget(snapshot);
  assert.equal(model.setFiring(snapshot, false, true), true);
  assert.equal(model.stopExpired(1164, false), false);
  assert.equal(model.stopExpired(1165, false), true);
  assert.equal(model.setFiring(snapshot, true, true), true);
  assert.equal(model.stopExpired(2000, false), false);
  snapshot.name = 'Other';
  assert.equal(model.setFiring(snapshot, false, true), false);
  snapshot.target = null;
  assert.equal(model.resolveTarget(snapshot), null);
  assert.equal(target.alive, true);
});
