import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ChatHistory } from '../src/Chat/ChatHistory';
import { parseCommand } from '../src/Chat/ChatCommandParser';
import { Telemetry } from '../src/Telemetry/Telemetry';
import { settings } from '../src/Settings/Settings';
import { TargetSystem } from '../src/Target/TargetSystem';
import { lineFitness, artifactFitness } from '../src/Artifacts/Fitness';

test('history preserves drafts, deduplicates, caps and clamps traversal', () => {
  const h = new ChatHistory(2);
  h.record('one');
  h.record('two');
  h.record('two');
  assert.equal(h.previous('draft'), 'two');
  assert.equal(h.previous('two'), 'one');
  assert.equal(h.previous('one'), 'one');
  assert.equal(h.next('one'), 'two');
  assert.equal(h.next('two'), 'draft');
  assert.equal(h.next('draft'), 'draft');
  h.record('three');
  assert.equal(h.previous(''), 'three');
  assert.equal(h.previous(''), 'two');
  h.begin('new draft');
  assert.equal(h.previous('new draft'), 'three');
  assert.equal(h.next(''), 'new draft');
});
test('parser handles quotes, empty arguments, escaped delimiters and malformed input', () => {
  assert.deepEqual(parseCommand('/qolaf "two words" \'\' a\\ b'), [
    '/qolaf',
    'two words',
    '',
    'a b',
  ]);
  assert.deepEqual(parseCommand('  x\t y\n'), ['x', 'y']);
  assert.throws(() => parseCommand('x\\'), /incomplete escape/);
  assert.throws(() => parseCommand('"x'), /unterminated quote/);
});
test('telemetry preserves AS3 sampling, smoothing and display scale', () => {
  const m = new Telemetry();
  for (let i = 0; i < 30; i++) m.advance(1 / 60, 3, 4, true);
  m.advance(1 / 60, 3, 4, true);
  assert.ok(Math.abs(m.fps - 60) < 1e-8);
  assert.equal(m.displaySpeed(false), 180);
  assert.equal(m.displaySpeed(true), 180 / 1.609344);
  m.advance(0.12, 0, 0, true);
  assert.ok(Math.abs(m.speed - 5 / Math.E) < 1e-8);
  m.advance(NaN, 0, 0, false);
  assert.ok(Number.isFinite(m.speed));
  m.advance(0.1, 0, 0, false);
  assert.ok(Number.isNaN(m.speed));
});
test('settings accept only supported keys and correct types; clamp range', () => {
  const s = settings({
    auto_target: false,
    target_search_distance: 99999,
    nearby_enemy_radar_lines: -1,
    show_radar_fps: 'no',
    aim_assist: true,
  });
  assert.equal(s.auto_target, false);
  assert.equal(s.target_search_distance, 5000);
  assert.equal(s.nearby_enemy_radar_lines, 0);
  assert.equal(s.show_radar_fps, true);
  assert.equal('aim_assist' in s, false);
});
function scene() {
  const ship = { alive: true, get_pos: () => ({ x: 0, y: 0 }) };
  const game = { get_me: () => ({ ship, get_group: () => ({ id: 'ours' }) }) };
  const unit = (x: number, extra = {}) => ({ alive: true, get_pos: () => ({ x, y: 0 }), ...extra });
  return { system: new TargetSystem(game, settings({})), unit, ship };
}
test('target cooldown, locking, invalidation and strict range boundary', () => {
  const { system: s, unit, ship } = scene(),
    a = unit(5),
    b = unit(8);
  assert.equal(s.select(ship), false);
  assert.equal(s.select(unit(2000)), false);
  assert.equal(s.select(a), true);
  assert.equal(s.select(b), false);
  s.update(0.5);
  assert.equal(s.select(b), true);
  s.locked = true;
  s.clear();
  assert.equal(s.current, b);
  s.update(1);
  assert.equal(s.select(a), false);
  b.alive = false;
  s.update(0.1);
  assert.equal(s.current, null);
  assert.equal(s.locked, false);
});
test('automatic targets exclude AF and prefer players over NPCs but not group members', () => {
  const { system: s, unit } = scene();
  const npc = unit(5),
    player = unit(8, { player: { isMe: false, get_group: () => null } });
  assert.equal(s.auto(unit(1, { hasFaction: () => true })), false);
  assert.equal(s.auto(npc), true);
  assert.equal(s.auto(player), true);
  s.update(1);
  assert.equal(s.auto(npc), false);
  s.clear(true);
  s.select(npc);
  s.update(1);
  assert.equal(s.auto(unit(2, { player: { get_group: () => ({ id: 'ours' }) } })), false);
});
test('locked target can move outside range but cannot survive death', () => {
  const { system: s, unit } = scene();
  let x = 1;
  const a = unit(0, { get_pos: () => ({ x, y: 0 }) });
  s.select(a);
  s.locked = true;
  x = 5000;
  s.update(1);
  assert.equal(s.current, a);
  s.locked = false;
  s.update(1);
  assert.equal(s.current, null);
});
test('artifact scoring preserves conversion thresholds, aliases and unique constants', () => {
  assert.equal(lineFitness('convHp', 999), 999 * 0.0425);
  assert.equal(lineFitness('convHp', 1000), 43);
  assert.equal(lineFitness('healthAdd3', 1000), 2.264);
  assert.equal(lineFitness('velocityCore', 0), 50);
  assert.equal(lineFitness('unknown', 999), 0);
  assert.equal(
    artifactFitness({
      stats: [
        { type: 'dotDamage', value: 2 },
        { type: 'directDamage', value: 4 },
      ],
    }),
    12,
  );
});

test('target validity uses Haxe landed accessor and rejects locking an invalid selection', () => {
  const game = { me: { ship: { pos: { x: 0, y: 0 } } } };
  const system = new TargetSystem(game, settings({}));
  const player = {
    alive: true,
    pos: { x: 10, y: 0 },
    player: { isMe: false },
    get_landed: () => true,
  };
  assert.equal(system.valid(player), false);
  assert.equal(system.select(player), false);
  system.locked = true;
  assert.equal(system.locked, false);
  player.get_landed = () => false;
  assert.equal(system.select(player), true);
  system.locked = true;
  assert.equal(system.locked, true);
  player.get_landed = () => true;
  system.update(0.01);
  assert.equal(system.current, null);
  assert.equal(system.locked, false);
});
