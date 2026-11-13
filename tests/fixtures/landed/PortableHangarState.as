package core.states.gameStates {
import core.hud.components.Hangar;
import core.scene.Game;
import core.solarSystem.Body;

import starling.events.TouchEvent;

/**
 * Catalog-backed hangar that can be entered without landing at a station.
 * Closing it restores roaming directly or rebuilds the real landed screen,
 * without sending a server takeoff request for the synthetic hangar body.
 */
public final class PortableHangarState extends LandedState {
    private var leaving:Boolean;

    public function PortableHangarState(game:Game, body:Body) {
        super(game, body, body.name);
    }

    override public function enter():void {
        super.enter();
        addChild(new Hangar(g, body, true));
        loadCompleted();
    }

    override public function leave(event:TouchEvent = null):void {
        if (sm == null || _unloaded || leaving) {
            return;
        }
        leaving = true;
        if (g.me != null && g.me.isLanded && g.me.currentBody != null) {
            // LandedState instances are destructive on exit and cannot safely
            // be re-entered. Recreate the correct screen from the real body.
            g.enterLandedState();
        } else {
            sm.revertState();
        }
    }
}
}
