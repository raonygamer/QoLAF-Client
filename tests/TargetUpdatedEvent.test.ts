import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import { bindGameClasses } from '../src/game/Bindings';
import { defaults } from '../src/settings/Settings';
import { TargetSystem } from '../src/target/TargetSystem';
import { createTargetUpdatedEvent } from '../src/target/TargetUpdatedEvent';

test('target event clones preserve the current source payload and event flags', () => {
  class Event {
    constructor(
      public type: string,
      public bubbles = false,
      public cancelable = false,
    ) {}
  }
  bindGameClasses({
    cls: (name: string) => (name === 'openfl.events.Event' ? Event : {}),
  } as unknown as API);
  const first = new TargetSystem({ get_me: () => null }, { ...defaults });
  const second = new TargetSystem({ get_me: () => null }, { ...defaults });
  const event = createTargetUpdatedEvent(first);
  assert.equal(event.type, 'target_updated_event');
  assert.equal(event.bubbles, false);
  assert.equal(event.cancelable, false);
  event.type = 'forwarded_target_event';
  event.bubbles = true;
  event.cancelable = true;
  event.targetSystem = second;
  const clone = event.clone();
  assert.notEqual(clone, event);
  assert.ok(clone instanceof Event);
  assert.equal(clone.type, event.type);
  assert.equal(clone.bubbles, true);
  assert.equal(clone.cancelable, true);
  assert.equal(clone.targetSystem, second);
  assert.equal(clone.clone().targetSystem, second);
});
