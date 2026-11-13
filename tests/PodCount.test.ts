import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PodCount } from '../src/pods/PodCount';

test('post-purchase count supersedes an older pending read without nested RPC registration', async () => {
  const replies: Array<(value: number) => void> = [],
    applied: number[] = [];
  let requests = 0;
  const count = new PodCount<number>({
    send: (reply) => {
      requests++;
      replies.push(reply);
    },
    apply: (value) => applied.push(value),
    waiting() {},
    timeout() {},
    failed() {},
  });
  count.request();
  count.request(true);
  count.request(true);
  assert.equal(requests, 1);
  replies.shift()!(0);
  assert.equal(requests, 1, 'replacement request is deferred beyond the active dispatch');
  assert.equal(count.known, false);
  assert.deepEqual(applied, []);
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(requests, 2);
  replies.shift()!(10);
  assert.deepEqual(applied, [10]);
  assert.equal(count.known, true);
  count.dispose();
});

test('closed count view ignores late replies and invalid replies cannot establish a balance', () => {
  const replies: Array<(value: number) => void> = [];
  let applied = 0,
    failures = 0;
  const count = new PodCount<number>({
    send: (reply) => replies.push(reply),
    apply: (value) => {
      if (value < 0) throw new Error('invalid');
      applied++;
    },
    waiting() {},
    timeout() {},
    failed() {
      failures++;
    },
  });
  count.request();
  replies.shift()!(-1);
  assert.equal(count.known, false);
  assert.equal(failures, 1);
  count.request();
  count.dispose();
  replies.shift()!(10);
  assert.equal(applied, 0);
});

test('count timeout leaves its read pending and accepts its eventual reply', (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  let receive: (value: number) => void = () => {};
  let timeouts = 0;
  const applied: number[] = [];
  const count = new PodCount<number>({
    send: (reply) => {
      receive = reply;
    },
    apply: (value) => applied.push(value),
    waiting() {},
    timeout() {
      timeouts++;
    },
    failed() {},
  });
  count.request();
  context.mock.timers.tick(8000);
  assert.equal(timeouts, 1);
  assert.equal(count.pending, true);
  assert.equal(count.known, false);
  receive(4);
  assert.deepEqual(applied, [4]);
  assert.equal(count.known, true);
  count.dispose();
});
