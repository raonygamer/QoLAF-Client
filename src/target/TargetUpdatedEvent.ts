import { NativeEvent } from '../game/Bindings';
import type { TargetSystem } from './TargetSystem';

export interface TargetUpdatedEvent extends NativeEvent {
  targetSystem: TargetSystem;
  clone(): TargetUpdatedEvent;
}

/** Original TargetUpdatedEvent payload and clone semantics on a native event. */
export function createTargetUpdatedEvent(
  targetSystem: TargetSystem,
  type = 'target_updated_event',
  bubbles = false,
  cancelable = false,
): TargetUpdatedEvent {
  const event: TargetUpdatedEvent = Object.assign(new NativeEvent(type, bubbles, cancelable), {
    targetSystem,
    clone(): TargetUpdatedEvent {
      return createTargetUpdatedEvent(
        event.targetSystem,
        event.type,
        event.bubbles,
        event.cancelable,
      );
    },
  });
  return event;
}
