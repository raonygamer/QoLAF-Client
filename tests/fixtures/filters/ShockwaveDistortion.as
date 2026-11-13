package core.filters {
import core.scene.Game;

import flash.geom.Point;

/** World-space expanding annulus used only by Nexar and Shadow Bomb blasts. */
public class ShockwaveDistortion {
    private static const MAP_SIZE:int = 128;
    private static const RING_RADIUS:Number = 0.45;
    private static const RING_RANGE:Number = 0.065;
    private static const STRENGTH:Number = 18;
    private static const VISUAL_DELAY:Number = 80;
    private static const DEFAULT_BLAST_SPEED:Number = 350;

    private var g:Game;
    private var worldPosition:Point;
    private var screenPosition:Point = new Point();
    private var blastRadius:Number;
    private var blastSpeed:Number;
    private var startTime:Number;
    private var duration:Number;
    private var _source:RingDistortionSource;

    public function ShockwaveDistortion(param1:Game, param2:Number, param3:Number,
                                        param4:Number, param5:Number) {
        g = param1;
        worldPosition = new Point(param2, param3);
        blastRadius = Math.max(1, param4);
        blastSpeed = isFinite(param5) && param5 > 0 ? param5 : DEFAULT_BLAST_SPEED;
        startTime = g.time + VISUAL_DELAY;
        duration = blastRadius / blastSpeed * 1000;
        _source = new RingDistortionSource(MAP_SIZE, MAP_SIZE, RING_RADIUS, RING_RANGE, STRENGTH);
    }

    public function get source():RingDistortionSource {
        return _source;
    }

    public function get expired():Boolean {
        return g.time >= startTime + duration;
    }

    public function updatePosition():Boolean {
        var local1:Number = (g.time - startTime) / duration;
        if (local1 <= 0 || local1 >= 1) {
            return false;
        }
        var local2:Number = blastRadius * local1;
        var local6:Number = Math.max(0.001, Math.min(Math.abs(g.canvas.scaleX), Math.abs(g.canvas.scaleY)));
        var local7:Number = blastRadius * (RING_RADIUS + RING_RANGE) / RING_RADIUS +
                _source.strength * 0.5 / local6;
        if (!g.camera.isCircleOnScreen(worldPosition.x, worldPosition.y,
                local7)) {
            return false;
        }
        g.canvas.localToGlobal(worldPosition, screenPosition);
        var local4:Number = local2 / _source.ringRadius;
        // The shell expands linearly with the particle blast. Its bend fades
        // in and out while the center and the space behind it stay neutral.
        var local5:Number = Math.sin(Math.PI * local1);
        _source.centerAt(screenPosition.x, screenPosition.y, g.canvas.scaleX, g.canvas.scaleY, local4, local5);
        return _source.effectiveStrength > 0.001;
    }

    public function dispose():void {
        if (_source != null) {
            _source.dispose();
            _source = null;
        }
        worldPosition = null;
        screenPosition = null;
        g = null;
    }
}
}
