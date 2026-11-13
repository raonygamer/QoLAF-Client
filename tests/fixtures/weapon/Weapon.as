package core.weapon {
import core.GameObject;
import core.player.EliteTechs;
import core.projectile.Projectile;
import core.scene.Game;
import core.scene.SceneBase;
import core.ship.EnemyShip;
import core.ship.PlayerShip;
import core.unit.Unit;

import flash.errors.IllegalOperationError;
import flash.geom.Point;
import flash.utils.getTimer;

import generics.Localize;
import generics.Util;

import sound.ISound;
import sound.SoundLocator;

public class Weapon extends GameObject {
    public static const TYPE_FLEE:int = 0;
    public static const TYPE_ANTIPROJECTILE:int = 1;
    public var type:String;
    public var dmg:Damage;
    public var weaponDebuffs:Vector.<WeaponDebuff> = new Vector.<WeaponDebuff>();
    public var hasCorrosiveEliteTech:Boolean = false;
    public var fireEffect:String;
    public var dmgRadius:int;
    public var numberOfHits:int;
    public var reloadTime:Number;
    public var speed:Number;
    public var acceleration:Number;
    public var ttl:int;
    public var projectileFunction:String;
    public var range:Number;
    public var friction:Number;
    public var angleVariance:Number;
    public var positionYVariance:Number;
    public var positionXVariance:Number;
    public var sideShooter:Boolean;
    public var positionOffsetX:Number;
    public var positionOffsetY:Number;
    public var maxProjectiles:int;
    public var projectiles:Vector.<Projectile>;
    public var multiNrOfP:int;
    public var multiOffset:Number;
    public var multiAngleOffset:Number;
    public var multiSpreadStart:Boolean;
    public var fireSound:String;
    public var alive:Boolean;
    public var fireNextTime:Number;
    public var rotationSpeed:Number;
    public var unit:Unit;
    public var target:Unit;
    public var hasTechTree:Boolean;
    public var key:String;
    public var useShipSystem:Boolean;
    public var randomAngle:Boolean;
    public var techIconFileName:String;
    public var cloakDuration:Number;
    public var artifact_dotDurationMultiplier:Number = 1;
    public var specialCondition:String;
    public var specialBonusPercentage:Number;
    public var waveDirection:int;
    public var isMissileWeapon:Boolean;
    public var fireBackwards:Boolean;
    public var aimArc:Number;
    public var level:int;
    public var heatCost:Number;
    public var shieldVamp:Number;
    public var healthVamp:Number;
    public var burst:int;
    public var burstDelay:Number;
    public var burstCurrent:int;
    public var active:Boolean;
    public var hotkey:int;
    public var hasChargeUp:Boolean;
    public var chargeUpTimeMax:Number;
    protected var g:Game;
    protected var _fire:Boolean;
    public var chargeUpTime:Number;
    public var lastFire:Number = 0;
    public var global:Boolean = false;
    public var triggerMeleeAnimation:Boolean = false;
    public var fireCallback:Function;
    private var _lastSimulatedHitUnit:Unit;
    private var _lastSimulatedHitTime:int = int.MIN_VALUE;

    public function Weapon(param1:Game) {
        super();
        chargeUpTime = 0;
        heatCost = 0;
        this.g = param1;
    }

    public function init(param1:Object, param2:int, param3:int = -1, param4:String = ""):void {
        var local6:int = 0;
        var local7:WeaponDebuff = null;
        var local5:ISound = null;
        // Weapons are pooled; only the ET applied during this init may opt out.
        hasCorrosiveEliteTech = false;
        this.type = param1.type;
        name = param1.name;
        if (param1.hasOwnProperty("damageType")) {
            local6 = int(param1.damageType);
        }
        dmg = new Damage(param1.dmg, local6);
        if (param1.hasOwnProperty("shieldVamp")) {
            shieldVamp = param1.shieldVamp;
        } else {
            shieldVamp = 0;
        }
        if (param1.hasOwnProperty("healthVamp")) {
            healthVamp = param1.healthVamp;
        } else {
            healthVamp = 0;
        }
        if (param1.hasOwnProperty("burst")) {
            burst = param1.burst;
        } else {
            burst = 1;
        }
        if (param1.hasOwnProperty("burstDelay")) {
            burstDelay = param1.burstDelay;
        } else {
            burstDelay = 30;
        }
        if (param1.hasOwnProperty("debuffType") && Boolean(param1.hasOwnProperty("dot")) && Boolean(param1.hasOwnProperty("dotDamageType")) && Boolean(param1.hasOwnProperty("dotDuration"))) {
            local7 = new WeaponDebuff(param1.debuffType, param1.dotDuration, new Damage(param1.dot, param1.dotDamageType), param1.hasOwnProperty("dotEffect") ? param1.dotEffect : "");
            weaponDebuffs.push(local7);
        } else if (this is Cloak) {
            cloakDuration = param1.dotDuration;
        }
        if (param1.hasOwnProperty("heatCost")) {
            heatCost = Number(param1.heatCost) / 1000;
        } else {
            heatCost = 0;
        }
        if (param1.hasOwnProperty("numberOfHits")) {
            numberOfHits = param1.numberOfHits;
        } else {
            numberOfHits = 1;
        }
        speed = param1.speed;
        reloadTime = param1.reloadTime;
        ttl = param1.ttl;
        acceleration = param1.acceleration;
        rotationSpeed = param1.rotationSpeed;
        positionYVariance = param1.positionVariance;
        if (param1.hasOwnProperty("positionXVariance")) {
            positionXVariance = param1.positionXVariance;
        } else {
            positionXVariance = 0;
        }
        if (param1.hasOwnProperty("multiSideFire")) {
            sideShooter = param1.multiSideFire;
        } else {
            sideShooter = false;
        }
        if (param1.hasOwnProperty("positionOffset")) {
            positionOffsetX = param1.positionOffset;
        }
        if (param1.hasOwnProperty("positionOffsetY")) {
            positionOffsetY = param1.positionOffsetY;
        }
        if (param1.hasOwnProperty("friction")) {
            friction = param1.friction;
        }
        maxProjectiles = param1.maxProjectiles;
        if (maxProjectiles > 0) {
            ttl = 120000;
        }
        multiNrOfP = param1.multiNrOfP;
        multiOffset = param1.multiOffset;
        multiAngleOffset = Util.degreesToRadians(param1.multiAngleOffset);
        angleVariance = param1.angleVariance;
        if (param1.hasOwnProperty("aimArc")) {
            aimArc = param1.aimArc;
        }
        fireSound = param1.fireSound;
        if (fireSound != null) {
            local5 = SoundLocator.getService();
            local5.preCacheSound(fireSound);
        }
        hasTechTree = param1.hasTechTree;
        if (param1.hasOwnProperty("multiSpreadStart")) {
            multiSpreadStart = param1.multiSpreadStart;
        } else {
            multiSpreadStart = false;
        }
        if (param1.hasOwnProperty("radius")) {
            dmgRadius = param1.radius;
        } else {
            dmgRadius = 0;
        }
        range = param1.range;
        if (hasTechTree) {
            techIconFileName = param1.techIcon;
            level = param2;
            if (param2 > 0) {
                addTechStats(param1, param2);
            }
            if (param3 > 0) {
                addEliteTechStats(param1, param3, param4);
            }
            triggerMeleeAnimation = param1.triggerMeleeAnimation;
        }
        if (this is Cloak) {
            reloadTime += 3 * cloakDuration * 1000;
            trace("weapon init cloak reloadtime: " + reloadTime);
        }
        global = param1.global;
    }

    public function addDebuff(param1:int, param2:Number, param3:Damage, param4:String):void {
        for each(var local5:* in weaponDebuffs) {
            if (local5.type == param1 && local5.damage.type == param3.type) {
                local5.effect = param4;
                local5.damage.addBaseDmg(param3.dmg());
                return;
            }
        }
        var local6:WeaponDebuff = new WeaponDebuff(param1, param2, param3, param4);
        weaponDebuffs.push(local6);
    }

    public function removeDebuff(param1:int, param2:Damage):void {
        var local3:int = 0;
        var local4:WeaponDebuff = null;
        local3 = weaponDebuffs.length - 1;
        while (local3 >= 0) {
            local4 = weaponDebuffs[local3];
            if (local4.type == param1 && local4.damage.type == param2.type) {
                if (Math.abs(local4.damage.dmg() - param2.dmg()) < 0.01) {
                    weaponDebuffs.splice(local3, 1);
                } else {
                    local4.damage.addBaseDmg(-param2.dmg());
                }
                return;
            }
            local3--;
        }
    }

    public function getDescription(param1:Boolean):String {
        var local4:String = null;
        var local2:PetSpawner = null;
        local4 = Localize.t("<FONT COLOR=\'#8888ff\'>[name], lvl [level]</FONT>\n").replace("[name]", Localize.t(name)).replace("[level]", level);
        local4 = local4 + dmg.damageText();
        if (multiNrOfP > 1) {
            local4 += Localize.t("Fires <FONT COLOR=\'#eeeeee\'>[nrp]</FONT>x projectiles\n").replace("[nrp]", multiNrOfP);
        }
        if (!param1 && name != "Acid Spray" && name != "Flamethrower") {
            local4 += Localize.t("Fires <FONT COLOR=\'#eeeeee\'>[rps]</FONT> rounds per second.\n").replace("[rps]", (1000 * multiNrOfP / reloadTime).toFixed(1));
        }
        if (multiNrOfP == 0) {
            local4 += Localize.t("Damage per second: <FONT COLOR=\'#eeeeee\'>[dps]</FONT>\n").replace("[dps]", (dmg.dmg() * burst * 1000 / (reloadTime + (burst - 1) * 33)).toFixed(1));
        } else {
            local4 += Localize.t("Damage per second: <FONT COLOR=\'#eeeeee\'>[dps]</FONT>\n").replace("[dps]", (dmg.dmg() * burst * multiNrOfP * 1000 / (reloadTime + (burst - 1) * 33)).toFixed(1));
        }
        if (shieldVamp > 0 || healthVamp > 0) {
            local4 += "\n";
            if (shieldVamp > 0) {
                local4 += Localize.t("<FONT COLOR=\'#4444ff\'>Steals [shieldVamp]% of damage done to enemy shields</FONT>\n").replace("[shieldVamp]", shieldVamp.toFixed(1));
            }
            if (healthVamp > 0) {
                local4 += Localize.t("<FONT COLOR=\'#ff4444\'>Steals [healthVamp]% of damage done to enemy health</FONT>\n").replace("[healthVamp]", healthVamp.toFixed(1));
            }
        }
        if (this is Cloak) {
            local4 += Localize.t("Cloak duration: <FONT COLOR=\'#eeeeee\'>[duration]</FONT> seconds").replace("[duration]", this.cloakDuration.toFixed(1));
        }
        if (weaponDebuffs.length > 0) {
            local4 += Localize.t("\nDebuff:\n");
        }
        for each(var local3:* in weaponDebuffs) {
            local4 += Debuff.debuffText(local3.type, local3.duration * artifact_dotDurationMultiplier, local3.damage);
        }
        if (this is PetSpawner) {
            local2 = this as PetSpawner;
            local4 += Localize.t("\nMax number of Pets: [maxPets]").replace("[maxPets]", local2.maxPets);
        }
        if (specialCondition != null && specialCondition != "") {
            local4 += Localize.t("\nDeals <FONT COLOR=\'#eeeeee\'>[bonus]%</FONT> more damage if target is afflicted by [condition].").replace("[bonus]", specialBonusPercentage.toString()).replace("[condition]", Localize.t(specialCondition));
        }
        return local4;
    }

    private function addTechStats(param1:Object, param2:int):void {
        var local10:Object = null;
        var local4:int = 0;
        if (param2 > 6) {
            param2 = 6;
        }
        var local3:int = 100;
        var local13:int = 100;
        var local11:int = 100;
        var local12:int = 100;
        var local8:int = 100;
        var local7:int = 100;
        var local5:int = 100;
        var local6:int = 100;
        local4 = 0;
        while (local4 < param2) {
            local10 = param1.techLevels[local4];
            local3 += local10.incDmg;
            for each(var local9:* in weaponDebuffs) {
                if (local10.hasOwnProperty("dot")) {
                    local9.damage.addBaseDmg(local10.dot);
                }
                if (local10.hasOwnProperty("dotDuration")) {
                    local9.duration += local10.dotDuration;
                }
            }
            if (this is Cloak) {
                if (local10.hasOwnProperty("dotDuration")) {
                    cloakDuration += local10.dotDuration;
                }
            }
            local13 += local10.incReloadRate;
            local11 += local10.incRange;
            local12 += local10.incSpeed;
            local8 += local10.incAcceleration;
            local7 += local10.incSpread;
            local5 += local10.incRotationSpeed;
            if (local10.hasOwnProperty("incAimArc")) {
                local6 += local10.incAimArc;
            }
            if (local10.hasOwnProperty("radius")) {
                dmgRadius += local10.radius;
            }
            if (local10.hasOwnProperty("radius")) {
                maxProjectiles += local10.incMaxProjectiles;
            }
            if (local4 == param2 - 1) {
                if (local10.hasOwnProperty("heatCost")) {
                    heatCost = Number(local10.heatCost) / 1000;
                }
                if (local10.hasOwnProperty("numberOfHits")) {
                    numberOfHits = local10.numberOfHits;
                }
                if (local10.hasOwnProperty("shieldVamp")) {
                    shieldVamp = local10.shieldVamp;
                }
                if (local10.hasOwnProperty("healthVamp")) {
                    healthVamp = local10.healthVamp;
                }
                if (local10.hasOwnProperty("positionVariance")) {
                    positionYVariance = local10.positionVariance;
                }
            }
            multiNrOfP += local10.incMultiNrOfP;
            multiOffset += local10.incMultiOffset;
            multiAngleOffset += Util.degreesToRadians(local10.incMultiAngleOffset);
            local4++;
        }
        dmg.setBaseDmg(dmg.dmg() * local3 / 100);
        speed = speed * local12 / 100;
        range = range * local11 / 100;
        reloadTime = reloadTime * 100 / local13;
        ttl = ttl * local11 / 100;
        acceleration = acceleration * local8 / 100;
        aimArc = aimArc * local6 / 100;
        rotationSpeed = rotationSpeed * local5 / 100;
    }

    private function addEliteTechStats(param1:Object, param2:int, param3:String):void {
        EliteTechs.addWeaponEliteTechs(this, param1, param2, param3);
    }

    public function addCorrosiveArtifactDamagePercent(percent:Number):void {
        // Mirror the current server bug: corrosive % scales all damage unless
        // this weapon has an active corrosive ET. Keep the displayed percentage
        // (not the separate allMulti artifact stat's 1.5 coefficient).
        var damageType:int = hasCorrosiveEliteTech ? Damage.CORROSIVE : Damage.ALL;
        dmg.addDmgPercent(percent, damageType);
        for each(var debuff:WeaponDebuff in weaponDebuffs) {
            debuff.damage.addDmgPercent(percent, damageType);
        }
    }

    override public function update():void {
        if (_fire && unit is PlayerShip) {
            var firingShip:PlayerShip = unit as PlayerShip;
            if (firingShip.player != null && firingShip.player.isMe &&
                    firingShip.player.ship === firingShip && firingShip.weapon !== this) {
                // A stale packet/flag must not simulate an unequipped gun or
                // drain local energy while the server uses the selected one.
                fire = false;
                return;
            }
        }
        if (_fire && unit.isAddedToCanvas) {
            if (fireCallback != null && this.hasChargeUp == false) {
                fireCallback();
            }
            pos.x = unit.x;
            pos.y = unit.y;
            shoot();
        }
    }

    public function registerSimulatedHit(hitUnit:Unit, includeEstimate:Boolean = true):void {
        recordIncomingHit(hitUnit);
        if (hitUnit == null || unit == null || dmg == null || dmg.type == Damage.HEAL ||
                g == null || g.me == null || g.me.ship == null) {
            return;
        }
        if (unit != g.me.ship && unit.owner != g.me.ship) {
            return;
        }
        _lastSimulatedHitUnit = hitUnit;
        _lastSimulatedHitTime = getTimer();
        if (includeEstimate) recordEstimatedHit(hitUnit);
        if (g.targetSystem != null) g.targetSystem.tryAutoTarget(hitUnit);
    }

    /** Existing local contact only; never a server damage confirmation. */
    public function recordIncomingHit(hitUnit:Unit):void {
        if (g == null || g.isLeaving || unit == null || unit is PlayerShip ||
                unit.owner != null || dmg == null || dmg.type == Damage.HEAL ||
                !(hitUnit is PlayerShip) || !hitUnit.alive || hitUnit.invulnerable) {
            return;
        }
        var victim:PlayerShip = hitUnit as PlayerShip;
        // Mirrors share a Player but are not that player's current ship.
        if (victim.player == null || victim.player.ship !== victim) return;
        var amount:Number = dmg.dmg();
        if (!isFinite(amount) || amount <= 0) return;
        victim.player.recordIncomingWeaponHit(this);
    }

    public function canEstimateDamage():Boolean {
        // Enemy projectiles never need a per-account settings lookup.
        if (unit == null || g == null || g.isLeaving || g.me == null || g.me.ship == null ||
                (unit != g.me.ship && unit.owner != g.me.ship)) return false;
        if (!SceneBase.clientSettings.showRadarDPS || g.hud == null ||
                dmg == null || dmg.type == Damage.HEAL) return false;
        var amount:Number = dmg.dmg();
        return isFinite(amount) && amount > 0;
    }

    /** Display-only; inferred geometry must not alter auto-target/last-hit state. */
    public function recordEstimatedHit(hitUnit:Unit):void {
        // Base direct damage only: no server mitigation, DOT or hidden effects.
        if (canEstimateDamage() && hitUnit != null && hitUnit.alive && !hitUnit.invulnerable &&
                hitUnit != unit && hitUnit != g.me.ship && hitUnit.owner != g.me.ship &&
                (hitUnit.isHostile || unit.isHostile)) {
            var estimatedDamage:Number = dmg.dmg();
            if (isFinite(estimatedDamage) && estimatedDamage > 0) {
                g.hud.recordEstimatedDamage(estimatedDamage);
            }
        }
    }

    public function markDamageEstimatePartial():void {
        if (canEstimateDamage()) g.hud.markDamageEstimatePartial();
    }

    public function get lastSimulatedHitUnit():Unit {
        return _lastSimulatedHitUnit;
    }

    public function get lastSimulatedHitTime():int {
        return _lastSimulatedHitTime;
    }

    protected function shoot():void {
        throw new IllegalOperationError("Abstract method must be overriden");
    }

    public function set fire(param1:Boolean):void {
        var local2:PlayerShip = null;
        if (hasChargeUp && chargeUpTime > 0 && unit is PlayerShip) {
            local2 = unit as PlayerShip;
            local2.killChargeUpEffect();
            if (local2.player.isMe) {
                g.hud.powerBar.updateLoadBar(0);
            }
        }
        if (g.time - lastFire > reloadTime) {
            lastFire = 0;
            burstCurrent = 0;
        }
        chargeUpTime = 0;
        _fire = param1;
    }

    public function get fire():Boolean {
        return _fire;
    }

    public function destroy():void {
        alive = false;
    }

    public function playFireSound():void {
        var local1:Point = g.camera.getCameraCenter();
        var local4:Number = local1.x - unit.x;
        var local3:Number = local1.y - unit.y;
        if (local4 * local4 + local3 * local3 > 250000) {
            return;
        }
        var local2:ISound = SoundLocator.getService();
        local2.play(fireSound);
    }

    public function inRange(param1:Unit):Boolean {
        if (param1 == null) {
            return false;
        }
        if (!inAimAngle(param1)) {
            return false;
        }
        var local3:Number = unit.pos.x - param1.pos.x;
        var local2:Number = unit.pos.y - param1.pos.y;
        var local4:Number = local3 * local3 + local2 * local2 - param1.collisionRadius;
        return local4 <= range * range;
    }

    public function aim():Number {
        var local8:EnemyShip = null;
        if (target == null || unit == null) {
            return 0;
        }
        if (unit == target) {
            return unit.rotation;
        }
        var local5:Point = target.speed;
        if (target is EnemyShip) {
            local8 = target as EnemyShip;
            if (local8.stateMachine.inState("AIOrbit")) {
                local5 = local8.calculateOrbitSpeed();
            }
        }
        var local6:Number = target.pos.x - unit.pos.x;
        var local3:Number = target.pos.y - unit.pos.y;
        var local1:Number = Number(Math.sqrt(local6 * local6 + local3 * local3));
        local6 /= local1;
        local3 /= local1;
        var local7:Number = local1 / (speed - Util.dotProduct(target.speed.x, target.speed.y, local6, local3));
        var local4:Number = target.pos.x + local5.x * local7;
        var local2:Number = target.pos.y + local5.y * local7;
        return Math.atan2(local2 - unit.pos.y, local4 - unit.pos.x) - unit.rotation;
    }

    private function inAimAngle(param1:Unit):Boolean {
        var local3:Number = NaN;
        var local7:int = 0;
        var local2:Number = NaN;
        var local4:Number = NaN;
        var local5:Number = NaN;
        var local6:Number = NaN;
        if (this is SmartGun) {
            local3 = aimArc;
        } else {
            local3 = angleVariance;
        }
        local7 = 0;
        while (local7 < 4) {
            local2 = 0;
            local4 = 0;
            if (local7 == 0) {
                local4 = -param1.collisionRadius;
            }
            if (local7 == 1) {
                local4 = param1.collisionRadius;
            }
            if (local7 == 2) {
                local2 = -param1.collisionRadius;
            }
            if (local7 == 3) {
                local2 = param1.collisionRadius;
            }
            local5 = Number(Math.atan2(param1.pos.y - unit.pos.y + local2, param1.pos.x - unit.pos.x + local4));
            local6 = Util.angleDifference(unit.rotation, local5);
            if (Math.abs(local6) < local3) {
                return true;
            }
            local7++;
        }
        return false;
    }

    override public function draw():void {
    }

    public function setActive(param1:PlayerShip, param2:Boolean):Boolean {
        if (param2 && param1.activeWeapons < param1.unlockedWeaponSlots) {
            active = param2;
            param1.activeWeapons++;
            return true;
        }
        if (!param2) {
            active = param2;
            param1.activeWeapons--;
            return true;
        }
        return false;
    }

    override public function reset():void {
        hasCorrosiveEliteTech = false;
        projectileFunction = null;
        active = true;
        hotkey = 0;
        unit = null;
        dmg = null;
        dmgRadius = 0;
        fireBackwards = false;
        specialCondition = null;
        specialBonusPercentage = 0;
        numberOfHits = 0;
        reloadTime = 0;
        fireNextTime = 0;
        speed = 0;
        acceleration = 0;
        friction = 0;
        range = 0;
        ttl = 0;
        rotation = 0;
        heatCost = 0;
        maxProjectiles = 0;
        projectiles = new Vector.<Projectile>();
        multiNrOfP = 1;
        sideShooter = false;
        multiOffset = 0;
        multiAngleOffset = 0;
        name = null;
        type = null;
        angleVariance = 0;
        positionYVariance = 0;
        positionXVariance = 0;
        positionOffsetX = 0;
        positionOffsetY = 0;
        rotationSpeed = 0;
        aimArc = 0;
        fireSound = "";
        _fire = false;
        target = null;
        weaponDebuffs = new Vector.<WeaponDebuff>();
        useShipSystem = false;
        randomAngle = false;
        isMissileWeapon = false;
        waveDirection = 1;
        global = false;
        _lastSimulatedHitUnit = null;
        _lastSimulatedHitTime = int.MIN_VALUE;
        super.reset();
    }
}
}

