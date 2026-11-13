import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { ServiceRoomPreview, ServiceRoomSelector } from '../game/Bindings';

/** Original selector advances on preview readiness instead of guessed delays. */
export function installServiceRoomSelection(api: API): void {
  const reflection = new GameReflection(api);
  const ready = (preview: ServiceRoomPreview) =>
    preview.playerLevel === 0 && preview.onlineFriends != null && preview.enabled;
  reflection.around(ServiceRoomSelector.prototype, 'setNewPlayer', function () {
    if (this.isAutoSelectingRoom || !this.roomPreviews.some(ready)) return;
    this.isAutoSelectingRoom = true;
    this.set_visible(false);
    this.connectToBestNoobRoom();
  });
  // Native onPreview already requests selection. If it arrives first, the
  // friends response must retry after updateStatus makes the row selectable.
  reflection.after(ServiceRoomPreview.prototype, 'onOnlineFriends', function () {
    if (ready(this)) this.serviceRoomSelector.setNewPlayer();
  });
  reflection.around(ServiceRoomSelector.prototype, 'onSelect', function (_next, selected, id) {
    for (const preview of this.roomPreviews) {
      if (preview === selected) preview.highlight();
      else preview.disable();
    }
    this.callback(id);
  });
}
