package core.weapon {
import core.hud.components.BeamLine;
import core.particle.Emitter;
import core.particle.EmitterFactory;
import core.scene.Game;
import core.ship.PlayerShip;
import core.ship.ClientDevVisual;
import core.filters.PhaseBladeBloomFilter;
import flash.geom.Matrix;
import core.solarSystem.Body;
import core.unit.Unit;

import flash.geom.Point;

import generics.Color;
import generics.Util;

import sound.ISound;
import sound.SoundLocator;

import starling.display.MeshBatch;

public class Beam extends Weapon {
    private static const SKELETOR_LIGHTNING:String = "Skeletor Lightning";
    private static const VISUAL_CONNECTION_GRACE:Number = 5 * Game.TICK_LENGTH;
    private static const VISUAL_AIM_HYSTERESIS:Number = 3 * 0.75 / Game.TICK_LENGTH;
    private var startEffect:Vector.<Emitter> = new Vector.<Emitter>();
    private var startEffect2:Vector.<Emitter> = new Vector.<Emitter>();
    private var endEffect:Vector.<Emitter> = new Vector.<Emitter>();
    public var startPos:Point = new Point();
    public var startPos2:Point = new Point();
    public var endPos:Point = new Point();
    public var lastPos:Point = new Point();
    private var renderStartPos:Point = new Point();
    private var renderStartPos2:Point = new Point();
    private var renderEndPos:Point = new Point();
    private var renderLastPos:Point = new Point();
    private var renderChainPos:Point = new Point();
    private var lines:Vector.<BeamLine> = new Vector.<BeamLine>();
    private var lineBatch:MeshBatch = new MeshBatch();
    private var hullColorTransform:Matrix = new Matrix();
    private var resourcesDisposed:Boolean = false;
    private var ready:Boolean = false;
    public var nrTargets:int = 0;
    public var secondaryTargets:Vector.<Unit> = new Vector.<Unit>();
    private var beamColor:uint = 16777215;
    private var beamAmplitude:Number = 2;
    private var beamThickness:Number = 1;
    private var startBeamAlpha:Number = 1;
    private var beamAlpha:Number = 1;
    private var beams:int = 3;
    private var beamNodes:Number = 0;
    private var glowColor:uint = 16711680;
    private var oldDrawBeam:Boolean;
    private var drawBeam:Boolean;
    private var targetBody:Body;
    private var chargeUpMax:int;
    private var chargeUPCurrent:int = 0;
    private var chargeUpCounter:int = 0;
    private var chargeUpNext:int = 8;
    private var chargeUpExpire:Number = 2000;
    private var lastDamaged:Number = 0;
    private var twin:Boolean = false;
    private var renderTwin:Boolean = false;
    private var twinOffset:Number = 0;
    private var obj:Object;
    private var effectsInitialized:Boolean = false;
    private var visualTarget:Unit;
    private var visualTargetGraceEnd:Number = 0;
    private var visualStopEnd:Number = 0;
    private var visualSecondaryTargets:Vector.<Unit> = new Vector.<Unit>();
    private var visualSecondaryGraceEnd:Number = 0;

    public function Beam(param1:Game) {
        super(param1);
        lineBatch.blendMode = "add";
    }

    override public function init(param1:Object, param2:int, param3:int = -1, param4:String = ""):void {
        var local5:int = 0;
        var local7:Object = null;
        var local6:int = 0;
        super.init(param1, param2, param3, param4);
        // Alpha-composited blade cores retain their hue when the twin beams or
        // multiple strands overlap; other weapons retain their original blend.
        lineBatch.blendMode = key == ClientDevVisual.PHASE_BLADE ? "normal" : "add";
        // Filtering composites the opaque strands before applying batch alpha,
        // avoiding a brighter seam where the twin blades meet.
        if (key == ClientDevVisual.PHASE_BLADE && lineBatch.filter == null) {
            lineBatch.filter = new PhaseBladeBloomFilter();
        }
        this.obj = param1;
        drawBeam = false;
        if (param1.hasOwnProperty("nrTargets")) {
            nrTargets = param1.nrTargets;
        } else {
            nrTargets = 1;
        }
        if (param1.hasOwnProperty("chargeUp")) {
            chargeUpMax = param1.chargeUp;
        } else {
            chargeUpMax = 0;
        }
        if (param1.hasOwnProperty("twin")) {
            twin = param1.twin;
            twinOffset = param1.twinOffset;
        }
        beamNodes = param1.beamNodes;
        if (param2 > 0) {
            local6 = 100;
            local5 = 0;
            while (local5 < param2) {
                local7 = param1.techLevels[local5];
                local6 += local7.incInterval;
                if (local7.hasOwnProperty("incNrTargets")) {
                    nrTargets += local7.incNrTargets;
                }
                if (local7.hasOwnProperty("incChargeUp")) {
                    chargeUpMax += local7.incChargeUp;
                }
                if (local5 == param2 - 1) {
                    beamColor = local7.beamColor;
                    beams = local7.beams;
                    beamAmplitude = local7.beamAmplitude;
                    beamThickness = local7.beamThickness;
                    beamAlpha = local7.beamAlpha;
                    startBeamAlpha = beamAlpha;
                    glowColor = local7.glowColor;
                }
                local5++;
            }
        } else {
            beamColor = param1.beamColor;
            beams = param1.beams;
            beamAmplitude = param1.beamAmplitude;
            beamThickness = param1.beamThickness;
            beamAlpha = param1.beamAlpha;
            startBeamAlpha = beamAlpha;
            glowColor = param1.glowColor;
        }
        ready = true;
    }

    private function initEffects():void {
        var local4:int = 0;
        var local3:BeamLine = null;
        startEffect = createBeamEffect(obj.fireEffect);
        endEffect = createBeamEffect(obj.hitEffect);
        var local2:int = 0;
        var local1:int = beams;
        local4 = 0;
        while (local4 < nrTargets) {
            local2 += local1 <= 0 ? 1 : local1;
            local1--;
            local4++;
        }
        if (twin) {
            startEffect2 = createBeamEffect(obj.fireEffect);
            local2 = 2 * local2;
        }
        local4 = 0;
        while (local4 < local2) {
            local3 = g.beamLinePool.getLine();
            local3.init(beamThickness, beamNodes, beamAmplitude, beamColor, beamAlpha, 4, glowColor);
            local3.phaseBlade = key == ClientDevVisual.PHASE_BLADE;
            lines.push(local3);
            local4++;
        }
        if (_fire) {
            playEmitters(startEffect);
            if (twin) {
                playEmitters(startEffect2);
            }
        }
        effectsInitialized = true;
    }

    private function createBeamEffect(param1:String):Vector.<Emitter> {
        if (param1 == null || param1 == "") {
            return new Vector.<Emitter>();
        }
        // Beam endpoints are long-lived external references. Pin the complete
        // effect until destroy releases it, then let the manager recycle it.
        var local1:Vector.<Emitter> = EmitterFactory.create(param1, g, 0, 0, null, false, true, true, null, true);
        return local1 == null ? new Vector.<Emitter>() : local1;
    }

    private function playEmitters(param1:Vector.<Emitter>):void {
        for each(var local1:Emitter in param1) {
            local1.play();
        }
    }

    private function releaseEmitters(param1:Vector.<Emitter>):void {
        if (param1 == null) {
            return;
        }
        for each(var local1:Emitter in param1) {
            local1.killEmitter();
        }
        param1.length = 0;
    }

    private function releaseLines():void {
        if (lineBatch != null) {
            lineBatch.clear();
            if (lineBatch.parent != null) {
                lineBatch.parent.removeChild(lineBatch);
            }
        }
        for each(var local1:BeamLine in lines) {
            local1.visible = false;
            local1.clear();
            g.beamLinePool.removeLine(local1);
        }
        lines.length = 0;
    }

    override public function destroy():void {
        if (resourcesDisposed) {
            return;
        }
        resourcesDisposed = true;
        // Mark the weapon dead before releasing retained effects so callbacks
        // cannot re-enter this terminal cleanup as a live weapon.
        super.destroy();
        releaseEmitters(startEffect);
        releaseEmitters(startEffect2);
        releaseEmitters(endEffect);
        _fire = false;
        drawBeam = false;
        oldDrawBeam = false;
        visualTarget = null;
        visualTargetGraceEnd = 0;
        visualStopEnd = 0;
        visualSecondaryTargets.length = 0;
        visualSecondaryGraceEnd = 0;
        effectsInitialized = false;
        releaseLines();
        if (lineBatch != null) {
            lineBatch.dispose();
            lineBatch = null;
        }
    }

    override protected function shoot():void {
        var local8:ISound = null;
        var local2:PlayerShip = null;
        if (!effectsInitialized) {
            initEffects();
        }
        if (targetBody != null) {
            return;
        }
        if (g.time - lastDamaged > chargeUpExpire) {
            chargeUPCurrent = 0;
        }
        if (drawBeam && !oldDrawBeam) {
            if (fireSound != null && g.camera.isCircleOnScreen(unit.x, unit.y, unit.radius)) {
                local8 = SoundLocator.getService();
                local8.play(fireSound);
            }
        }
        oldDrawBeam = drawBeam;
        var local4:Number = unit.weaponPos.y + positionOffsetY;
        var local3:Number = unit.weaponPos.x + positionOffsetX;
        var local9:Number = Number(Math.sqrt(local3 * local3 + local4 * local4));
        var local7:Number = Number(Math.atan2(local4, local3));
        if (unit.forcedRotation) {
            if (twin) {
                startPos.x = unit.x + Math.cos(local7 + unit.forcedRotationAngle) * local9 + Math.cos(local7 + unit.forcedRotationAngle + 0.5 * 3.141592653589793) * twinOffset;
                startPos.y = unit.y + Math.sin(local7 + unit.forcedRotationAngle) * local9 + Math.sin(local7 + unit.forcedRotationAngle + 0.5 * 3.141592653589793) * twinOffset;
                startPos2.x = unit.x + Math.cos(local7 + unit.forcedRotationAngle) * local9 + Math.cos(local7 + unit.forcedRotationAngle - 0.5 * 3.141592653589793) * twinOffset;
                startPos2.y = unit.y + Math.sin(local7 + unit.forcedRotationAngle) * local9 + Math.sin(local7 + unit.forcedRotationAngle - 0.5 * 3.141592653589793) * twinOffset;
            } else {
                startPos.x = unit.x + Math.cos(local7 + unit.forcedRotationAngle) * local9;
                startPos.y = unit.y + Math.sin(local7 + unit.forcedRotationAngle) * local9;
            }
        } else if (twin) {
            startPos.x = unit.x + Math.cos(unit.rotation + local7) * local9 + Math.cos(unit.rotation + local7 + 0.5 * 3.141592653589793) * twinOffset;
            startPos.y = unit.y + Math.sin(unit.rotation + local7) * local9 + Math.sin(unit.rotation + local7 + 0.5 * 3.141592653589793) * twinOffset;
            startPos2.x = unit.x + Math.cos(unit.rotation + local7) * local9 + Math.cos(unit.rotation + local7 - 0.5 * 3.141592653589793) * twinOffset;
            startPos2.y = unit.y + Math.sin(unit.rotation + local7) * local9 + Math.sin(unit.rotation + local7 - 0.5 * 3.141592653589793) * twinOffset;
        } else {
            startPos.x = unit.x + Math.cos(unit.rotation + local7) * local9;
            startPos.y = unit.y + Math.sin(unit.rotation + local7) * local9;
        }
        updateTargetOrder();
        var local10:Number = unit.rotation;
        for each(var local5:* in startEffect) {
            local5.posX = startPos.x;
            local5.posY = startPos.y;
            local5.angle = local10;
        }
        if (twin) {
            for each(local5 in startEffect2) {
                local5.posX = startPos2.x;
                local5.posY = startPos2.y;
                local5.angle = local10;
            }
        }
        if (target == null || !target.alive) {
            chargeUpCounter = 0;
            target = null;
            beamAlpha = startBeamAlpha / 3;
            endPos.x = unit.x + Math.cos(unit.rotation + local7) * range;
            endPos.y = unit.y + Math.sin(unit.rotation + local7) * range;
            for each(var local11:* in endEffect) {
                local11.posX = endPos.x;
                local11.posY = endPos.y;
                local11.angle = local10 - 3.141592653589793;
            }
            drawBeam = true;
            updateEmitters();
            return;
        }
        beamAlpha = startBeamAlpha;
        lastDamaged = g.time;
        if (fireNextTime < g.time) {
            if (unit is PlayerShip) {
                local2 = unit as PlayerShip;
                if (!local2.weaponHeat.canFire(heatCost)) {
                    fireNextTime += reloadTime;
                    return;
                }
            }
            if (lastFire == 0 || fireNextTime == 0) {
                fireNextTime = g.time + reloadTime - 33;
            } else {
                fireNextTime += reloadTime;
            }
            lastFire = g.time;
            chargeUpCounter = chargeUpCounter + 1;
            if (chargeUpCounter > chargeUpNext && chargeUPCurrent < chargeUpMax) {
                chargeUpCounter = 0;
                chargeUPCurrent = chargeUPCurrent + 1;
            }
            registerSimulatedHit(target);
            if (secondaryTargets.length > 0) markDamageEstimatePartial();
        }
        endPos.x = target.pos.x;
        endPos.y = target.pos.y;
        var local1:Number = endPos.x - startPos.x;
        var local6:Number = endPos.y - startPos.y;
        local10 = Number(Math.atan2(local6, local1));
        for each(local11 in endEffect) {
            local11.posX = endPos.x;
            local11.posY = endPos.y;
            local11.angle = local10 - 3.141592653589793;
        }
        drawBeam = true;
        updateEmitters();
    }

    private function updateTargetOrder():void {
        var local1:Unit = null;
        if (target == null || !target.alive) {
            while (secondaryTargets.length > 0) {
                local1 = secondaryTargets[0];
                secondaryTargets.splice(0, 1);
                if (local1.alive) {
                    target = local1;
                    return;
                }
            }
        }
    }

    private function updateEmitters():void {
        if (lineBatch == null) {
            return;
        }
        if (drawBeam == oldDrawBeam) {
            return;
        }
        if (drawBeam) {
            for each(var local2:* in lines) {
                lineBatch.addMesh(local2);
            }
            g.canvasEffects.addChild(lineBatch);
            for each(var local1:* in endEffect) {
                local1.play();
            }
        } else {
            lineBatch.clear();
            g.canvasEffects.removeChild(lineBatch);
            for each(var local3:* in endEffect) {
                local3.stop();
            }
        }
    }

    private function stopVisuals():void {
        drawBeam = false;
        visualStopEnd = 0;
        visualTargetGraceEnd = 0;
        visualTarget = null;
        visualSecondaryGraceEnd = 0;
        visualSecondaryTargets.length = 0;
        lineBatch.clear();
        if (lineBatch.parent != null) {
            lineBatch.parent.removeChild(lineBatch);
        }
        for each(var local1:BeamLine in lines) {
            local1.clear();
        }
        for each(var local2:Emitter in startEffect) {
            local2.stop();
        }
        if (twin) {
            for each(local2 in startEffect2) {
                local2.stop();
            }
        }
        for each(var local3:Emitter in endEffect) {
            local3.stop();
        }
    }

    private function resolveVisualTarget():Unit {
        if (target != null && target.alive) {
            visualTarget = target;
            visualTargetGraceEnd = 0;
            return target;
        }
        if (name != SKELETOR_LIGHTNING || visualTarget == null || !visualTarget.alive) {
            visualTarget = null;
            visualTargetGraceEnd = 0;
            return null;
        }
        if (_fire && canRetainVisualTarget(visualTarget)) {
            visualTargetGraceEnd = 0;
            return visualTarget;
        }
        if (visualTargetGraceEnd == 0) {
            visualTargetGraceEnd = g.time + VISUAL_CONNECTION_GRACE;
        }
        if (g.time <= visualTargetGraceEnd || visualStopEnd > 0) {
            return visualTarget;
        }
        visualTarget = null;
        visualTargetGraceEnd = 0;
        return null;
    }

    private function canRetainVisualTarget(param1:Unit):Boolean {
        if (param1 == null || !param1.alive || unit == null) {
            return false;
        }
        var local1:Number = param1.renderX - unit.renderX;
        var local2:Number = param1.renderY - unit.renderY;
        var local3:Number = Number(Math.sqrt(local1 * local1 + local2 * local2));
        var local4:Number = range + param1.collisionRadius + 8;
        if (local3 > local4) {
            return false;
        }
        var local5:Number = 0;
        if (local3 > 0 && param1.collisionRadius > 0) {
            local5 = Math.asin(Math.min(1, param1.collisionRadius / local3));
        }
        var local6:Number = Number(Math.atan2(local2, local1));
        return Math.abs(Util.angleDifference(unit.renderRotation, local6)) <= angleVariance + VISUAL_AIM_HYSTERESIS + local5;
    }

    private function resolveVisualSecondaryTargets():Vector.<Unit> {
        var local1:Unit = null;
        if (name != SKELETOR_LIGHTNING) {
            return secondaryTargets;
        }
        if (secondaryTargets != null && secondaryTargets.length > 0) {
            visualSecondaryTargets.length = 0;
            for each(local1 in secondaryTargets) {
                if (local1 != null && local1.alive) {
                    visualSecondaryTargets.push(local1);
                }
            }
            visualSecondaryGraceEnd = 0;
            return visualSecondaryTargets;
        }
        var local2:int = visualSecondaryTargets.length - 1;
        while (local2 >= 0) {
            local1 = visualSecondaryTargets[local2];
            if (local1 == null || !local1.alive) {
                visualSecondaryTargets.splice(local2, 1);
            }
            local2--;
        }
        if (visualSecondaryTargets.length == 0) {
            visualSecondaryGraceEnd = 0;
            return visualSecondaryTargets;
        }
        if (visualSecondaryGraceEnd == 0) {
            visualSecondaryGraceEnd = g.time + VISUAL_CONNECTION_GRACE;
        }
        if (g.time <= visualSecondaryGraceEnd || visualStopEnd > 0) {
            return visualSecondaryTargets;
        }
        visualSecondaryTargets.length = 0;
        visualSecondaryGraceEnd = 0;
        return visualSecondaryTargets;
    }

    private function updateRenderGeometry():Unit {
        renderTwin = twin;
        var local1:Number = unit.weaponPos.y + positionOffsetY;
        var local2:Number = unit.weaponPos.x + positionOffsetX;
        var local3:Number = Number(Math.sqrt(local2 * local2 + local1 * local1));
        var local4:Number = Number(Math.atan2(local1, local2));
        var local5:Number = unit.renderRotation;
        var local6:Number = unit.renderX + Math.cos(local5 + local4) * local3;
        var local7:Number = unit.renderY + Math.sin(local5 + local4) * local3;
        if (twin) {
            renderStartPos.x = local6 + Math.cos(local5 + local4 + 0.5 * Math.PI) * twinOffset;
            renderStartPos.y = local7 + Math.sin(local5 + local4 + 0.5 * Math.PI) * twinOffset;
            renderStartPos2.x = local6 + Math.cos(local5 + local4 - 0.5 * Math.PI) * twinOffset;
            renderStartPos2.y = local7 + Math.sin(local5 + local4 - 0.5 * Math.PI) * twinOffset;
        } else {
            renderStartPos.x = local6;
            renderStartPos.y = local7;
        }
        if (key == ClientDevVisual.PHASE_BLADE && unit is PlayerShip) {
            var mounts:int = PlayerShip(unit).writePhaseBladeMounts(renderStartPos, renderStartPos2);
            if (mounts > 0) renderTwin = mounts > 1;
        }
        for each(var local8:Emitter in startEffect) {
            local8.posX = renderStartPos.x;
            local8.posY = renderStartPos.y;
            local8.angle = local5;
        }
        if (twin) {
            for each(local8 in startEffect2) {
                if (!renderTwin) {
                    local8.stop();
                    continue;
                }
                if (_fire && !local8.isEmitting) local8.play();
                local8.posX = renderStartPos2.x;
                local8.posY = renderStartPos2.y;
                local8.angle = local5;
            }
        }
        var local9:Unit = null;
        if (targetBody != null) {
            var local10:Number = targetBody.renderX - renderStartPos.x;
            var local11:Number = targetBody.renderY - renderStartPos.y;
            var local12:Number = Number(Math.sqrt(local10 * local10 + local11 * local11));
            if (local12 > 0) {
                var local13:Number = local12 > 0.6 * targetBody.radius ? (local12 - 0.6 * targetBody.radius) / local12 : 0.6;
                renderEndPos.x = renderStartPos.x + local10 * local13;
                renderEndPos.y = renderStartPos.y + local11 * local13;
            } else {
                renderEndPos.x = targetBody.renderX;
                renderEndPos.y = targetBody.renderY;
            }
        } else {
            local9 = resolveVisualTarget();
            if (local9 != null) {
                renderEndPos.x = local9.renderX;
                renderEndPos.y = local9.renderY;
            } else {
                renderEndPos.x = unit.renderX + Math.cos(local5 + local4) * range;
                renderEndPos.y = unit.renderY + Math.sin(local5 + local4) * range;
            }
        }
        var local14:Number = Number(Math.atan2(renderEndPos.y - renderStartPos.y, renderEndPos.x - renderStartPos.x));
        for each(var local15:Emitter in endEffect) {
            local15.posX = renderEndPos.x;
            local15.posY = renderEndPos.y;
            local15.angle = local14 - Math.PI;
        }
        return local9;
    }

    public function fireAtBody(param1:Body):void {
        var local9:Number = NaN;
        targetBody = param1;
        if (param1 == null) {
            drawBeam = false;
            fire = false;
            updateEmitters();
            return;
        }
        oldDrawBeam = drawBeam;
        local9 = unit.rotation;
        var local4:Number = Number(unit.weaponPos.y);
        var local3:Number = Number(unit.weaponPos.x);
        var local8:Number = Number(Math.sqrt(local3 * local3 + local4 * local4));
        var local7:Number = Number(Math.atan2(local4, local3));
        startPos.x = unit.x + Math.cos(unit.rotation + local7 + unit.forcedRotationAngle) * local8;
        startPos.y = unit.y + Math.sin(unit.rotation + local7 + unit.forcedRotationAngle) * local8;
        for each(var local5:* in startEffect) {
            local5.posX = startPos.x;
            local5.posY = startPos.y;
            local5.angle = local9;
        }
        endPos.x = param1.pos.x;
        endPos.y = param1.pos.y;
        drawBeam = true;
        var local2:Number = endPos.x - startPos.x;
        var local6:Number = endPos.y - startPos.y;
        local8 = Number(Math.sqrt(local2 * local2 + local6 * local6));
        if (local8 > 0.6 * param1.radius) {
            local8 = (local8 - 0.6 * param1.radius) / local8;
        } else {
            local8 = local8 * 0.6 / local8;
        }
        endPos.x = startPos.x + local2 * local8;
        endPos.y = startPos.y + local6 * local8;
        local9 = Number(Math.atan2(local6, local2));
        for each(var local10:* in endEffect) {
            local10.posX = endPos.x;
            local10.posY = endPos.y;
            local10.angle = local9 - 3.141592653589793;
        }
        updateEmitters();
    }

    private function drawBeamEffect(param1:int, param2:Point, param3:Point, param4:int):int {
        var local9:int = 0;
        var local7:BeamLine = null;
        var local5:Number = param3.x - param2.x;
        var local6:Number = param3.y - param2.y;
        var local8:int = local5 * local5 + local6 * local6;
        if (local8 < 1 || local8 > 1440000 || lines.length < 1 || lines.length - 1 < param1) {
            return param1 + 1;
        }
        var local10:Number = 0;
        local9 = 0;
        while (local9 < param4) {
            if (chargeUpMax > 0) {
                local10 = chargeUPCurrent / chargeUpMax * 1 * beamThickness;
            } else {
                local10 = 0;
            }
            local7 = lines[param1];
            local7.x = param2.x;
            local7.y = param2.y;
            local7.lineTo(param3.x, param3.y, local10);
            local7.visible = true;
            param1 += 1;
            local9++;
        }
        return param1;
    }

    override public function draw():void {
        var local3:BeamLine = null;
        var local6:int = 0;
        var local5:Heat = null;
        var local7:int = 0;
        var local2:Unit = null;
        if (!alive || lineBatch == null) {
            return;
        }
        if (visualStopEnd > 0 && !_fire && g.time >= visualStopEnd) {
            stopVisuals();
        }
        if (!drawBeam) {
            return;
        }
        var local8:Unit = updateRenderGeometry();
        var local9:Number = local8 != null || targetBody != null ? startBeamAlpha : beamAlpha;
        var local1:Number = 0;
        if (g.me.ship != null) {
            local5 = g.me.ship.weaponHeat;
            local1 = local5.heat / local5.max * 1.5;
            if (local1 > 1) {
                local1 = 1;
            }
        }
        if (local1 < 0.3) {
            local1 = 0.3;
        }
        var grayscaleWeapon:Boolean = false;
        var hullPalette:Object = null;
        if (unit is PlayerShip) {
            var playerShip:PlayerShip = PlayerShip(unit);
            var weaponColor:int = playerShip.getExperimentalWeaponColor(this);
            var hullColor:int = playerShip.getClientDevWeaponColor(this, renderStartPos.x, renderStartPos.y);
            var secondHullColor:int = renderTwin ? playerShip.getClientDevWeaponColor(this, renderStartPos2.x, renderStartPos2.y) : hullColor;
            if (hullColor >= 0) {
                hullPalette = playerShip.getClientDevWeaponPalette(this);
                ClientDevVisual.worldToHull(playerShip.movieClip, hullColorTransform);
            }
            var weaponHue:Number = 0;
            var renderedBeamColor:uint = beamColor;
            if (hullColor >= 0) {
                renderedBeamColor = uint(hullColor);
                grayscaleWeapon = true;
            } else if (weaponColor >= 0) {
                weaponHue = playerShip.getExperimentalWeaponHue(this);
                renderedBeamColor = uint(weaponColor);
                grayscaleWeapon = playerShip.getExperimentalWeaponGrayscale(this);
            } else if (playerShip.player != null && Game.isClientDeveloper(playerShip.player.id)) {
                weaponHue = g.clientDevHueColor;
                renderedBeamColor = Color.HEXHue(beamColor, weaponHue);
                grayscaleWeapon = true;
            }
            var colorIndex:int = 0;
            for each(var devLine:BeamLine in lines) {
                devLine.color = hullColor >= 0 && renderTwin && colorIndex >= beams && colorIndex < beams * 2 ?
                    uint(secondHullColor) : renderedBeamColor;
                colorIndex++;
            }
            for each(var startEmitter:Emitter in startEffect) {
                startEmitter.useGrayscaleTint = grayscaleWeapon;
                if (hullColor >= 0) startEmitter.changeTintColor(uint(hullColor));
                else startEmitter.changeHue(weaponHue);
            }
            for each(var secondStartEmitter:Emitter in startEffect2) {
                secondStartEmitter.useGrayscaleTint = grayscaleWeapon;
                if (hullColor >= 0) secondStartEmitter.changeTintColor(uint(secondHullColor));
                else secondStartEmitter.changeHue(weaponHue);
            }
            for each(var endEmitter:Emitter in endEffect) {
                endEmitter.useGrayscaleTint = grayscaleWeapon;
                if (hullColor >= 0) endEmitter.changeTintColor(uint(playerShip.getClientDevWeaponColor(this, renderEndPos.x, renderEndPos.y)));
                else endEmitter.changeHue(weaponHue);
            }
        }
        for each(var grayscaleLine:BeamLine in lines) {
            grayscaleLine.useGrayscaleTint = grayscaleWeapon;
            grayscaleLine.setHullPalette(hullPalette, hullPalette == null ? null : hullColorTransform);
        }
        local6 = 0;
        while (local6 < lines.length) {
            local3 = lines[local6];
            local3.alpha = local1 * local9;
            local3.visible = false;
            local6++;
        }
        if (renderTwin) {
            local6 = drawBeamEffect(0, renderStartPos, renderEndPos, beams);
            local6 = drawBeamEffect(local6, renderStartPos2, renderEndPos, beams);
        } else {
            local6 = drawBeamEffect(0, renderStartPos, renderEndPos, beams);
        }
        renderLastPos.x = renderEndPos.x;
        renderLastPos.y = renderEndPos.y;
        var local4:int = beams;
        var local10:Vector.<Unit> = resolveVisualSecondaryTargets();
        local7 = 0;
        while (local7 < local10.length) {
            local2 = local10[local7];
            if (local2.alive) {
                if (local4 > 1) {
                    local4--;
                }
                renderChainPos.x = local2.renderX;
                renderChainPos.y = local2.renderY;
                local6 = drawBeamEffect(local6, renderLastPos, renderChainPos, local4);
                renderLastPos.x = renderChainPos.x;
                renderLastPos.y = renderChainPos.y;
            }
            local7++;
        }
        lineBatch.clear();
        local6 = 0;
        while (local6 < lines.length) {
            local3 = lines[local6];
            if (local3.visible) {
                lineBatch.addMesh(lines[local6]);
            }
            local6++;
        }
        lineBatch.alpha = local1 * local9;
    }

    override public function set fire(param1:Boolean):void {
        if (targetBody != null || param1 == _fire) {
            return;
        }
        var local1:Boolean = visualStopEnd > 0 && drawBeam;
        _fire = param1;
        lastFire = 0;
        if (_fire == true) {
            visualStopEnd = 0;
            if (!local1) {
                for each(var local3:* in startEffect) {
                    local3.play();
                }
                if (twin) {
                    for each(local3 in startEffect2) {
                        local3.play();
                    }
                }
            }
        } else {
            if (name == SKELETOR_LIGHTNING && drawBeam && (target != null && target.alive || visualTarget != null && visualTarget.alive)) {
                if (visualTarget == null && target != null && target.alive) {
                    visualTarget = target;
                }
                visualStopEnd = g.time + VISUAL_CONNECTION_GRACE;
                return;
            }
            stopVisuals();
        }
    }
}
}

