import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { LandedExplore, LandedState, ReportState, SelectTeamState } from '../game/Bindings';

/** The landed base handles leave keys once; exploration only owns its child screens. */
export function installLandedExploreInput(api: API): void {
  const reflection = new GameReflection(api);
  reflection.around(LandedExplore.prototype, 'execute', function () {
    if (this.sceneSM.inState(SelectTeamState)) {
      this.leaveButton.set_visible(false);
      if (this.keybinds.get_isEscPressed()) this.sceneSM.revertState();
    } else if (this.sceneSM.inState(ReportState)) {
      this.leaveButton.set_visible(false);
    } else {
      LandedState.prototype.execute.call(this);
      this.leaveButton.set_visible(true);
    }
  });
}
