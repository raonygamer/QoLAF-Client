import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ResourceUpgradeBatch } from '../src/tech/ResourceUpgradeBatch';

function fixture() {
  let available = true;
  const sent: number[] = [],
    acknowledged: number[] = [],
    completed: Array<number | null> = [];
  const replies: Array<(success: boolean) => void> = [];
  const batch = new ResourceUpgradeBatch<number>({
    valid: () => available,
    send: (level, reply) => {
      sent.push(level);
      replies.push(reply);
    },
    acknowledge: (level) => acknowledged.push(level),
    advance: (level) => (level < 6 ? level + 1 : null),
    finish: (level) => completed.push(level),
  });
  return {
    batch,
    sent,
    acknowledged,
    completed,
    replies,
    disconnect: () => {
      available = false;
    },
  };
}
const step = () => new Promise((resolve) => setTimeout(resolve, 65));

test('resource batch waits for each acknowledgement and stops at level six', async () => {
  const f = fixture();
  f.batch.start(4);
  f.batch.start(1);
  assert.deepEqual(f.sent, [4]);
  await step();
  assert.deepEqual(f.sent, [4], 'no request without an acknowledgement');
  const reply = f.replies.shift()!;
  reply(true);
  reply(true);
  assert.deepEqual(f.acknowledged, [4], 'duplicate reply cannot increment counters twice');
  assert.deepEqual(f.sent, [4], '50 ms gap before next request');
  await step();
  assert.deepEqual(f.sent, [4, 5]);
  f.replies.shift()!(true);
  await step();
  f.replies.shift()!(true);
  assert.deepEqual(f.sent, [4, 5, 6]);
  assert.deepEqual(f.completed, [null]);
  assert.equal(f.batch.active, false);
});

test('cancelled purchases retain late acknowledgements but cannot resume the batch', async () => {
  const f = fixture();
  f.batch.start(2);
  f.batch.cancel();
  f.replies.shift()!(true);
  await step();
  assert.deepEqual(f.acknowledged, [2]);
  assert.deepEqual(f.sent, [2]);
  assert.deepEqual(f.completed, []);
  f.batch.start(3);
  f.replies.shift()!(true);
  f.batch.cancel();
  await step();
  assert.deepEqual(f.sent, [2, 3], 'cancellation removes the pending timer');
});

test('rejected purchase stops at its level; disconnect prevents further purchases', async () => {
  const f = fixture();
  f.batch.start(2);
  f.replies.shift()!(false);
  assert.deepEqual(f.completed, [2]);
  assert.deepEqual(f.acknowledged, []);
  f.batch.start(3);
  f.disconnect();
  f.replies.shift()!(true);
  await step();
  assert.deepEqual(f.sent, [2, 3]);
  assert.deepEqual(f.acknowledged, [3]);
  assert.equal(f.batch.active, false);
});
