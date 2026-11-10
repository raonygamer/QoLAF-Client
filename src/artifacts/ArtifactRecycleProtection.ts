import { read, type API, type Raw } from '../api/Types';
import type { ArtifactFavorites } from './ArtifactFavorites';

/** Source favorite guards, including final validation before native bulkRecycle. */
export function installArtifactRecycleProtection(api: API, favorites: ArtifactFavorites): void {
  const Cargo = api.cls('core.artifact.ArtifactCargoBox')?.prototype;
  const Overview = api.cls('core.artifact.ArtifactOverview')?.prototype;
  if (!Cargo || !Overview) return;
  const protectedBox = (box: Raw) => !!box.a && favorites.isFavorite(box.p.id, box.a.id);
  const clear = (box: Raw) => {
    if (read(box.frame, 'color') === 12203572) box.setNotSelected();
  };
  const prune = (view: Raw) => {
    for (let index = view.markedForRecycle.length - 1; index >= 0; index--) {
      const artifact = view.markedForRecycle[index];
      if (artifact && !favorites.isFavorite(view.p.id, artifact.id)) continue;
      view.markedForRecycle.splice(index, 1);
      for (const box of view.cargoBoxes) if (box.a === artifact) clear(box);
    }
  };
  for (const method of ['setSelectedForRecycle', 'toggleRecycle', 'onClick'])
    api.around(Cargo, method, function (next, ...args) {
      if (protectedBox(this) && (method !== 'onClick' || this.recycleMode)) {
        clear(this);
        return;
      }
      return next(...args);
    });
  api.after(Cargo, 'addToolTip', function () {
    if (this.recycleMode && protectedBox(this)) {
      this.toolTip.set_text('Favorite artifact: unfavorite it before recycling.');
      return;
    }
  });
  api.around(Overview, 'onRecycleSelect', function (next, event) {
    const box = event.target;
    if (this.artifactRecyclePending) {
      if (this.markedForRecycle.includes(box.a)) box.setSelectedForRecycle();
      else clear(box);
      return;
    }
    if (!box.a || protectedBox(box)) {
      clear(box);
      prune(this);
      return;
    }
    return next(event);
  });
  api.around(Overview, 'toggleRecycle', function (next, ...args) {
    if (!this.artifactRecyclePending) return next(...args);
    this.toggleRecycleButton.set_enabled(read(this.toggleRecycleButton, 'visible'));
    this.cancelRecycleButton.set_enabled(read(this.cancelRecycleButton, 'visible'));
  });
  api.around(Overview, 'selectAllForRecycle', function () {
    if (!this.artifactRecyclePending) {
      this.markedForRecycle.length = 0;
      for (const box of this.cargoBoxes) clear(box);
      for (const box of this.cargoBoxes) {
        const artifact = box.a;
        if (
          !artifact ||
          protectedBox(box) ||
          box.isUsedInSetup() ||
          artifact.upgrading ||
          artifact.upgraded > 0 ||
          read(artifact, 'isUnique')
        )
          continue;
        if (this.markedForRecycle.length === 40) break;
        box.setSelectedForRecycle();
        this.markedForRecycle.push(artifact);
      }
      this.cargoContainer.scrollToPosition(0, 0);
    }
    this.selectAllRecycleButton.set_enabled(true);
  });
  api.around(Overview, 'onRecycle', function (next, ...args) {
    if (this.artifactRecyclePending) {
      this.recycleButton.set_enabled(true);
      return;
    }
    prune(this);
    if (!this.markedForRecycle.length) {
      this.recycleButton.set_enabled(true);
      return;
    }
    if (read(this.g.myCargo, 'isFull')) return next(...args);
    this.artifactRecyclePending = true;
    try {
      return next(...args);
    } catch (error) {
      this.artifactRecyclePending = false;
      throw error;
    }
  });
  api.before(Overview, 'onRecycleMessage', function () {
    this.artifactRecyclePending = false;
  });
}
