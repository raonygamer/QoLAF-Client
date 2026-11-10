import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RemoteRotationBuffer } from '../src/Rendering/RemoteRotationBuffer';
import { RemoteShips } from '../src/Rendering/RemoteShips';

const heading = (time: number, rotation = 0, rotateRight = true) => ({
  time,
  rotation,
  rotateRight,
  rotateLeft: false,
});
const difference = (a: number, b: number) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

test('remote rotation rejects stale poses, copies packets and continues held turns', () => {
  const buffer = new RemoteRotationBuffer();
  const packet = heading(1000);
  assert.equal(buffer.add(packet, 100, 2), true);
  assert.equal(buffer.sample(100), 0);
  packet.rotation = 100;
  for (let now = 116; now <= 2100; now += 16) buffer.sample(now);
  const before = buffer.sample(2100);
  assert.equal(buffer.add(heading(900, 1), 2100, 2), false);
  const after = buffer.sample(2116);
  assert.ok(Math.abs(difference(after, before) - 0.032) < 1e-9);
  assert.equal(buffer.sample(2116), after, 'same-frame logical/render samples agree');
  assert.equal(buffer.sample(5000), after, 'a paused renderer does not jump through missed turns');
  assert.equal(buffer.sample(10), after, 'timer resets preserve the displayed heading');
  buffer.reset();
  assert.ok(Number.isNaN(buffer.sample(11)));
});

test('angle wrap and late OFF packets obey the original bounded visual speed', () => {
  const buffer = new RemoteRotationBuffer();
  buffer.add(heading(1000, 6.25), 0, 2);
  let last = buffer.sample(0);
  for (let now = 16; now <= 800; now += 16) {
    if (now === 160) buffer.add(heading(1100, 0.166814692820413), now, 2);
    if (now === 320) buffer.add(heading(1200, 0.366814692820413, false), now, 2);
    const angle = buffer.sample(now);
    assert.ok(angle >= 0 && angle < Math.PI * 2);
    assert.ok(Math.abs(difference(angle, last)) <= 2 * 1.35 * 0.016 + 1e-10);
    last = angle;
  }
  assert.ok(Math.abs(last - 0.366814692820413) < 1e-9);
});

test('remote ship playback respects cinematic ownership, native engine getters and lifecycle reset', () => {
  let now = 0;
  const remote = new RemoteShips(() => now);
  const ship = {
    player: { isMe: false, isLanded: false },
    alive: true,
    engine: { get_rotationSpeed: () => 2 },
    stateMachine: { inState: (state: string) => state === 'Roaming' },
    forcedRotation: false,
  };
  assert.equal(remote.observe(ship, heading(1000)), true);
  assert.equal(remote.sample(ship), 0);
  now = 100;
  assert.ok(remote.sample(ship) > 0);
  ship.player.isLanded = true;
  assert.ok(Number.isNaN(remote.sample(ship)));
  ship.player.isLanded = false;
  ship.forcedRotation = true;
  assert.ok(Number.isNaN(remote.sample(ship)));
  ship.forcedRotation = false;
  remote.reset(ship);
  assert.ok(Number.isNaN(remote.sample(ship)));
  remote.reset(ship, heading(1100, 2));
  assert.equal(remote.sample(ship), 2);
});
