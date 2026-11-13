/** Cache tech levels consumed by native Weapon.addTechStats. */
export interface WeaponTechLevel {
  incDmg: number;
  incReloadRate: number;
  incRange: number;
  incSpeed: number;
  incAcceleration: number;
  incSpread: number;
  incRotationSpeed: number;
  incMultiNrOfP: number;
  incMultiOffset: number;
  incMultiAngleOffset: number;
  incAimArc?: number;
  incMaxProjectiles?: number;
  dot?: number;
  dotDuration?: number;
  radius?: number;
  heatCost?: number | string;
  numberOfHits?: number;
  shieldVamp?: number;
  healthVamp?: number;
  positionVariance?: number;
}

export interface WeaponTechDefinition {
  techLevels: readonly WeaponTechLevel[];
}
