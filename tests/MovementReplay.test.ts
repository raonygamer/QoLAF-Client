import assert from 'node:assert/strict';
import test from 'node:test';
import { MovementReplay, type MovementCommand } from '../src/movement/MovementReplay';
import {
  SelfCourseQueue,
  type SelfHeading,
  type SelfCourseOwner,
} from '../src/movement/SelfCourseQueue';

class Heading implements SelfHeading {
  time = 0;
  pos = { x: 0, y: 0 };
  speed = { x: 0, y: 0 };
  rotation = 0;
  accelerate = false;
  deaccelerate = false;
  rotateLeft = false;
  rotateRight = false;
  clone(): Heading {
    const heading = new Heading();
    heading.copy(this);
    return heading;
  }
  copy(other: SelfHeading): void {
    Object.assign(this, other, { pos: { ...other.pos }, speed: { ...other.speed } });
  }
  almostEqual(other: SelfHeading): boolean {
    return this.pos.x === other.pos.x && this.pos.y === other.pos.y;
  }
  runCommand(command: MovementCommand): void {
    switch (command.type) {
      case 0:
        this.accelerate = command.active;
        break;
      case 1:
        this.rotateLeft = command.active;
        break;
      case 2:
        this.rotateRight = command.active;
        break;
      case 8:
        this.deaccelerate = command.active;
        break;
      case 4:
        this.accelerate = true;
        this.deaccelerate = this.rotateLeft = this.rotateRight = false;
        break;
    }
  }
}

function fixture() {
  const replay = new MovementReplay([]);
  const records: { raw: SelfHeading; action: string | null }[] = [];
  let target: SelfHeading | null = null;
  let steps = 0;
  let clears = 0;
  const owner: SelfCourseOwner = {
    ship: {},
    converger: {},
    course: new Heading(),
    advance(heading) {
      heading.time += 33;
      steps++;
    },
    setTarget(heading) {
      target = heading;
    },
    clearTarget() {
      target = null;
      clears++;
    },
  };
  const queue = new SelfCourseQueue(replay, (raw, _replayed, _local, action) =>
    records.push({ raw: raw.clone(), action }),
  );
  replay.prepareOwner(owner.ship, owner.converger);
  return {
    replay,
    queue,
    owner,
    records,
    target: () => target,
    steps: () => steps,
    clears: () => clears,
  };
}

test('pruned throttle and turn transitions override delayed server flags', () => {
  const { replay, owner } = fixture();
  replay.store({ type: 0, active: true, time: 0 });
  replay.store({ type: 1, active: true, time: 0 });
  replay.store({ type: 0, active: false, time: 33 });
  const packet = new Heading();
  packet.time = 66;
  packet.accelerate = true;
  replay.prepareHeading(owner.ship, owner.converger, packet);
  assert.equal(packet.accelerate, false);
  assert.equal(packet.rotateLeft, true);
  assert.equal(replay.commands.length, 0);
  const later = new Heading();
  later.time = 99;
  later.accelerate = true;
  replay.prepareHeading(owner.ship, owner.converger, later);
  assert.equal(later.accelerate, false);
  assert.equal(later.rotateLeft, true);
});

test('replay sorts out-of-order insertion and preserves atomic same-timestamp input buckets', () => {
  const { replay } = fixture();
  replay.store({ type: 0, active: false, time: 66 });
  replay.store({ type: 0, active: true, time: 33 });
  replay.store({ type: 2, active: true, time: 33 });
  const packet = new Heading();
  replay.run(packet, 0);
  assert.equal(packet.accelerate, false);
  replay.run(packet, 33);
  assert.equal(packet.accelerate, true);
  assert.equal(packet.rotateRight, true);
  replay.run(packet, 66);
  assert.equal(packet.accelerate, false);
});

test('boost establishes all retained axes; replacing converger drops history and state', () => {
  const { replay, owner } = fixture();
  replay.store({ type: 4, active: true, time: 0 });
  const packet = new Heading();
  packet.rotateLeft = packet.deaccelerate = true;
  replay.prepareHeading(owner.ship, owner.converger, packet);
  assert.equal(packet.accelerate, true);
  assert.equal(packet.rotateLeft, false);
  assert.equal(packet.deaccelerate, false);
  replay.lastCommandTime = 999;
  const replacement = new Heading();
  replacement.rotateLeft = true;
  replay.prepareHeading(owner.ship, {}, replacement);
  assert.equal(replacement.accelerate, false);
  assert.equal(replacement.rotateLeft, true);
  assert.ok(Number.isNaN(replay.lastCommandTime));
});

test('queue coalesces full equal-time revisions and rejects stale arrivals before one flush', () => {
  const f = fixture();
  f.owner.course.time = 99;
  const first = new Heading();
  first.time = 33;
  first.pos.x = 1;
  f.queue.queue(f.owner, first);
  const revision = first.clone();
  revision.pos.x = 2;
  revision.rotateRight = true;
  f.queue.queue(f.owner, revision);
  const stale = first.clone();
  stale.time = 0;
  f.queue.queue(f.owner, stale);
  assert.equal(f.records[0].action, 'ignored-stale(33ms)');
  assert.equal(f.steps(), 0);
  f.queue.flush(f.owner);
  assert.equal(f.steps(), 2);
  assert.equal(f.target()?.pos.x, 2);
  assert.equal(f.records[1].raw.rotateRight, true);
  // Final boundary copies current persistent input; it does not re-run discrete boost.
  assert.equal(f.target()?.rotateRight, false);
  f.queue.flush(f.owner);
  assert.equal(f.steps(), 2);
});

test('already applied identical packets are ignored but equal-time complete revisions are accepted', () => {
  const f = fixture();
  const packet = new Heading();
  packet.pos.x = 4;
  f.queue.queue(f.owner, packet.clone());
  f.queue.flush(f.owner);
  f.queue.queue(f.owner, packet.clone());
  assert.equal(f.records.at(-1)?.action, 'ignored-duplicate');
  packet.pos.x = 7;
  f.queue.queue(f.owner, packet.clone());
  f.queue.flush(f.owner);
  assert.equal(f.target()?.pos.x, 7);
});

test('obsolete owner and too-old packets cannot replace a current correction target', () => {
  const f = fixture();
  const packet = new Heading();
  packet.pos.x = 10;
  f.queue.queue(f.owner, packet);
  f.queue.flush({ ...f.owner, converger: {} });
  assert.equal(f.records.length, 0);
  assert.equal(f.target(), null);
  f.owner.course.time = 33001;
  f.queue.queue(f.owner, new Heading());
  f.queue.flush(f.owner);
  assert.equal(f.steps(), 0);
  assert.equal(f.clears(), 1);
  assert.equal(f.records.at(-1)?.action, 'ignored-too-old(33001ms)');
});

test('matching authoritative replay clears the previous target and lifecycle reset enforces timestamp floor', () => {
  const f = fixture();
  const packet = new Heading();
  packet.pos.x = 10;
  f.queue.queue(f.owner, packet);
  f.queue.flush(f.owner);
  const matched = new Heading();
  matched.time = 33;
  f.queue.queue(f.owner, matched);
  f.queue.flush(f.owner);
  assert.equal(f.target(), null);
  assert.equal(f.clears(), 1);
  f.queue.reset(f.owner, 100);
  f.queue.queue(f.owner, new Heading());
  assert.equal(f.records.at(-1)?.action, 'ignored-stale(100ms)');
});

test('local correction caps velocity correction and emergency snaps preserve current inputs', async () => {
  const { correctLocalCourse } = await import('../src/movement/LocalCorrection');
  const course = new Heading();
  course.accelerate = course.rotateLeft = true;
  const target = new Heading();
  target.pos.x = 250;
  target.speed.x = 20;
  const converger = {
    course,
    target,
    updateHeading: (heading: SelfHeading) => {
      heading.time += 33;
    },
    setCourse(heading: SelfHeading) {
      this.course = heading as Heading;
    },
  };
  correctLocalCourse(converger);
  assert.equal(converger.course, course);
  assert.equal(course.speed.x, 140);
  assert.equal(course.pos.x, 0);
  target.pos.x = 301;
  correctLocalCourse(converger);
  assert.equal(converger.course, target);
  assert.equal(target.accelerate, true);
  assert.equal(target.rotateLeft, true);
});

test('new local input advances correction target under old inputs before applying transition to both courses', async () => {
  const { runLocalCommand } = await import('../src/movement/LocalCorrection');
  const course = new Heading();
  course.time = 66;
  const target = new Heading();
  const flagsDuringReplay: boolean[] = [];
  runLocalCommand(
    {
      course,
      target,
      updateHeading(heading) {
        flagsDuringReplay.push(heading.accelerate);
        heading.time += 33;
      },
    },
    { type: 0, active: true, time: 66 },
  );
  assert.deepEqual(flagsDuringReplay, [false, false]);
  assert.equal(target.time, 66);
  assert.equal(target.accelerate, true);
  assert.equal(course.accelerate, true);
});
