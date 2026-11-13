import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PodRewardNotice } from '../src/chat/PodRewardNotice';
import { PurchaseNotice } from '../src/chat/PurchaseNotice';
import { RareArtifactNotice } from '../src/chat/RareArtifactNotice';

test('reward notices preserve literal chat role markers and HTML in player and item names', () => {
  const player = '[error]<A&B>"\'';
  const item = '[mod] <relic>';
  const name = '&#91;error&#93;&lt;A&amp;B&gt;&quot;&apos;';
  const escapedItem = '&#91;mod&#93; &lt;relic&gt;';
  assert.equal(
    PodRewardNotice.format(player, item),
    `<font color='#ff4b85'>${name} received ${escapedItem} from a pod!</font>`,
  );
  assert.equal(
    PurchaseNotice.format(player, item),
    `<font color='#ff4b85'>${name} just bought ${escapedItem}!</font>`,
  );
  assert.equal(
    RareArtifactNotice.format(player, item, 50),
    `<font color='#43efdf'>${name} got a ${escapedItem}!</font>`,
  );
});

test('source escaping bounds encoded text without splitting entities', () => {
  assert.equal(PodRewardNotice.escape('&'.repeat(141), 700), '&amp;'.repeat(140) + '...');
  assert.equal(PodRewardNotice.escape('[', 4), '...');
  assert.equal(PodRewardNotice.escape('[', 5), '&#91;');
  assert.equal(PodRewardNotice.escape('already &amp;'), 'already &amp;amp;');
  for (const format of [PodRewardNotice.format, PurchaseNotice.format, RareArtifactNotice.format]) {
    // Use each class receiver: PodRewardNotice.format calls its own static helpers.
    const owner =
      format === PodRewardNotice.format
        ? PodRewardNotice
        : format === PurchaseNotice.format
          ? PurchaseNotice
          : RareArtifactNotice;
    const output = format.call(owner, '&'.repeat(141), 'item');
    assert.ok(output.includes('&amp;'.repeat(140) + '...'));
    assert.ok(!output.includes('&amp;'.repeat(141)));
  }
});
