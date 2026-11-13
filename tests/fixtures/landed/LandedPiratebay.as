package core.states.gameStates {
import core.credits.CreditManager;
import core.hud.components.ShopItemBar;
import core.hud.components.Text;
import core.hud.components.cargo.Cargo;
import core.player.FleetObj;
import core.scene.Game;
import core.solarSystem.Body;

import feathers.controls.ScrollContainer;

import generics.Localize;

import starling.display.Sprite;
import starling.events.Event;
import starling.events.TouchEvent;

public class LandedPiratebay extends LandedState {
    private var shopItemBars:Vector.<ShopItemBar> = new Vector.<ShopItemBar>();
    private var myCargo:Cargo;
    private var container:ScrollContainer;
    private var infoContainer:Sprite = new Sprite();
    private var hasBought:Boolean = false;
    private var fluxCost:int;

    public function LandedPiratebay(param1:Game, param2:Body, param3:Boolean = true) {
        super(param1, param2, param2.name);
        fluxCost = CreditManager.getCostWeaponFactory(param2.obj.payVaultItem);
        myCargo = param1.myCargo;
    }

    override public function enter():void {
        super.enter();
        container = new ScrollContainer();
        container.width = 640;
        container.height = 400;
        container.x = 60;
        container.y = 140;
        addChild(container);
        infoContainer.x = 380;
        infoContainer.y = 140;
        addChild(infoContainer);
        var local1:Text = new Text();
        local1.text = body.name;
        local1.size = 26;
        local1.x = 60;
        local1.y = 50;
        addChild(local1);
        var local2:Text = new Text();
        local2.text = Localize.t("Copy one of your weapons with minerals or Flux.");
        local2.color = 11184810;
        local2.x = 60;
        local2.y = local1.y + local1.height + 10;
        addChild(local2);
        cargoRecieved();
    }

    override public function execute():void {
        super.execute();
    }

    private function cargoRecieved():void {
        var local3:int = 0;
        var local1:Object = null;
        var local2:ShopItemBar = null;
        var local5:Array = body.obj.shopItems;
        if (g.me.fleet.length == 1) {
            g.showErrorDialog(Localize.t("You need more than one ship and multiple weapons to use the piratebay."));
            loadCompleted();
            return;
        }
        if (local5 == null || local5.length == 0) {
            g.showErrorDialog(Localize.t("This piratebay is of no use to you."));
            loadCompleted();
            return;
        }
        var local4:int = 0;
        local3 = 0;
        while (local3 < local5.length) {
            local1 = local5[local3];
            if (hasWeaponInFleet(local1.item)) {
                if (local1.available) {
                    local2 = new ShopItemBar(g, infoContainer, local1, fluxCost);
                    local2.x = 0;
                    local2.y = 60 * local4;
                    local2.addEventListener("select", onSelect);
                    local2.addEventListener("bought", bought);
                    shopItemBars.push(local2);
                    container.addChild(local2);
                    local4++;
                }
            }
            local3++;
        }
        loadCompleted();
    }

    private function hasWeaponInFleet(param1:String):Boolean {
        for each(var local3:* in g.me.fleet) {
            for each(var local2:* in local3.weapons) {
                if (local2.weapon == param1) {
                    return true;
                }
            }
        }
        return false;
    }

    private function onSelect(param1:TouchEvent):void {
        var local2:ShopItemBar = param1.target as ShopItemBar;
        for each(var local3:* in shopItemBars) {
            if (local3 != local2) {
                local3.deselect();
            }
        }
    }

    private function bought(param1:Event):void {
        for each(var local2:* in shopItemBars) {
            local2.update();
        }
        hasBought = true;
    }

    override public function exit(param1:Function):void {
        if (hasBought) {
            g.tutorial.showChangeWeapon();
        }
        for each(var local2:* in shopItemBars) {
            local2.removeEventListener("bought", bought);
            local2.removeEventListener("select", onSelect);
        }
        super.exit(param1);
    }
}
}

