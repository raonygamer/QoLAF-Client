import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import {
  Artifact,
  ArtifactBox,
  ArtifactCargoBox,
  ArtifactOverview,
  type GameScene,
  type Sprite,
  type DisplayObject,
} from '../game/Bindings';
import { artifactOrder } from './ArtifactOrder';
import { artifactTooltip } from './ArtifactTooltip';

interface ArtifactView extends ArtifactOverview {
  expandedView?: boolean;
  viewWidth?: number;
  viewHeight?: number;
  sortingBar?: DisplayObject;
  layoutToggleButton?: DisplayObject;
  closeViewButton?: DisplayObject;
}

type SortingDialog = new (
  game: GameScene,
  sort: (order: string) => void,
  close: () => void,
  expanded: boolean,
) => Sprite;

export function installArtifactUI(api: API, createSorting: () => SortingDialog): void {
  const reflection = new GameReflection(api);
  let Sorting: SortingDialog | undefined;
  const popups = new Map<ArtifactView, Sprite>();
  const refreshTooltip = (box: ArtifactBox | ArtifactCargoBox, cargo: boolean) => {
    if (box.a?.revealed && box.toolTip)
      box.toolTip.set_text(artifactTooltip({ a: box.a, p: box.p, g: box.g }, cargo));
  };
  reflection.after(ArtifactCargoBox.prototype, 'addToolTip', function () {
    refreshTooltip(this, true);
  });
  reflection.after(ArtifactBox.prototype, 'setArtifact', function () {
    refreshTooltip(this, false);
  });
  const overview = ArtifactOverview.prototype;
  reflection.before(overview, 'reloadStats', function () {
    for (const box of this.activeSlots ?? []) refreshTooltip(box, false);
  });
  const dismiss = (view: ArtifactView) => {
    const popup = popups.get(view);
    popups.delete(view);
    popup?.removeFromParent(true);
    view.chooseSortingButton?.set_enabled(true);
  };
  reflection.around(overview, 'chooseSorting', function () {
    if (popups.has(this)) {
      dismiss(this);
      return;
    }
    Sorting ??= createSorting();
    const view: ArtifactView = this;
    const popup = new Sorting(
      view.g,
      (order) => view.onSort(order),
      () => dismiss(view),
      !!view.expandedView,
    );
    popup.set_x(view.expandedView ? Math.round(((view.viewWidth ?? 665) - 665) / 2) : 0);
    popup.set_y(view.expandedView ? Math.round(((view.viewHeight ?? 520) - 520) / 2) : 0);
    popups.set(view, popup);
    view.addChild(popup);
    for (const node of [view.sortingBar, view.layoutToggleButton, view.closeViewButton]) {
      if (node?.get_parent() === view) view.setChildIndex(node, view.get_numChildren() - 1);
    }
  });
  reflection.before(overview, 'dispose', function () {
    dismiss(this);
  });
  api.defer(() => {
    for (const view of popups.keys()) dismiss(view);
  });
  reflection.around(overview, 'onSort', function (_next, order) {
    dismiss(this);
    let compare = artifactOrder(this.p, order);
    if (!compare) {
      Artifact.currentTypeOrder = order;
      compare = (a, b) => {
        if (a.revealed !== b.revealed) return a.revealed ? -1 : 1;
        const left = a.getStat(order),
          right = b.getStat(order);
        return left > right ? -1 : left < right ? 1 : 0;
      };
    }
    this.p.artifacts.sort(compare);
    this.cargoContainer.removeChildren(0, -1, true);
    this.cargoBoxes.length = 0;
    this.drawArtifactsInCargo();
    this.cargoContainer.scrollToPosition(0, 0);
  });
}
