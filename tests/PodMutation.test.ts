import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PodMutation } from '../src/pods/PodMutation';

test('pod timeout retains the unresolved operation until its actual reply', () => {
  let now = 0;
  const ledger = new PodMutation(() => now);
  const operation = ledger.begin('buyPod')!;
  assert.equal(ledger.begin('openPod'), null);
  now = 7999;
  assert.equal(ledger.expired, false);
  now = 8000;
  assert.equal(ledger.expired, true);
  now = 60000;
  assert.equal(ledger.begin('buyPod'), null);
  assert.equal(ledger.acknowledge(operation), true);
  const next = ledger.begin('openPod')!;
  assert.equal(ledger.acknowledge(operation), false);
  assert.equal(ledger.current, next, 'old duplicate reply cannot unlock a newer operation');
});
