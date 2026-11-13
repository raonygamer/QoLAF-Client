package core.states.gameStates {
import core.scene.Game;
import core.solarSystem.Body;

import starling.events.TouchEvent;

/**
 * DB-backed Pirate Bay that can be opened without landing in Hozar.
 * Closing it restores roaming or rebuilds the player's real landed screen;
 * it never sends a takeoff request for the synthetic Pirate Bay body.
 */
public final class PortablePiratebayState extends LandedPiratebay {
    private var leaving:Boolean;

    public function PortablePiratebayState(game:Game, body:Body) {
        super(game, body);
    }

    override public function leave(event:TouchEvent = null):void {
        if (sm == null || _unloaded || leaving) {
            return;
        }
        leaving = true;
        if (g.me != null && g.me.isLanded && g.me.currentBody != null) {
            g.enterLandedState();
        } else {
            sm.revertState();
        }
    }
}
}
