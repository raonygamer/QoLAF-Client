import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ProjectilePoolStats } from '../src/network/ProjectilePoolStats';

test('projectile diagnostics distinguish allocation, reuse, and pool growth', () => {
  const stats = new ProjectilePoolStats();
  const first = {};
  const second = {};
  stats.observe([first, second, first]);
  assert.equal(stats.created, 2);
  assert.equal(stats.checkouts, 0);
  stats.checkout(first);
  stats.checkout(first);
  assert.equal(stats.created, 2);
  assert.equal(stats.checkouts, 2);
  const growth = {};
  stats.checkout(growth);
  stats.observe([first, second, growth]);
  assert.equal(stats.created, 3);
  assert.equal(stats.checkouts, 3);
});
