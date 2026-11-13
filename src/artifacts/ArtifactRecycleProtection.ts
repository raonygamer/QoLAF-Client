import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { ArtifactCargoBox, ArtifactOverview } from '../game/Bindings';
import type { ArtifactView } from './ArtifactView';
import type { ArtifactFavorites } from './ArtifactFavorites';

/** Source favorite guards, including final validation before native bulkRecycle. */
export function installArtifactRecycleProtection(api: API, favorites: ArtifactFavorites): void {
  const reflection = new GameReflection(api);
  const Cargo = ArtifactCargoBox.prototype;
  const Overview: ArtifactView = ArtifactOverview.prototype;
  const protectedBox = (box: ArtifactCargoBox) =>
    !!box.a && favorites.isFavorite(box.p.id, box.a.id);
  const clear = (box: ArtifactCargoBox) => {
    if (box.frame?.get_color() === 12203572) box.setNotSelected();
  };
  const prune = (view: ArtifactView) => {
    for (let index = view.markedForRecycle.length - 1; index >= 0; index--) {
      const artifact = view.markedForRecycle[index];
      if (artifact && !favorites.isFavorite(view.p.id, artifact.id)) continue;
      view.markedForRecycle.splice(index, 1);
      for (const box of view.cargoBoxes) if (box.a === artifact) clear(box);
    }
  };
  for (const method of ['setSelectedForRecycle', 'toggleRecycle', 'onClick'] as const)
    reflection.around(Cargo, method, function (next, ...args) {
      if (protectedBox(this) && (method !== 'onClick' || this.recycleMode)) {
        clear(this);
        return;
      }
      return next(...args);
    });
  reflection.after(Cargo, 'addToolTip', function () {
    if (this.recycleMode && protectedBox(this)) {
      this.toolTip?.set_text('Favorite artifact: unfavorite it before recycling.');
      return;
    }
  });
  reflection.around(Overview, 'onRecycleSelect', function (next, event) {
    const box: unknown = event.target;
    if (!(box instanceof ArtifactCargoBox)) return;
    if (this.g.artifactRecyclePending) {
      if (box.a && this.markedForRecycle.includes(box.a)) box.setSelectedForRecycle();
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
  reflection.around(Overview, 'toggleRecycle', function (next, ...args) {
    if (!this.g.artifactRecyclePending) return next(...args);
    this.toggleRecycleButton.set_enabled(this.toggleRecycleButton.get_visible());
    this.cancelRecycleButton.set_enabled(this.cancelRecycleButton.get_visible());
  });
  reflection.around(Overview, 'selectAllForRecycle', function () {
    if (!this.g.artifactRecyclePending) {
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
          artifact.get_isUnique()
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
  reflection.around(Overview, 'onRecycle', function (next, ...args) {
    if (this.g.artifactRecyclePending) {
      this.recycleButton.set_enabled(true);
      return;
    }
    prune(this);
    if (!this.markedForRecycle.length) {
      this.recycleButton.set_enabled(true);
      return;
    }
    const cargo = this.g.myCargo;
    if (!cargo || cargo.get_isFull()) return next(...args);
    this.g.artifactRecyclePending = true;
    try {
      return next(...args);
    } catch (error) {
      this.g.artifactRecyclePending = false;
      throw error;
    }
  });
  reflection.before(Overview, 'onRecycleMessage', function () {
    this.g.artifactRecyclePending = false;
  });
}
