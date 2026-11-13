package core.boss {
/**
 * Read-only per-system timing candidates. Minute conversions are estimates:
 * the client does not receive the server's respawn scheduling algorithm.
 */
public final class BossSpawnTimerCatalog {
    public static const ZHERSIS_KEY:String = "1gr5DQtiFU2VF1DR2lmd0A";
    private static const MAX_ENEMY_OPTIONS:int = 512;
    private static const MINUTE_MS:Number = 60000;
    private static const MAX_PERIOD_MS:Number = 86400000;

    public static function build(bodies:*, bosses:Object, enemies:Object):Array {
        var rows:Array = [];
        var byId:Object = {};
        if (bodies == null) return rows;
        for each (var body:Object in bodies) {
            if (body == null || body.obj == null || body.obj.active === false) continue;
            var definition:Object = body.obj;
            var bossKey:String = definition.boss == null ? "" : String(definition.boss);
            var boss:Object = bosses == null ? null : bosses[bossKey];
            if (bossKey.length > 0 && boss != null && boss.name) {
                // The anchor's zero is meaningful. Do not substitute the
                // differently named/differently valued Bosses timing fields.
                addSource(rows, byId, "boss", bossKey, String(boss.name), true,
                        hasEvent(definition), body, period(definition.spawnTime));
            }
            if (enemies == null || body.spawners == null) continue;
            for each (var spawner:Object in body.spawners) {
                if (spawner == null || spawner.obj == null ||
                        spawner.isBossUnit === true || spawner.obj.active === false) continue;
                // Metadata bossSpawner/bossSpawner2 also marks ordinary
                // stations' special enemy slots, including Ahrgeris. Only
                // actual Boss-owned runtime units are excluded above.
                addSlot(rows, byId, body, spawner, enemies, false);
                if (spawner.obj.hasSecondSpawn === true) {
                    addSlot(rows, byId, body, spawner, enemies, true);
                }
            }
        }
        rows.sort(compareRows);
        return rows;
    }

    private static function addSlot(rows:Array, byId:Object, body:Object,
                                    spawner:Object, enemies:Object,
                                    secondary:Boolean):void {
        var data:Object = spawner.obj;
        var suffix:String = secondary ? "2" : "";
        var values:* = data["enemies" + suffix];
        var options:Array = optionKeys(values, data["enemy" + suffix]);
        var capacity:* = data["maxActiveEnemies" + suffix];
        if (capacity != null && isFinite(Number(capacity)) && Number(capacity) <= 0) return;
        var gated:Boolean = data["spawnOnDeath" + suffix] === true ||
                data.triggeredByMission === true || data.triggeredByTimer === true;
        var estimatedPeriod:Number = period(data["resetTime" + suffix]);
        // Weighted alternatives and batches do not describe an individual
        // enemy's guaranteed next appearance. Keep their alive rows, but
        // leave the prediction unknown instead of promising a spawn.
        if (gated || options.length != 1 ||
                values is Array && values.length > MAX_ENEMY_OPTIONS ||
                capacity != null && Number(capacity) > 1) estimatedPeriod = 0;
        var conditional:Boolean = hasEvent(body.obj) || hasEvent(data) ||
                data.triggeredByMission === true || data.triggeredByTimer === true;
        for each (var key:String in options) {
            var enemy:Object = enemies[key];
            if (enemy == null || enemy.miniBoss !== true || !enemy.name) continue;
            addSource(rows, byId, "enemy", key, String(enemy.name), key == ZHERSIS_KEY,
                    conditional, spawner, estimatedPeriod);
        }
    }

    private static function optionKeys(values:*, legacy:*):Array {
        var result:Array = [];
        if (values is Array && values.length > 0) {
            for (var index:int = 0; index < Math.min(values.length, MAX_ENEMY_OPTIONS); index++) {
                var option:* = values[index];
                var key:String = "";
                if (typeof option == "string") {
                    key = String(option);
                } else if (option != null && typeof option == "object" &&
                        option.hasOwnProperty("key") && option.key != null) {
                    if (option.hasOwnProperty("probability") &&
                            (!isFinite(Number(option.probability)) || Number(option.probability) <= 0)) continue;
                    key = String(option.key);
                }
                if (key.length > 0 && result.indexOf(key) < 0) result.push(key);
            }
        } else if (legacy != null && String(legacy).length > 0) {
            result.push(String(legacy));
        }
        return result;
    }

    private static function addSource(rows:Array, byId:Object, kind:String,
                                      key:String, name:String, primary:Boolean,
                                      conditional:Boolean, anchor:Object,
                                      periodMs:Number):void {
        // Even when another ordinary anchor makes this row visible, event
        // eligibility is unknown. A seasonal source must never win the row's
        // earliest estimated deadline over an ordinary source.
        if (conditional) periodMs = 0;
        var id:String = kind + ":" + key;
        var row:Object = byId[id];
        if (row == null) {
            row = {id:id, key:key, kind:kind,
                name:name.replace(/\s+lvl\s+.*$/i, ""), primary:primary,
                conditional:conditional, sources:[]};
            byId[id] = row;
            rows.push(row);
        } else {
            // An ordinary anchor makes the row useful even if the same
            // definition also has seasonal/mission-only anchors elsewhere.
            row.conditional = row.conditional && conditional;
        }
        for each (var source:Object in row.sources) {
            if (source.anchor === anchor && source.periodMs == periodMs) return;
        }
        row.sources.push({anchor:anchor, periodMs:periodMs});
    }

    private static function period(value:*):Number {
        var minutes:Number = Number(value);
        var milliseconds:Number = minutes * MINUTE_MS;
        // Unverified outliers beyond one day are not useful predictions and
        // must not overflow the duration formatter's integer seconds.
        return isFinite(milliseconds) && milliseconds > 0 &&
                milliseconds <= MAX_PERIOD_MS ? milliseconds : 0;
    }

    private static function hasEvent(value:Object):Boolean {
        return value != null && value.event != null && String(value.event).length > 0;
    }

    private static function compareRows(left:Object, right:Object):Number {
        if (left.primary != right.primary) return left.primary ? -1 : 1;
        var a:String = String(left.name).toLowerCase();
        var b:String = String(right.name).toLowerCase();
        if (a != b) return a < b ? -1 : 1;
        if (left.id == right.id) return 0;
        return left.id < right.id ? -1 : 1;
    }
}
}
