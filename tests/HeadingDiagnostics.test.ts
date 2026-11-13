import assert from 'node:assert/strict';
import test from 'node:test';
import { HeadingDiagnostics } from '../src/network/HeadingDiagnostics';
import { PacketCapture } from '../src/network/PacketCapture';
import { CommandAcknowledgements } from '../src/network/CommandAcknowledgements';
import { limitedVector, type DebugHeading } from '../src/network/HeadingGraphics';

const heading = (): DebugHeading => ({
  time: 1000,
  pos: { x: 10, y: 20 },
  speed: { x: 4, y: 5 },
  rotation: 0,
  accelerate: false,
  deaccelerate: false,
  rotateLeft: false,
  rotateRight: false,
});

test('receipt snapshots survive pooled heading mutation and live target replacement', () => {
  const capture = new PacketCapture(() => 100);
  const tracker = new CommandAcknowledgements(() => 100);
  const diagnostic = new HeadingDiagnostics(capture, tracker, () => 100);
  capture.show();
  diagnostic.enabled = true;
  const raw = heading(),
    replay = heading(),
    local = heading();
  replay.pos.x = 30;
  diagnostic.record(raw, replay, local, 'native-converge', true);
  const recorded = capture.entries[0].line;
  raw.pos.x = replay.pos.x = local.pos.x = 999;
  assert.equal(diagnostic.raw?.pos.x, 10);
  assert.equal(diagnostic.replay?.pos.x, 30);
  const replacement = heading();
  replacement.pos.x = 40;
  diagnostic.stateProvider = () => ({ course: local, target: replacement });
  assert.equal(diagnostic.live()?.target, replacement);
  assert.equal(diagnostic.local?.pos.x, 10);
  assert.equal(capture.entries[0].line, recorded);
});

test('paused receipt capture leaves last packet intact while live courses remain live', () => {
  const capture = new PacketCapture(() => 100);
  const diagnostic = new HeadingDiagnostics(
    capture,
    new CommandAcknowledgements(() => 100),
    () => 100,
  );
  capture.show();
  diagnostic.enabled = true;
  const course = heading();
  diagnostic.record(course, course, course, 'native-matched', true);
  capture.paused = true;
  course.time = 2000;
  diagnostic.record(course, course, course, 'native-converge', true);
  assert.equal(diagnostic.raw?.time, 1000);
  assert.equal(capture.entries.length, 1);
  diagnostic.stateProvider = () => ({ course, target: null });
  assert.equal(diagnostic.live()?.course.time, 2000);
});

test('debug vectors preserve direction and cap magnitude without touching world positions', () => {
  const vector = limitedVector(300, 400, 92, 1.25);
  assert.equal(Math.hypot(vector.x, vector.y), 92);
  assert.equal(vector.x / vector.y, 0.75);
  assert.deepEqual(limitedVector(0, 0, 92, 1.25), { x: 0, y: 0 });
});
