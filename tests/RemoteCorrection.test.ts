import assert from 'node:assert/strict';
import test from 'node:test';
import { correctRemoteCourse } from '../src/movement/RemoteCorrection';
import { RemoteShips } from '../src/rendering/RemoteShips';

function fixture(distance = 20, angle = 1) {
  const course = { time: 66, pos: { x: 0, y: 0 }, speed: { x: 0, y: 0 }, rotation: 0 };
  const target = { time: 0, pos: { x: distance, y: 0 }, speed: { x: 10, y: 2 }, rotation: angle };
  let advances = 0;
  const converger = {
    course,
    target,
    updateHeading(heading: typeof target) {
      advances++;
      heading.time += 33;
    },
    setCourse(heading: typeof target) {
      this.course = heading;
    },
  };
  return { converger, advances: () => advances };
}

test('buffered remote angle remains untouched while translation receives source correction', () => {
  const f = fixture();
  correctRemoteCourse(f.converger as any, true);
  assert.equal(f.advances(), 2);
  assert.equal(f.converger.course.speed.x, 21);
  assert.equal(f.converger.course.speed.y, 2);
  assert.equal(f.converger.course.rotation, 0);
});

test('remote snap boundary is strict and fallback angle follows source snap/smoothing rules', () => {
  const atBoundary = fixture(45);
  correctRemoteCourse(atBoundary.converger as any, false);
  assert.notEqual(atBoundary.converger.course, atBoundary.converger.target);
  assert.equal(atBoundary.converger.course.rotation, 1);
  const beyond = fixture(45.001);
  correctRemoteCourse(beyond.converger as any, true);
  assert.equal(beyond.converger.course, beyond.converger.target);
  const smallAngle = fixture(10, -0.2);
  correctRemoteCourse(smallAngle.converger as any, false);
  assert.ok(Math.abs(smallAngle.converger.course.rotation - (Math.PI * 2 - 0.016)) < 1e-12);
});

test('native warp/landing getters exclude both buffers and reset removes pooled throttle state', () => {
  let landed = false,
    warping = false;
  const remote = new RemoteShips(() => 100);
  const ship = {
    player: {
      isMe: false,
      get isLanded() {
        return landed;
      },
      get_isWarpJumping: () => warping,
    },
    alive: true,
    engine: { get_rotationSpeed: () => 2 },
    stateMachine: { inState: () => true },
  };
  const heading = {
    time: 1000,
    rotation: 1,
    rotateLeft: false,
    rotateRight: false,
    accelerate: true,
    deaccelerate: false,
  };
  remote.observe(ship, heading);
  const course = { accelerate: false, deaccelerate: true };
  assert.equal(remote.applyMovement(ship, course), true);
  assert.equal(course.accelerate, true);
  landed = true;
  assert.equal(remote.applyMovement(ship, course), false);
  assert.ok(Number.isNaN(remote.sample(ship)));
  landed = false;
  warping = true;
  assert.equal(remote.applyMovement(ship, course), false);
  assert.ok(Number.isNaN(remote.sample(ship)));
  warping = false;
  remote.reset(ship);
  assert.equal(remote.applyMovement(ship, course), false);
  assert.ok(Number.isNaN(remote.sample(ship)));
});
