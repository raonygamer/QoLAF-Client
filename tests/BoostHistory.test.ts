import assert from 'node:assert/strict';
import test from 'node:test';
import { BoostHistory, boostReadyAt } from '../src/movement/BoostHistory';

test('boost replay uses start-inclusive end-exclusive heading timestamps', () => {
  const history = new BoostHistory();
  history.add(1000, 500, 1000);
  assert.equal(history.activeAt(999), false);
  assert.equal(history.activeAt(1000), true);
  assert.equal(history.activeAt(1499), true);
  assert.equal(history.activeAt(1500), false);
  // Current visual expiration does not erase the interval used by delayed replay.
  assert.equal(history.activeAt(1200), true);
});

test('authoritative acknowledgement moves the nearest prediction and does not create a second interval', () => {
  const history = new BoostHistory();
  history.add(1000, 200, 1000);
  assert.equal(history.confirm(1033, 200, 1100), true);
  assert.equal(history.activeAt(1000), false);
  assert.equal(history.activeAt(1200), true);
  assert.equal(history.activeAt(1233), false);
});

test('a duplicate acknowledgement cannot steal the next predicted boost', () => {
  const history = new BoostHistory();
  history.add(1000, 100, 1000);
  history.confirm(1033, 100, 1033);
  history.add(2000, 100, 2000);
  assert.equal(history.confirm(1066, 100, 2000), false);
  assert.equal(history.activeAt(2000), true);
  assert.equal(history.confirm(2033, 100, 2033), true);
  assert.equal(history.activeAt(2000), false);
  assert.equal(history.activeAt(2033), true);
});

test('history pruning preserves exact five-second boundary and reset removes all windows', () => {
  const history = new BoostHistory();
  history.add(1000, 100, 1000, true);
  history.add(6100, 100, 6100);
  assert.equal(history.activeAt(1050), true);
  history.add(6101, 100, 6101);
  assert.equal(history.activeAt(1050), false);
  history.reset();
  assert.equal(history.activeAt(6150), false);
});

test('cooldown originates at the command timestamp and respects the original reduction cap', () => {
  assert.equal(boostReadyAt(1000, 10000, 0), 11000);
  assert.equal(boostReadyAt(1000, 10000, 0.25), 8500);
  assert.equal(boostReadyAt(1000, 10000, 0.4), 7000);
  assert.equal(boostReadyAt(1000, 10000, 0.9), 7000);
});
