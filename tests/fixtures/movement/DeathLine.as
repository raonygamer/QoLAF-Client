package core.deathLine {
import core.hud.components.Line;
import core.scene.Game;

import flash.geom.Point;

public class DeathLine extends Line {
    private var g:Game;
    public var nextDistanceCalculation:Number = -1;
    private var distanceToCamera:Number = 0;
    public var id:String = "";

    public function DeathLine(param1:Game, param2:uint = 16777215, param3:Number = 1) {
        super("line2");
        init("line2", 6, param2, param3, true);
        this.g = param1;
        this.visible = false;
    }

    public function update():void {
        if (nextDistanceCalculation <= 0) {
            updateIsNear();
        } else {
            nextDistanceCalculation -= 33;
        }
    }

    public function updateIsNear():void {
        if (g.me.ship == null) {
            return;
        }
        var local2:Point = g.camera.getCameraCenter();
        var local1:Number = x - local2.x;
        var local4:Number = y - local2.y;
        var local6:Number = toX - local2.x;
        var local5:Number = toY - local2.y;
        var local7:Number = g.stage.stageWidth;
        distanceToCamera = Math.sqrt(Math.min(local1 * local1 + local4 * local4, local6 * local6 + local5 * local5));
        var local3:Number = distanceToCamera - local7;
        nextDistanceCalculation = local3 / 600 * 1000;
        visible = distanceToCamera < local7;
    }

    public function lineIntersection(param1:Number, param2:Number, param3:Number, param4:Number, param5:Number):Boolean {
        var local17:Number = toY - y;
        var local15:Number = x - toX;
        var local19:Number = param4 - param2;
        var local18:Number = param1 - param3;
        var local13:Number = local17 * local18 - local19 * local15;
        if (local13 == 0) {
            return false;
        }
        var local14:Number = local17 * x + local15 * y;
        var local16:Number = local19 * param1 + local18 * param2;
        var local22:Number = (local18 * local14 - local15 * local16) / local13;
        var local7:Number = (local17 * local16 - local19 * local14) / local13;
        var local21:Number = Number(Math.min(x, toX));
        var local11:Number = Number(Math.max(x, toX));
        var local20:Number = Number(Math.min(y, toY));
        var local9:Number = Number(Math.max(y, toY));
        if (local22 < local21 - param5 || local22 > local11 + param5 || local7 < local20 - param5 || local7 > local9 + param5) {
            return false;
        }
        var local12:Number = Number(Math.min(param1, param3));
        var local8:Number = Number(Math.max(param1, param3));
        var local10:Number = Number(Math.min(param2, param4));
        var local6:Number = Number(Math.max(param2, param4));
        if (local22 < local12 - param5 || local22 > local8 + param5 || local7 < local10 - param5 || local7 > local6 + param5) {
            return false;
        }
        return true;
    }

    public function lineIntersection2(param1:Number, param2:Number, param3:Number, param4:Number, param5:Number):Boolean {
        // Sweep the ship's full movement segment against the line's collision radius.
        // An endpoint-only test lets boost and lagged simulation ticks tunnel through.
        var local1:Number = Math.max(0, param5);
        var local2:Number = Math.min(x, toX) - local1;
        var local3:Number = Math.max(x, toX) + local1;
        var local4:Number = Math.min(y, toY) - local1;
        var local5:Number = Math.max(y, toY) + local1;
        if (Math.max(param1, param3) < local2 || Math.min(param1, param3) > local3 ||
                Math.max(param2, param4) < local4 || Math.min(param2, param4) > local5) {
            return false;
        }
        var local6:Number = param1 - param3;
        var local7:Number = param2 - param4;
        var local8:Number = toX - x;
        var local9:Number = toY - y;
        var local10:Number = local6 * local9 - local7 * local8;
        if (local10 != 0) {
            var local11:Number = x - param3;
            var local12:Number = y - param4;
            var local13:Number = (local11 * local9 - local12 * local8) / local10;
            var local14:Number = (local11 * local7 - local12 * local6) / local10;
            if (local13 >= 0 && local13 <= 1 && local14 >= 0 && local14 <= 1) {
                return true;
            }
        }

        // Never let the overlap escape exception authorize a step that crosses
        // the center line. Once overlapping, only strict outward progress on
        // the same side is allowed.
        if (isEscapingCollision(param1, param2, param3, param4, local1)) {
            return false;
        }

        var local15:Number = local1 * local1;
        return distanceSquaredToSegment(param3, param4, x, y, toX, toY) < local15 ||
                distanceSquaredToSegment(param1, param2, x, y, toX, toY) < local15 ||
                distanceSquaredToSegment(x, y, param3, param4, param1, param2) < local15 ||
                distanceSquaredToSegment(toX, toY, param3, param4, param1, param2) < local15;
    }

    public function isEscapingCollision(destinationX:Number,
                                        destinationY:Number,
                                        startX:Number, startY:Number,
                                        clearance:Number):Boolean {
        var safeClearance:Number = Math.max(0, clearance);
        if (safeClearance == 0) {
            return false;
        }
        var lineX:Number = toX - x;
        var lineY:Number = toY - y;
        var lineLengthSquared:Number = lineX * lineX + lineY * lineY;
        var closestX:Number = x;
        var closestY:Number = y;
        if (lineLengthSquared > 0) {
            var projection:Number = ((startX - x) * lineX +
                    (startY - y) * lineY) / lineLengthSquared;
            projection = Math.max(0, Math.min(1, projection));
            closestX += lineX * projection;
            closestY += lineY * projection;
        }
        var awayX:Number = startX - closestX;
        var awayY:Number = startY - closestY;
        var startDistanceSquared:Number = awayX * awayX + awayY * awayY;
        if (startDistanceSquared >= safeClearance * safeClearance) {
            return false;
        }
        var movementX:Number = destinationX - startX;
        var movementY:Number = destinationY - startY;
        if (movementX * movementX + movementY * movementY <= 0.000001) {
            return false;
        }
        var destinationDistanceSquared:Number = distanceSquaredToSegment(
                destinationX, destinationY, x, y, toX, toY);
        if (destinationDistanceSquared <= startDistanceSquared + 0.000001) {
            return false;
        }
        return movementX * awayX + movementY * awayY > 0.000001;
    }

    private function distanceSquaredToSegment(param1:Number, param2:Number, param3:Number, param4:Number,
                                              param5:Number, param6:Number):Number {
        var local1:Number = param5 - param3;
        var local2:Number = param6 - param4;
        var local3:Number = local1 * local1 + local2 * local2;
        if (local3 == 0) {
            local1 = param1 - param3;
            local2 = param2 - param4;
            return local1 * local1 + local2 * local2;
        }
        var local4:Number = ((param1 - param3) * local1 + (param2 - param4) * local2) / local3;
        local4 = Math.max(0, Math.min(1, local4));
        var local5:Number = param1 - (param3 + local4 * local1);
        var local6:Number = param2 - (param4 + local4 * local2);
        return local5 * local5 + local6 * local6;
    }
}
}

