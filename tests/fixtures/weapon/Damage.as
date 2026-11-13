package core.weapon {
import generics.Localize;

public class Damage {
    public static const SINGLETYPES:int = 5;
    public static const TOTALTYPES:int = 10;
    public static const KINETIC:int = 0;
    public static const ENERGY:int = 1;
    public static const CORROSIVE:int = 2;
    public static const KINNETICENERGY:int = 3;
    public static const CORROSIVEKINNETIC:int = 4;
    public static const ALL:int = 5;
    public static const HEAL:int = 6;
    public static const KINNETICENERGYCORROSIVE:int = 7;
    public static const DONT_SCALE:int = 8;
    public static const ENERGYCORROSIVE:int = 9;
    public static const RESISTANCE_CAP:int = 75;
    public static const TYPE:Vector.<String> = Vector.<String>(["Kinetic", "Energy", "Corrosive", "50% Kinetic + 50% Energy", "50% Corrosive + 50% Kinetic", "", "Health", "33% Energy + 33% Kinetic + 33% Corrosive", "None", "50% Energy + 50% Corrosive"]);
    public static const TYPE_HTML:Vector.<String> = Vector.<String>(["<FONT COLOR=\'#00ffff\'>Kinetic</FONT>", "<FONT COLOR=\'#ff030d\'>Energy</FONT>", "<FONT COLOR=\'#009900\'>Corrosive</FONT>", "<FONT COLOR=\'#00ffff\'>Kinetic</FONT> + <FONT COLOR=\'#ff030d\'>Energy</FONT>", "<FONT COLOR=\'#009900\'>Corrosive</FONT> + <FONT COLOR=\'#00ffff\'>Kinetic</FONT>", "<FONT COLOR=\'#ffffff\'>All</FONT>", "<FONT COLOR=\'#00ff00\'>Health</FONT>", "<FONT COLOR=\'#00ffff\'>Kinetic</FONT> + <FONT COLOR=\'#ff030d\'>Energy</FONT> + <FONT COLOR=\'#009900\'>Corrosive</FONT>", "<FONT COLOR=\'#ff0000\'>Don\'t scale</FONT>", "<FONT COLOR=\'#ff030d\'>Energy</FONT> + <FONT COLOR=\'#009900\'>Corrosive</FONT>"]);
    public static const SINGLETYPE_HTML:Vector.<String> = Vector.<String>(["<FONT COLOR=\'#00ffff\'>Kinetic</FONT>", "<FONT COLOR=\'#ff030d\'>Energy</FONT>", "<FONT COLOR=\'#009900\'>Corrosive</FONT>", "<FONT COLOR=\'#00ff00\'>Health</FONT>", "<FONT COLOR=\'#ff0000\'>Special</FONT>"]);
    private static const SINGLETYPE_NAME:Vector.<String> = Vector.<String>(["Kinetic", "Energy", "Corrosive", "Health", "Special"]);
    private static const SINGLETYPE_COLOR:Vector.<String> = Vector.<String>(["#00ffff", "#ff030d", "#009900", "#00ff00", "#ff0000"]);
    public static const stats:Vector.<Vector.<Number>> = Vector.<Vector.<Number>>([Vector.<Number>([1, 0, 0, 0, 0]), Vector.<Number>([0, 1, 0, 0, 0]), Vector.<Number>([0, 0, 1, 0, 0]), Vector.<Number>([0.5, 0.5, 0, 0, 0]), Vector.<Number>([0.5, 0, 0.5, 0, 0]), Vector.<Number>([1, 1, 1, 0, 0]), Vector.<Number>([0, 0, 0, 1, 0]), Vector.<Number>([0.33, 0.33, 0.33, 0, 0]), Vector.<Number>([0, 0, 0, 0, 1]), Vector.<Number>([0, 0.5, 0.5, 0, 0])]);
    public var type:int;
    private var damage:Vector.<Number>;
    private var damageBase:Vector.<Number>;

    public function Damage(param1:Number, param2:int) {
        var local3:int = 0;
        super();
        this.type = param2;
        damage = new Vector.<Number>();
        damageBase = new Vector.<Number>();
        local3 = 0;
        while (local3 < 5) {
            damageBase.push(param1 * stats[param2][local3]);
            damage.push(param1 * stats[param2][local3]);
            local3++;
        }
    }

    public function dmg():Number {
        var local1:int = 0;
        var local2:Number = 0;
        local1 = 0;
        while (local1 < 5) {
            local2 += damage[local1];
            local1++;
        }
        return local2;
    }

    public function damageText():String {
        var local1:int = 0;
        var local2:String = "";
        var local3:String = null;
        local1 = 0;
        while (local1 < 3) {
            if (damage[local1] > 0) {
                if (local2 == "") {
                    local2 += Localize.t("Deals: ");
                } else {
                    local2 += " + ";
                }
                local3 = Localize.t("<FONT COLOR=\'#eeeeee\'>[damage]</FONT> [type] damage");
                local2 += local3.replace("[damage]", damage[local1].toFixed(0)).replace("[type]", getSingleTypeHtml(local1));
            }
            local1++;
        }
        if (damage[local1] > 0) {
            if (local2 != "") {
                local2 += "\n";
            }
            local3 = Localize.t("Repairs: <FONT COLOR=\'#eeeeee\'>[damage]</FONT> [type]");
            local2 += local3.replace("[damage]", damage[local1].toFixed(0)).replace("[type]", getSingleTypeHtml(local1));
        }
        if (local2 != "") {
            local2 += Localize.t(" per hit.\n");
        }
        return local2;
    }

    public static function getSingleTypeHtml(param1:int):String {
        return "<FONT COLOR='" + SINGLETYPE_COLOR[param1] + "'>" + Localize.t(SINGLETYPE_NAME[param1]) + "</FONT>";
    }

    public function debuffdamageText(param1:Number, param2:Number, param3:String):String {
        var local4:int = 0;
        var local5:String = "";
        local4 = 0;
        while (local4 < 3) {
            if (damage[local4] > 0) {
                if (param3 == " after") {
                    local5 += Localize.t("Deals <FONT COLOR=\'#eeeeee\'>[damage]</FONT> [type] after <FONT COLOR=\'#eeeeee\'>[duration]</FONT> seconds \n").replace("[damage]", Math.ceil(param1 * damage[local4]).toFixed(0)).replace("[type]", getSingleTypeHtml(local4)).replace("[duration]", param2.toFixed(1));
                } else {
                    local5 += Localize.t("Deals <FONT COLOR=\'#eeeeee\'>[damage]</FONT> [type] over <FONT COLOR=\'#eeeeee\'>[duration]</FONT> seconds \n").replace("[damage]", Math.ceil(param1 * damage[local4]).toFixed(0)).replace("[type]", getSingleTypeHtml(local4)).replace("[duration]", param2.toFixed(1));
                }
            }
            local4++;
        }
        if (damage[local4] > 0) {
            if (param3 == " after") {
                local5 += Localize.t("Repairs <FONT COLOR=\'#eeeeee\'>[damage]</FONT> [type] after <FONT COLOR=\'#eeeeee\'>[duration]</FONT> seconds \n").replace("[damage]", Math.ceil(param1 * damage[local4]).toFixed(0)).replace("[type]", getSingleTypeHtml(local4)).replace("[duration]", param2.toFixed(1));
            } else {
                local5 += Localize.t("Repairs <FONT COLOR=\'#eeeeee\'>[damage]</FONT> [type] over <FONT COLOR=\'#eeeeee\'>[duration]</FONT> seconds \n").replace("[damage]", Math.ceil(param1 * damage[local4]).toFixed(0)).replace("[type]", getSingleTypeHtml(local4)).replace("[duration]", param2.toFixed(1));
            }
        }
        return local5;
    }

    public function setBaseDmg(param1:Number):void {
        var local2:int = 0;
        if (type == 8) {
            return;
        }
        local2 = 0;
        while (local2 < 5) {
            damageBase[local2] = param1 * stats[type][local2];
            damage[local2] = param1 * stats[type][local2];
            local2++;
        }
    }

    public function addBaseDmg(param1:Number, param2:int = -1):void {
        var local3:int = 0;
        if (param2 == 8) {
            return;
        }
        if (param2 == -1) {
            param2 = this.type;
        }
        local3 = 0;
        while (local3 < 5) {
            var local4:int = local3;
            var local5:Number = damage[local4] + param1 * stats[param2][local3];
            damage[local4] = local5;
            damageBase[local3] += param1 * stats[param2][local3];
            local3++;
        }
    }

    public function addBasePercent(param1:Number, param2:int = -1):void {
        var local3:int = 0;
        if (param2 == 8) {
            return;
        }
        if (param2 == -1) {
            param2 = this.type;
        }
        local3 = 0;
        while (local3 < 5) {
            var local4:int = local3;
            var local5:Number = damage[local4] + damageBase[local3] * param1 * stats[param2][local3] / 100;
            damage[local4] = local5;
            damageBase[local3] += damageBase[local3] * param1 * stats[param2][local3] / 100;
            local3++;
        }
    }

    public function addDmgInt(param1:int, param2:int = -1):void {
        var local3:int = 0;
        if (param2 == -1) {
            param2 = this.type;
        }
        local3 = 0;
        while (local3 < 5) {
            if (damage[local3] > 0) {
                var local4:int = local3;
                var local5:Number = damage[local4] + param1 * stats[param2][local3];
                damage[local4] = local5;
            }
            local3++;
        }
    }

    public function addDmgPercent(param1:Number, param2:int = -1):void {
        var local3:int = 0;
        if (param2 == -1) {
            param2 = this.type;
        }
        local3 = 0;
        while (local3 < 5) {
            if (stats[param2][local3] > 0) {
                var local4:int = local3;
                var local5:Number = damage[local4] + damageBase[local3] * param1 / 100;
                damage[local4] = local5;
            }
            local3++;
        }
    }

    public function addLevelBonus(param1:int, param2:Number):void {
        var local3:int = 0;
        if (type == 8) {
            return;
        }
        local3 = 0;
        while (local3 < 5) {
            damage[local3] = damageBase[local3] * (100 + param2 * (param1 - 1)) / 100;
            damageBase[local3] = damageBase[local3] * (100 + param2 * (param1 - 1)) / 100;
            local3++;
        }
    }
}
}

