package core.states.gameStates.missions {
import com.greensock.TweenMax;
import com.greensock.easing.Circ;

import core.credits.CreditManager;
import core.drops.DropBase;
import core.drops.DropItem;
import core.hud.components.Button;
import core.hud.components.GradientBox;
import core.hud.components.Text;
import core.hud.components.ToolTip;
import core.hud.components.dialogs.CreditBuyBox;
import core.player.Mission;
import core.scene.Game;
import core.states.gameStates.RoamingState;
import core.states.gameStates.ShopState;
import core.text.RussoBitmapFontRegistry;

import data.DataLocator;
import data.IDataManager;

import generics.Localize;

import playerio.Message;

import sound.ISound;
import sound.SoundLocator;

import starling.display.Image;
import starling.display.MovieClip;
import starling.display.Sprite;
import starling.events.Event;
import starling.events.TouchEvent;
import starling.text.TextField;
import starling.text.TextFormat;

import textures.ITextureManager;
import textures.TextureLocator;

public class MissionView extends Sprite {
    private var mission:Mission;
    private var g:Game;
    private var heading:Text;
    private var description:Text;
    private var missionType:Object;
    private var box:GradientBox;
    private var dataManager:IDataManager;
    private var fluxIcon:Image;
    private var dropBase:DropBase;
    private var boxWidth:int;
    private var textureManager:ITextureManager;
    private var tween:TweenMax;
    private var timeLeft:Text = new Text();

    public function MissionView(param1:Game, param2:Mission, param3:int) {
        super();
        this.mission = param2;
        this.g = param1;
        this.boxWidth = param3;
        this.textureManager = TextureLocator.getService();
    }

    public static function fixText(param1:Game, param2:Object, param3:String):String {
        param3 = Localize.t(param3);
        if (param2.value != null) {
            param3 = param3.replace("[amount]", "<font color=\'#ffffff\'>" + param2.value + "</font>");
        }
        param3 = param3.replace("[player]", param1.me.name);
        param3 = param3.replace("[h]", "<font color=\'#ffffff\'>");
        return param3.replace("[/h]", "</font>");
    }

    public function init():void {
        var instance:MissionView;
        var rewardY:Number;
        var cancelButton:Button;
        if (mission.majorType == "time") {
            box = new GradientBox(boxWidth, 160, 0, 1, 15, 16746564);
        } else {
            box = new GradientBox(boxWidth, 160, 0, 1, 15, 8978312);
        }
        instance = this;
        box.load();
        addChild(box);
        dataManager = DataLocator.getService();
        missionType = dataManager.loadKey("MissionTypes", mission.missionTypeKey);
        addHeading();
        rewardY = addReward();
        addDescription();
        addRewardButton(rewardY);
        if (mission.majorType == "time" && !mission.finished) {
            cancelButton = new Button(function ():void {
                g.creditManager.refresh(function ():void {
                    var confirmBuyWithFlux:CreditBuyBox = new CreditBuyBox(g, CreditManager.getCostSkipMission(), Localize.t("Skip this timed mission and receive a new one!"));
                    g.addChildToOverlay(confirmBuyWithFlux);
                    confirmBuyWithFlux.addEventListener("accept", function (param1:Event):void {
                        var e:Event = param1;
                        g.rpc("skipMission", function (param1:Message):void {
                            if (param1.getBoolean(0)) {
                                Game.trackEvent("used flux", "skipped mission", "player level " + g.me.level, CreditManager.getCostSkipMission());
                                removeAndRedrawList();
                                g.creditManager.refresh();
                            } else {
                                g.showErrorDialog(param1.getString(1), false);
                            }
                        }, mission.id);
                        confirmBuyWithFlux.removeEventListeners();
                    });
                    confirmBuyWithFlux.addEventListener("close", function (param1:Event):void {
                        confirmBuyWithFlux.removeEventListeners();
                        cancelButton.enabled = true;
                        g.removeChildFromOverlay(confirmBuyWithFlux, true);
                    });
                });
            }, Localize.t("Skip Mission"), "normal", 12);
            cancelButton.x = width - cancelButton.width - box.padding * 2;
            cancelButton.y = height - cancelButton.height - box.padding * 2;
            addChild(cancelButton);
        }
        instance[missionType.type]();
    }

    public function level():void {
    }

    public function transport():void {
        var local4:Object = null;
        var local1:Text = null;
        var local2:Vector.<Object> = new Vector.<Object>();
        var local3:int = 1;
        var local6:String = description.htmlText;
        for each(var local5:* in missionType.addedBodies) {
            local4 = dataManager.loadKey("Bodies", local5);
            local2.push(local4);
            local6 = local6.replace("[location" + local3 + "]", "<font color=\'#ffffff\'>" + local4.name + "</font>");
            local3++;
        }
        description.htmlText = local6;
        local3 = 1;
        for each(var local7:* in local2) {
            local1 = new Text();
            local1.size = 13;
            local1.x = 0;
            local1.y = description.height + 10 + local3 * 20;
            if (local3 == 1) {
                local1.htmlText = Localize.t("Go to") + ": <font color=\'#ae7108\'>" + local7.name;
            } else {
                local1.htmlText = Localize.t("Then to") + ": <font color=\'#ae7108\'>" + local7.name;
            }
            box.addChild(local1);
            local3++;
        }
    }

    private function kill():void {
        var local1:MissionView = this;
        local1[missionType.subtype]();
    }

    private function pvpStart():void {
    }

    private function player():void {
        var local1:Text = new Text();
        local1.size = 13;
        local1.x = 0;
        local1.y = 145;
        local1.htmlText = Localize.t("Killed") + ": <font color=\'#ae0808\'>" + mission.count + " / " + missionType.value;
        box.addChild(local1);
    }

    private function frenzy():void {
        var local1:Text = new Text();
        local1.size = 13;
        local1.x = 0;
        local1.y = 145;
        local1.htmlText = Localize.t("Longest killing frenzy") + ": <font color=\'#ae0808\'>" + mission.count + " / " + missionType.value;
        box.addChild(local1);
    }

    private function explore():void {
    }

    private function pickup():void {
        var local2:Object = null;
        var local3:Image = null;
        if (missionType.item != null) {
            local2 = dataManager.loadKey("Commodities", missionType.item);
            local3 = new Image(textureManager.getTextureGUIByKey(local2.bitmap));
            local3.y = description.y + description.height + 20;
            box.addChild(local3);
        }
        var local1:Text = new Text();
        local1.size = 13;
        local1.x = 0;
        local1.y = 145;
        local1.htmlText = Localize.t("Picked up") + ": <font color=\'#08ae08\'>" + mission.count + " / " + missionType.value;
        box.addChild(local1);
    }

    private function recycle():void {
        var local2:Object = null;
        var local3:Image = null;
        if (missionType.item != null) {
            local2 = dataManager.loadKey("Commodities", missionType.item);
            local3 = new Image(textureManager.getTextureGUIByKey(local2.bitmap));
            local3.y = description.y + description.height + 20;
            box.addChild(local3);
        }
        var local1:Text = new Text();
        local1.size = 13;
        local1.x = 0;
        local1.y = 145;
        local1.htmlText = Localize.t("Recycled") + ": <font color=\'#08ae08\'>" + mission.count + " / " + missionType.value;
        box.addChild(local1);
    }

    private function reputation():void {
    }

    private function boss():void {
        var local1:Text = new Text();
        local1.size = 13;
        local1.x = 0;
        local1.y = 145;
        local1.htmlText = Localize.t("Killed") + ": <font color=\'#ae7108\'>" + mission.count + " / 1";
        box.addChild(local1);
    }

    private function ship():void {
        var local1:Object = null;
        var local11:Object = null;
        var local8:Object = null;
        var local6:MovieClip = null;
        var local10:Vector.<Object> = new Vector.<Object>();
        for each(var local12:* in missionType.addedEnemies) {
            local1 = dataManager.loadKey("Enemies", local12);
            local11 = {};
            if (local1 != null) {
                local8 = dataManager.loadKey("Ships", local1.ship);
                local11.ship = local8;
                local11.enemy = local1;
                local10.push(local11);
            }
        }
        var local5:String = "";
        var local3:Number = 0;
        var local7:int = 5;
        var local9:int = description.y + description.height + 20;
        for each(var local4:* in local10) {
            if (local5 != local4.ship.bitmap) {
                local5 = local4.ship.bitmap;
                local6 = new MovieClip(textureManager.getTexturesMainByKey(local4.ship.bitmap));
                local6.x = local7;
                local6.y = local9;
                local7 += local6.width + 15;
                if (local7 > 400) {
                    local9 += local6.height + 5;
                    local7 = 5;
                }
                new ToolTip(g, local6, local4.enemy.name, null, "missionView");
                local3 = Number(Math.max(local3, local6.height));
                box.addChild(local6);
            }
        }
        var local2:Text = new Text();
        local2.size = 13;
        local2.x = 0;
        local2.y = local9 + local3 + 20;
        local2.htmlText = Localize.t("Killed") + ": <font color=\'#ae7108\'>" + mission.count + " / " + missionType.value;
        box.addChild(local2);
    }

    private function spawner():void {
        var local3:String = null;
        var local2:Text = new Text();
        local2.size = 13;
        local2.x = 70;
        local2.y = 125;
        local2.htmlText = Localize.t("Killed") + ": <font color=\'#ae7108\'>" + mission.count + " / " + missionType.value;
        box.addChild(local2);
        if (missionType.hasOwnProperty("bitmap")) {
            local3 = missionType.bitmap;
        } else {
            local3 = "MSpsdfGpTU2S9DE5B393Tw";
        }
        var local1:MovieClip = new MovieClip(textureManager.getTexturesMainByKey(local3));
        local1.x = 0;
        local1.y = 110;
        var _temp_1:* = local1;
        local1.scaleY = 0.7;
        _temp_1.scaleX = 0.7;
        box.addChild(local1);
    }

    private function addReward():Number {
        var x:int;
        var rewardY:int;
        var d:DropItem;
        var fluxText:Text;
        var artifactText:Text;
        var artifactIcon:Image;
        var t:ToolTip;
        var xpText:TextField;
        var s:String;
        var boostXp:int;
        var toolTipText:String;
        var xpBoostIcon:Image;
        var repImg:String;
        var reputationIcon:Image;
        var reputationText:Text;
        dropBase = g.dropManager.getDropItems(missionType.drop, g, mission.created);
        var rewardHeading:Text = new Text();
        rewardHeading.color = 11432200;
        rewardHeading.size = 14;
        rewardHeading.text = Localize.t("REWARD").toUpperCase();
        rewardHeading.x = 560;
        rewardHeading.y = 10;
        rewardHeading.alignCenter();
        box.addChild(rewardHeading);
        x = rewardHeading.x;
        rewardY = rewardHeading.y + 25;
        if (dropBase == null) {
            g.showErrorDialog(Localize.t("Error with mission") + ": " + missionType.title, true);
            return 0;
        }
        for each(d in dropBase.items) {
            rewardY = addRewardItem(d, x, rewardY);
        }
        rewardY += 5;
        if (dropBase.flux > 0) {
            fluxText = new Text();
            fluxText.color = 16777215;
            fluxText.size = 16;
            fluxText.alignCenter();
            fluxText.text = "" + dropBase.flux;
            fluxText.x = x;
            fluxText.y = rewardY;
            fluxIcon = new Image(textureManager.getTextureGUIByTextureName("credit_small.png"));
            fluxIcon.x = x - fluxText.width / 2 - fluxIcon.width / 2 - 4;
            fluxIcon.y = rewardY + fluxText.height / 2 - fluxIcon.height / 2 - 2;
            fluxText.x += fluxIcon.width / 2 - 2;
            addChild(fluxIcon);
            addChild(fluxText);
            rewardY += 20;
        }
        if (dropBase.artifactAmount > 0) {
            artifactText = new Text();
            artifactText.color = 16777215;
            artifactText.size = 16;
            artifactText.alignCenter();
            artifactText.text = "" + dropBase.artifactAmount;
            artifactText.x = x;
            artifactText.y = rewardY;
            artifactIcon = new Image(textureManager.getTextureGUIByTextureName("artifact_icon.png"));
            artifactIcon.x = x - artifactText.width / 2 - artifactIcon.width / 2 - 4;
            artifactIcon.y = rewardY + artifactText.height / 2 - artifactIcon.height / 2 - 2;
            artifactText.x += artifactIcon.width / 2 - 2;
            addChild(artifactIcon);
            addChild(artifactText);
            rewardY += 20;
            t = new ToolTip(g, artifactIcon, Localize.t("[amount]x (lvl [level]) artifacts").replace("[amount]", dropBase.artifactAmount).replace("[level]", dropBase.artifactLevel), null, "missionView");
        }
        if (dropBase.xp > 0) {
            xpText = new TextField(100, 30, "",
                    new TextFormat(
                            RussoBitmapFontRegistry.fontNameForSize(12), 12));
            xpText.format.color = 16777215;
            xpText.autoSize = "bothDirections";
            xpText.isHtmlText = true;
            dropBase.xp = 0.75 * dropBase.xp + 0.5;
            s = Localize.t("XP") + ": " + dropBase.xp;
            boostXp = int(Math.ceil(dropBase.xp * 0.3));
            if (g.me.hasExpBoost) {
                s += " <FONT COLOR=\'#88ff88\'>(+" + boostXp + ")</FONT>";
                xpText.text = s;
                new ToolTip(g, xpText, Localize.t("You have XP BOOST enabled!."), null, "missionView");
            } else {
                s += " <FONT COLOR=\'#333333\'>(+" + boostXp + ")</FONT>";
                xpText.text = s;
                new ToolTip(g, xpText, Localize.t("You don\'t have any XP BOOST active, get one if you want to gain <FONT COLOR=\'#FFFFFF\'>[xpBoost]%</FONT> more XP.").replace("[xpBoost]", 0.3 * 100), null, "missionView");
            }
            xpText.x = x;
            xpText.y = rewardY + 5;
            xpText.pivotX = xpText.width / 2;
            if (!g.me.hasExpBoost) {
                toolTipText = Localize.t("Get XP BOOST now!");
                xpBoostIcon = new Image(textureManager.getTextureGUIByTextureName("button_pay"));
                xpBoostIcon.useHandCursor = true;
                xpBoostIcon.addEventListener("touch", function (param1:TouchEvent):void {
                    if (param1.getTouch(xpBoostIcon, "ended")) {
                        g.enterState(new RoamingState(g));
                        g.enterState(new ShopState(g, "xpBoost"));
                    }
                });
                xpBoostIcon.x = xpText.x + xpText.width / 2 + 5;
                xpBoostIcon.y = xpText.y;
                addChild(xpBoostIcon);
                new ToolTip(g, xpBoostIcon, toolTipText, null, "shopIcons");
            }
            addChild(xpText);
            rewardY += 20;
        }
        if (mission.majorType == "time") {
            timeLeft.font = "Verdana";
            timeLeft.color = 11432200;
            timeLeft.size = 12;
            timeLeft.x = heading.x + heading.width + 20;
            timeLeft.y = heading.y;
            addChild(timeLeft);
        }
        if (dropBase.reputation > 0) {
            if (g.me.reputation > 0) {
                repImg = "police_icon.png";
            } else {
                repImg = "pirate_icon.png";
            }
            reputationIcon = new Image(textureManager.getTextureGUIByTextureName(repImg));
            reputationIcon.scaleX = 0.5;
            reputationIcon.scaleY = 0.5;
            reputationText = new Text();
            reputationText.color = 16777215;
            reputationText.size = 16;
            reputationText.alignCenter();
            reputationText.text = "" + dropBase.reputation;
            reputationText.y = rewardY;
            reputationIcon.x = x - reputationText.width / 2 - reputationText.width / 2;
            reputationIcon.y = rewardY + reputationText.height / 2 - reputationText.height / 2 + 3;
            reputationText.x = x + reputationText.width / 2 - 2;
            addChild(reputationIcon);
            addChild(reputationText);
            rewardY += 20;
        }
        return rewardY;
    }

    public function update():void {
        if (mission.majorType == "time") {
            drawExpireTime();
        }
    }

    private function drawExpireTime():void {
        var local1:int = (mission.expires - g.time) / 1000;
        if (local1 < 0) {
            removeAndRedrawList();
            return;
        }
        if (timeLeft != null) {
            timeLeft.htmlText = "" + local1;
        }
        var local2:int = int(Math.floor(local1 / 3600));
        local1 -= local2 * 60 * 60;
        var local5:int = int(Math.floor(local1 / 60));
        local1 -= local5 * 60;
        var local3:int = int(Math.floor(local1));
        var local6:String = local2 < 10 ? "0" + local2 : "" + local2;
        var local7:String = local5 < 10 ? "0" + local5 : "" + local5;
        var local4:String = local3 < 10 ? "0" + local3 : "" + local3;
        if (timeLeft != null) {
            timeLeft.htmlText = "(" + Localize.t("expires in") + ": " + local6 + ":" + local7 + ":" + local4 + ")";
        }
    }

    private function addRewardItem(param1:DropItem, param2:int, param3:int):int {
        var local7:Image = null;
        var local4:Text = new Text();
        local4.color = 16777215;
        local4.size = 14;
        local4.alignCenter();
        local4.x = param2;
        local4.y = param3;
        var local8:String = param1.name;
        local8.toLocaleUpperCase();
        local4.htmlText = param1.quantity.toString();
        while (local4.width > 160) {
            local4.size--;
        }
        var local5:Sprite = new Sprite();
        if (param1.table == "Skins") {
            local7 = new Image(textureManager.getTexturesMainByKey(param1.bitmapKey)[0]);
        } else {
            local7 = new Image(textureManager.getTextureGUIByKey(param1.bitmapKey));
        }
        if (local7.height > 30) {
            local7.scaleX = local7.scaleY = 20 / local7.height;
        }
        local7.x = param2 - local4.width / 2 - local7.width / 2 - 4;
        local7.y = param3 + local4.height / 2 - local7.height / 2 - 2;
        local4.x += local7.width / 2 - 2;
        var local6:ToolTip = new ToolTip(g, local5, local8, null, "missionView");
        local5.addChild(local7);
        box.addChild(local5);
        box.addChild(local4);
        return param3 + local7.height + 5;
    }

    private function addRewardButton(param1:Number):void {
        var local2:Button = new Button(tryCollectReward, Localize.t("COLLECT REWARD").toUpperCase(), "positive");
        local2.visible = mission.finished;
        if (box.height < param1 + local2.height + box.padding * 2) {
            box.height = param1 + local2.height + box.padding;
        }
        local2.x = box.width - local2.width - box.padding * 2;
        local2.y = height - local2.height - box.padding * 2;
        addChild(local2);
    }

    private function addHeading():void {
        heading = new Text();
        heading.y = -5;
        heading.color = 16777215;
        heading.size = 13;
        var local1:String = missionType.title;
        heading.htmlText = fixText(g, missionType, local1);
        addChild(heading);
    }

    private function addDescription():void {
        description = new Text();
        description.font = "Verdana";
        description.color = 10592673;
        description.size = 12;
        description.wordWrap = true;
        description.width = 380;
        var local1:String = missionType.description;
        if (mission.finished && missionType.completeDescription != null) {
            if (missionType.hasOwnProperty("nextMission")) {
                description.htmlText = Localize.t("Mission Completed! Click claim reward to proceed to next step.");
            } else {
                description.htmlText = fixText(g, missionType, missionType.completeDescription);
            }
        } else {
            description.htmlText = fixText(g, missionType, local1);
        }
        description.y = 22;
        if (description.height > 90) {
            description.width = 460;
        }
        if (description.height > 90) {
            description.size--;
        }
        addChild(description);
    }

    private function tryCollectReward(param1:TouchEvent):void {
        g.rpc("requestMissionReward", rewardArrived, mission.id, mission.majorType);
    }

    private function rewardArrived(param1:Message):void {
        var local3:Boolean = param1.getBoolean(0);
        if (!local3) {
            g.showErrorDialog(Localize.t("Mission not complete."));
            return;
        }
        if (missionType.majorType == "static") {
            Game.trackEvent("missions", "static", missionType.title);
        } else if (missionType.majorType == "time") {
            Game.trackEvent("missions", "timed", missionType.title);
        }
        g.me.removeMission(mission);
        g.creditManager.refresh();
        for each(var local2:* in dropBase.items) {
            transferItemToCargo(local2);
        }
        g.hud.cargoButton.update();
        g.hud.resourceBox.update();
        g.hud.cargoButton.flash();
        animateCollectReward();
    }

    private function removeAndRedrawList():void {
        tween = TweenMax.to(this, 0.3, {
            "alpha": 0,
            "onComplete": redrawParentList,
            "ease": Circ.easeIn
        });
    }

    private function redrawParentList():void {
        g.me.removeMission(mission);
        dispatchEventWith("reload");
    }

    private function animateCollectReward():void {
        tween = TweenMax.to(this, 0.3, {
            "alpha": 0,
            "onComplete": collectReward,
            "ease": Circ.easeIn
        });
        var local1:ISound = SoundLocator.getService();
        local1.preCacheSound("7zeIcPFb-UWzgtR_3nrZ8Q");
    }

    private function collectReward():void {
        dispatchEventWith("animateCollectReward", true);
        g.textManager.createMissionCompleteText();
    }

    private function transferItemToCargo(param1:Object):void {
        var local4:String = param1.table;
        var local2:String = param1.item;
        var local3:Number = Number(param1.quantity);
        g.myCargo.addItem(local4, local2, local3);
    }
}
}

