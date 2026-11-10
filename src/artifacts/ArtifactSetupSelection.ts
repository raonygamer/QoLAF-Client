import { read, type API, type Raw } from '../api/Types';

/** Source syncSetupSelection: Player owns selection, not the toggle control. */
export function syncArtifactSetupSelection(view: Raw, setupLabel: string): void {
  let x = 0;
  for (let index = 0; index < view.setups.length; index++) {
    const button = view.setups[index];
    const isBuy = index === view.p.artifactSetups.length;
    const selected = !isBuy && index === view.p.activeArtifactSetup;
    button.set_selected(selected);
    if (!isBuy) button.set_label(selected ? `${setupLabel} ${index + 1}` : String(index + 1));
    // set_label fits native setup controls automatically; apply source sizing last.
    button.set_width(isBuy ? 34 : selected ? 72 : 32);
    button.set_height(24);
    button.set_x(x);
    x += read(button, 'width') + 6;
  }
}

export function installArtifactSetupSelection(api: API): void {
  const overview = api.cls('core.artifact.ArtifactOverview')?.prototype;
  const toggle = api.cls('core.hud.components.ui.ToggleButton')?.prototype;
  const localize = api.cls('generics.Localize');
  if (!overview || !toggle || !localize) return;
  const owned = new WeakSet<Raw>();
  const sync = (view: Raw) => {
    for (const button of view.setups) owned.add(button);
    syncArtifactSetupSelection(view, localize.t('Setup'));
  };
  api.after(overview, 'drawArtifactSetups', function () {
    sync(this);
  });
  api.around(overview, 'syncSetupButtons', function () {
    sync(this);
  });
  api.around(toggle, 'onTriggered', function (next, ...args) {
    if (!owned.has(this)) return next(...args);
    // AstroTheme.artifactSetupButton disables self-toggling. Native callbacks
    // retain safe-zone/recycle checks and synchronize from activeArtifactSetup.
    this.dispatchEventWith('change', true);
    this.dispatchEventWith('triggered', true);
  });
}
