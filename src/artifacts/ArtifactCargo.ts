import { read, type API, type Raw } from '../api/Types';

interface CargoState {
  footerY: number;
  count: number;
  capacityLevel: number;
  button: Raw | null;
  label: Raw | null;
  onFrame: () => void;
}

/** Source overview grid and live capacity footer; native boxes retain all actions. */
export function installArtifactCargo(api: API, createScroll: () => any): void {
  const Overview = api.cls('core.artifact.ArtifactOverview')?.prototype;
  let Scroll: any;
  const Box = api.cls('core.artifact.ArtifactCargoBox') as any;
  const Button = api.cls('core.hud.components.Button') as any;
  const Text = api.cls('core.hud.components.TextBitmap') as any;
  const Player = api.cls('core.player.Player');
  const Localize = api.cls('generics.Localize');
  if (!Overview || !Box || !Button || !Text || !Player || !Localize)
    throw Error('Artifact cargo runtime dependencies are missing');
  const states = new Map<Raw, CargoState>();
  const refresh = (view: Raw, state: CargoState) => {
    const player = view.p;
    if (!player || read(view.g, 'isLeaving') || !view.cargoContainer) return;
    const count = read(player, 'artifactCount');
    const capacityLevel = player.artifactCapacityLevel;
    if (state.count === count && state.capacityLevel === capacityLevel) return;
    state.count = count;
    state.capacityLevel = capacityLevel;
    const text = `${count} / ${read(player, 'artifactLimit')}`;
    if (capacityLevel < Player.ARTIFACT_CAPACITY.length - 1) {
      state.label?.removeFromParent(true);
      state.label = null;
      if (!state.button) {
        state.button = new Button((event: Raw) => view.onUpgradeCapacity(event), text, 'positive');
        state.button!.set_width(Math.max(1, (view.cargoWidth ?? 375) - 35));
        state.button!.set_y(state.footerY);
        view.cargoContainer.addChild(state.button);
      }
      state.button!.set_text(
        `${text} ${Localize.t('INCREASE to')} ${Player.ARTIFACT_CAPACITY[capacityLevel + 1]}`,
      );
    } else {
      state.button?.removeFromParent(true);
      state.button = null;
      if (!state.label) {
        state.label = new Text();
        state.label!.set_y(state.footerY);
        view.cargoContainer.addChild(state.label);
      }
      state.label!.set_text(text);
    }
  };
  const detach = (view: Raw) => {
    const state = states.get(view);
    if (!state) return;
    view.removeEventListener('enterFrame', state.onFrame);
    states.delete(view);
  };
  api.around(Overview, 'drawArtifactsInCargo', function () {
    const view = this;
    if (!view.cargoContainer) {
      Scroll ??= createScroll();
      view.cargoContainer = new Scroll();
      view.cargoContainer.set_x(view.cargoX ?? 0);
      view.cargoContainer.set_y(view.cargoY ?? 105);
      view.cargoContainer.set_width(view.cargoWidth ?? 375);
      view.cargoContainer.set_height(view.cargoHeight ?? 365);
      view.addChild(view.cargoContainer);
    }
    const columns = view.cargoColumns ?? 10;
    const rows = Math.max(1, Math.ceil(Math.max(view.p.artifacts.length, 100) / columns));
    let cellHeight = 0;
    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        const artifact = view.p.artifacts[row * columns + column] ?? null;
        const box = new Box(view.g, artifact);
        cellHeight = read(box, 'height') + 8;
        box.set_x(36 * column);
        box.set_y(cellHeight * row);
        view.cargoContainer.addChild(box);
        view.cargoBoxes.push(box);
      }
    }
    detach(view);
    const state: CargoState = {
      footerY: cellHeight * rows,
      count: -1,
      capacityLevel: -1,
      button: null,
      label: null,
      onFrame: () => refresh(view, state),
    };
    states.set(view, state);
    view.addEventListener('enterFrame', state.onFrame);
    refresh(view, state);
  });
  const enableCapacity = (view: Raw) => states.get(view)?.button?.set_enabled(true);
  if (typeof Overview.onUpgradeCapacity === 'function')
    api.around(Overview, 'onUpgradeCapacity', function () {
      if (this.p.artifactCapacityLevel >= Player.ARTIFACT_CAPACITY.length - 1) return;
      const view = this;
      const Credit = api.cls('core.credits.CreditManager')!;
      const BuyBox = api.cls('core.hud.components.dialogs.CreditBuyBox') as any;
      const cost = Credit.getCostArtifactCapacityUpgrade(view.p.artifactCapacityLevel + 1);
      const box = new BuyBox(
        view.g,
        cost,
        `${Localize.t('Increases artifact capacity to')} ${Player.ARTIFACT_CAPACITY[view.p.artifactCapacityLevel + 1]}`,
      );
      view.g.addChildToOverlay(box);
      box.addEventListener('accept', () => {
        view.g.removeChildFromOverlay(box, true);
        view.g.rpc('upgradeArtifactCapacity', (response: Raw) =>
          view.onBuyArtifactConfirm(response),
        );
      });
      box.addEventListener('close', () => {
        view.g.removeChildFromOverlay(box, true);
        enableCapacity(view);
      });
    });
  if (typeof Overview.onBuyArtifactConfirm === 'function')
    api.around(Overview, 'onBuyArtifactConfirm', function (_next, response: Raw) {
      if (!response.getBoolean(0)) {
        this.g.showErrorDialog(response.getString(1));
        enableCapacity(this);
        return;
      }
      this.g.showErrorDialog(Localize.t('Success!'));
      this.p.artifactCapacityLevel++;
      // The original keeps selection, tile identities and scroll position.
      // Reconcile the footer of any overview reopened while the RPC was pending.
      for (const [view, state] of states) {
        if (view.p !== this.p) continue;
        refresh(view, state);
        view.updateInventorySummary?.();
        enableCapacity(view);
      }
      if (this.p.artifactCount < read(this.p, 'artifactLimit')) this.g.hud.hideArtifactLimitText();
      this.g.creditManager.refresh();
    });
  api.before(Overview, 'dispose', function () {
    detach(this);
  });
  api.defer(() => {
    for (const view of states.keys()) detach(view);
  });
}
