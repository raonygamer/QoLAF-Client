// Ported verbatim arithmetic from core/artifact/ArtifactStat.as.
export function lineFitness(type: string, value: number): number {
        switch (type) {
            case "healthAdd":
            case "healthAdd2":
            case "healthAdd3":
                return 0.002264 * value;
            case "healthMulti":
                return 0.5832 * value;
            case "armorAdd":
            case "armorAdd2":
            case "armorAdd3":
                return 0.15375 * value;
            case "armorMulti":
                return 0.333 * value;
            case "corrosiveAdd":
            case "corrosiveAdd2":
            case "corrosiveAdd3":
                return 0.3388 * value;
            case "corrosiveMulti":
                return 0.83325 * value;
            case "energyAdd":
            case "energyAdd2":
            case "energyAdd3":
                return 0.324 * value;
            case "energyMulti":
                return 0.83325 * value;
            case "kineticAdd":
            case "kineticAdd2":
            case "kineticAdd3":
                return 0.3132 * value;
            case "kineticMulti":
                return 0.79992 * value;
            case "shieldAdd":
            case "shieldAdd2":
            case "shieldAdd3":
                return 0.001925 * value;
            case "shieldMulti":
                return 0.54675 * value;
            case "shieldRegen":
                return 0.48 * value;
            case "corrosiveResist":
            case "energyResist":
            case "kineticResist":
                return 0.425 * value;
            case "allResist":
                return 1.1 * value;
            case "allAdd":
            case "allAdd2":
            case "allAdd3":
                return 0.23904 * value;
            case "allMulti":
                return 2.36925 * value;
            case "dotDamage":
                return 5 * value;
            case "dotDuration":
                return 2.5 * value;
            case "directDamage":
                return 0.5 * value;
            case "speed":
            case "speed2":
            case "speed3":
                return 0.88 * value;
            case "refire":
            case "refire2":
            case "refire3":
                return 0.529584 * value;
            case "convHp":
            case "convShield":
                return value >= 1000 ? 43 : 0.0425 * value;
            case "powerReg":
            case "powerReg2":
            case "powerReg3":
                return 0.24 * value;
            case "powerMax":
                return 0.3333 * value;
            case "cooldown":
            case "cooldown2":
            case "cooldown3":
                return 0.6666 * value;
            case "increaseRecyleRate":
                return 1.1 * value;
            case "damageReduction":
                return 1.5 * value;
            case "damageReductionWithLowHealth":
            case "damageReductionWithLowShield":
                return 1.4 * value;
            case "healthRegenAdd":
                return 0.1 * value;
            case "shieldVamp":
            case "healthVamp":
                return value;
            case "kineticChanceToPenetrateShield":
                return 0.05 * value;
            case "energyChanceToShieldOverload":
            case "corrosiveChanceToIgnite":
            case "beamAndMissileDoesBonusDamage":
                return 0.5 * value;
            case "recycleCatalyst":
                return value;
            case "velocityCore":
                return 50;
            case "slowDown":
                return 80;
            case "damageReductionUnique":
                return 50;
            case "damageReductionWithLowHealthUnique":
            case "damageReductionWithLowShieldUnique":
                return 35;
            case "overmind":
                return 30;
            case "upgrade":
                return 20;
            case "lucaniteCore":
                return 1.1 * value;
            case "mantisCore":
                return 0.8 * value;
            case "thermofangCore":
            case "reduceKineticResistance":
            case "reduceCorrosiveResistance":
            case "reduceEnergyResistance":
                return value;
            case "crownOfXhersix":
            case "fistOfZharix":
                return 10 * value;
            case "veilOfYhgvis":
            case "bloodlineSurge":
                return 50;
            case "dotDamageUnique":
                return 1.1 * value;
            case "directDamageUnique":
                return 0.5 * value;
            case "reflectDamageUnique":
                return 40;
            default:
                return 0;
        }
    }
export function artifactFitness(artifact: {stats: {type: string; value: number}[]}): number { return artifact.stats.reduce((sum, stat) => sum + lineFitness(stat.type, stat.value), 0); }
