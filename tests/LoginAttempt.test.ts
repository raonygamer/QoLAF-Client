import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LoginAttempt } from '../src/login/LoginAttempt';

test('login timeout allows retry without accepting late callbacks from the previous account', (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const attempts = new LoginAttempt();
  let timeouts = 0;
  const first = attempts.start(() => timeouts++);
  context.mock.timers.tick(29_999);
  assert.equal(timeouts, 0);
  context.mock.timers.tick(1);
  assert.equal(timeouts, 1);
  assert.equal(attempts.finish(first), false);

  const second = attempts.start(() => timeouts++);
  assert.equal(attempts.finish(first), false, 'stale response cannot consume the new attempt');
  assert.equal(attempts.finish(second), true);
  assert.equal(attempts.finish(second), false, 'duplicate success is ignored');
  context.mock.timers.tick(30_000);
  assert.equal(timeouts, 1);

  const third = attempts.start(() => timeouts++);
  attempts.cancel();
  assert.equal(attempts.isCurrent(third), false);
  context.mock.timers.tick(30_000);
  assert.equal(timeouts, 1, 'leaving the login screen cancels the timeout');
});

test('Control cancellation retires authentication before a retry and rejects late success or failure', (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const attempts = new LoginAttempt();
  let timeouts = 0;
  const cancelled = attempts.start(() => timeouts++);
  attempts.cancel();
  assert.equal(attempts.finish(cancelled), false);
  const retry = attempts.start(() => timeouts++);
  assert.equal(attempts.finish(cancelled), false);
  assert.equal(attempts.isCurrent(retry), true);
  assert.equal(attempts.finish(retry), true);
  context.mock.timers.tick(30_000);
  assert.equal(timeouts, 0);
});
