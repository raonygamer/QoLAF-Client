/** Fields read by the native AIStateFactory from a Projectiles database record. */
export interface ProjectileAISettings {
  aiBlastSpeed?: number;
  ai: string;
  aiDelay?: number;
  aiFollow?: boolean;
  aiTargetSelf?: boolean;
  aiStick?: boolean;
  aiStickDuration?: number;
  aiDelayedAcceleration?: boolean;
  aiDelayedAccelerationTime?: number;
  aiMaxNrOfLines?: number;
  aiBranchingFactor?: number;
  aiSplitChance?: number;
  color?: number;
  glowColor?: number;
  thickness?: number;
  alpha?: number;
  amplitude?: number;
  frequency?: number | string;
  texture?: string | null;
}
