import type { TextParticle, Unit } from './Bindings';

/** Methods added by the original QoLAF TextParticle patch. */
export interface CombatTextParticle extends TextParticle {
  setMaximumRise(originY: number, maximumRise: number): void;
  setMaximumRiseOrigin(originY: number): void;
  shiftMaximumRiseOrigin(deltaY: number): void;
  clampUpwardTravel(): void;
  assignSourceOwner(owner: Unit | null, slot: string): void;
  followSourceRenderPosition(owner: Unit | null, x: number, y: number, anchorOffset: number): void;
  releaseSourceOwner(): void;
}
