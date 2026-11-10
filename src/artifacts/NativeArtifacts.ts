import type { API, Raw } from '../api/Types';
import { read } from '../api/Types';
import { artifactOrder } from './ArtifactOrder';
import { artifactTooltip } from './ArtifactTooltip';
export function installArtifactUI(api: API, createSorting: () => any) {
  let Sorting: any;
  const popups = new Map<Raw, Raw>();
  for (const [name, method] of [
    ['core.artifact.ArtifactCargoBox', 'addToolTip'],
    ['core.artifact.ArtifactBox', 'setArtifact'],
  ]) {
    const prototype = api.cls(name)?.prototype;
    if (typeof prototype?.[method] !== 'function') throw Error(`Missing ${name}.${method}`);
    api.after(prototype, method, function () {
      if (this.a?.revealed && this.toolTip)
        this.toolTip.set_text(artifactTooltip(api, this, name.endsWith('.ArtifactCargoBox')));
    });
  }
  const overview = api.cls('core.artifact.ArtifactOverview')!.prototype;
  if (typeof overview.reloadStats === 'function')
    api.before(overview, 'reloadStats', function () {
      for (const box of this.activeSlots ?? [])
        if (box.a?.revealed && box.toolTip) box.toolTip.set_text(artifactTooltip(api, box, false));
    });
  const dismiss = (view: Raw) => {
    const popup = popups.get(view);
    popups.delete(view);
    if (popup) popup.removeFromParent(true);
    view.chooseSortingButton?.set_enabled(true);
  };
  api.around(overview, 'chooseSorting', function () {
    if (popups.has(this)) {
      dismiss(this);
      return;
    }
    Sorting ??= createSorting();
    const view = this;
    const popup = new Sorting(
      this.g,
      (order: string) => view.onSort(order),
      () => dismiss(view),
      !!this.expandedView,
    );
    popup.x = this.expandedView ? Math.round((this.viewWidth - 665) / 2) : 0;
    popup.y = this.expandedView ? Math.round((this.viewHeight - 520) / 2) : 0;
    popups.set(this, popup);
    this.addChild(popup);
    for (const node of [this.sortingBar, this.layoutToggleButton, this.closeViewButton]) {
      if (node && read(node, 'parent') === this)
        this.setChildIndex(node, read(this, 'numChildren') - 1);
    }
  });
  if (typeof overview.dispose === 'function')
    api.before(overview, 'dispose', function () {
      dismiss(this);
    });
  api.defer(() => {
    for (const view of popups.keys()) dismiss(view);
  });
  api.around(overview, 'onSort', function (_next, order: string) {
    let compare = artifactOrder(this.p, order);
    if (!compare) {
      const Artifact = api.cls('core.artifact.Artifact');
      if (Artifact) Artifact.currentTypeOrder = order;
      compare = (a: Raw, b: Raw) => {
        if (a.revealed !== b.revealed) return a.revealed ? -1 : 1;
        const left = a.getStat(order),
          right = b.getStat(order);
        return left > right ? -1 : left < right ? 1 : 0;
      };
    }
    this.chooseSortingButton.set_enabled(true);
    this.p.artifacts.sort(compare);
    this.cargoContainer.removeChildren(0, -1, true);
    this.cargoBoxes.length = 0;
    this.drawArtifactsInCargo();
    this.cargoContainer.scrollToPosition(0, 0);
  });
}
