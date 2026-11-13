import type { TextHandler, TextParticle, Unit } from './Bindings';

/** Extra arguments supplied by QoLAF's TextHandler.add patch. */
export interface CombatTextHandler extends TextHandler {
  add: (
    ...args: [
      ...Parameters<TextHandler['add']>,
      noWrap?: boolean,
      maximumRise?: number,
      sourceUnit?: Unit | null,
      sourceSlot?: string,
    ]
  ) => TextParticle;
}
