/** Sequence fields read by the client around the native Effects-table factory. */
export interface EffectEmitter {
  bitmap: string;
  delay?: number;
}

export interface EffectSequence {
  emitters: EffectEmitter[];
  singleUse?: boolean;
  multiple?: boolean;
  multipleDelay?: number;
  multipleRadius?: number;
}
