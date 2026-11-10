import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CombatTextFrames, combatTextAnchor } from '../src/rendering/CombatTextFrames';
import type { Raw } from '../src/api/Types';

function fixture() {
  const frames = new CombatTextFrames();
  const owner: Raw = {
    alive: true,
    pos: { x: 100, y: 200 },
    isAddedToCanvas: true,
    _mc: { x: 105, y: 210 },
  };
  const particle: Raw = {
    x: 100,
    y: 185,
    alive: true,
    ttl: 1000,
    maxTtl: 1000,
    speed: { x: 5, y: -40 },
    owner,
    createdZoom: 1,
    baseScale: 1.2,
    set_x(v: number) {
      this.x = v;
    },
    set_y(v: number) {
      this.y = v;
    },
    set_alpha(v: number) {
      this.alpha = v;
    },
    set_scaleX(v: number) {
      this.scaleX = v;
    },
    set_scaleY(v: number) {
      this.scaleY = v;
    },
  };
  const handler = {
    texts: [particle],
    g: { me: { zoom: 2 } },
    remove(_p: Raw, index: number) {
      this.texts.splice(index, 1);
    },
  };
  return { frames, owner, particle, handler };
}
function near(actual: number, expected: number) {
  assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);
}

test('combat text follows every rendered pose and retains rise despite tick coordinate writes', () => {
  const { frames, owner, particle, handler } = fixture();
  frames.attach(particle, owner);
  near(particle.x, 105);
  near(particle.y, 195);
  for (let step = 1; step <= 6; step++) {
    owner._mc.x += 0.5;
    owner._mc.y += 0.25;
    // Native spawner/turret tick snaps to its physics position.
    if (step === 4) {
      particle.x = 100;
      particle.y = 175;
    }
    frames.update(handler, 0.0055);
    near(particle.x, 105 + step * (0.5 + 5 * 0.0055));
    near(particle.y, 195 + step * (0.25 - 40 * 0.0055));
  }
  near(particle.ttl, 967);
  near(particle.scaleX, 0.6);
  assert.deepEqual(owner.pos, { x: 100, y: 200 });
});

test('floating text motion and fractional lifetime agree at 30, 60, 120 and 180 FPS', () => {
  for (const fps of [30, 60, 120, 180]) {
    const { frames, particle, handler } = fixture();
    for (let step = 0; step < fps; step++) frames.update(handler, 0.99 / fps);
    near(particle.x, 104.95);
    near(particle.y, 145.4);
    near(particle.ttl, 10);
    frames.update(handler, 0.02);
    assert.equal(particle.alive, false);
    assert.equal(particle.alpha, 0);
    frames.update(handler, 0.01);
    assert.equal(handler.texts.length, 0);
  }
});

test('merged hits keep rise, owner reuse detaches and particle reuse starts a fresh attachment', () => {
  const { frames, owner, particle, handler } = fixture();
  frames.attach(particle, owner);
  frames.update(handler, 0.01);
  frames.attach(particle, owner);
  near(particle.y, 194.6);
  frames.resetOwner(owner);
  owner._mc.x = 900;
  frames.update(handler, 0.01);
  near(particle.x, 105.1);
  assert.equal(particle.owner, null);
  frames.reset(particle);
  particle.x = 100;
  particle.y = 185;
  frames.attach(particle, owner);
  near(particle.x, 900);
});

test('source anchor offsets survive subclassing and sustained hits stop rising after 120 units', () => {
  const { frames, owner, particle, handler } = fixture();
  owner.__class__ = {
    __name__: 'core.spawner.Boss',
    __super__: { __name__: 'core.spawner.Spawner' },
  };
  assert.equal(combatTextAnchor(owner, false), -25);
  assert.equal(combatTextAnchor(owner, true), -10);
  owner.__class__ = { __name__: 'core.turret.Turret' };
  assert.equal(combatTextAnchor(owner, false), -20);
  assert.equal(combatTextAnchor(owner, true), -5);
  frames.attach(particle, owner, combatTextAnchor(owner, false));
  near(particle.y, 190);
  for (let step = 0; step < 400; step++) {
    particle.ttl = 1000; // Sustained merged damage renews the same particle.
    owner._mc.y += 0.25;
    frames.update(handler, 0.01);
  }
  near(particle.y, 170); // initial 190 + owner movement 100 - maximum rise 120
  near(particle.x, 125);
});

test('replacement damage numbers stop following without losing their rise limit or healing attachment', () => {
  const { frames, owner, particle, handler } = fixture();
  const heal: Raw = { ...particle, speed: { x: 0, y: -40 } };
  owner.lastDmgText = particle;
  owner.lastHealText = heal;
  handler.texts.push(heal);
  frames.attach(particle, owner, -15, 'lastDmgText');
  frames.attach(heal, owner, -15, 'lastHealText');
  frames.update(handler, 0.01);
  owner.lastDmgText = {}; // A later hit starts another number outside the merge window.
  owner._mc.x += 100;
  owner._mc.y += 100;
  frames.update(handler, 0.01);
  near(particle.x, 105.1);
  near(particle.y, 194.2);
  near(heal.x, 205);
  near(heal.y, 294.2);
  for (let step = 0; step < 400; step++) {
    particle.ttl = heal.ttl = 1000;
    frames.update(handler, 0.01);
  }
  near(particle.y, 75);
  near(heal.y, 175);
});
