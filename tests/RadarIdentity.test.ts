import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RadarIdentity } from '../src/radar/RadarIdentity';
test('radar contacts reject pooled reuse and identity replacement without recapturing stale blips', () => {
  const owner = { generation: 0 };
  let current = owner;
  const identities = new RadarIdentity<typeof owner>(
    (o) => o.generation,
    (o) => o === current,
  );
  const oldBlip = {};
  identities.capture(oldBlip, owner);
  assert.equal(identities.owns(oldBlip, owner), true);
  owner.generation++;
  identities.capture(oldBlip, owner);
  assert.equal(identities.owns(oldBlip, owner), false);
  const newBlip = {};
  identities.capture(newBlip, owner);
  assert.equal(identities.owns(newBlip, owner), true);
  current = { generation: 1 };
  assert.equal(identities.owns(newBlip, owner), false);
  assert.equal(identities.owns(newBlip, current), false);
});
