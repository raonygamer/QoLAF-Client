import { read, type API, type Raw } from '../api/Types';
import { ArtifactSetupRow } from './ArtifactSetupRow';

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

export function installArtifactSetupSelection(
  api: API,
  skins?: () => Promise<Record<string, Raw>>,
): void {
  const overview = api.cls('core.artifact.ArtifactOverview')?.prototype;
  const toggle = api.cls('core.hud.components.ui.ToggleButton')?.prototype;
  const localize = api.cls('generics.Localize');
  if (!overview || !toggle || !localize) return;
  const owned = new WeakSet<Raw>();
  const rows = new Map<Raw, ArtifactSetupRow>();
  const sync = (view: Raw) => {
    for (const button of view.setups) {
      if (owned.has(button)) continue;
      owned.add(button);
      if (button.textField) {
        // AstroTheme selects the 16px Russo atlas for its 10px setup labels.
        // Native setup controls otherwise downsample the primary 56px sheet.
        button.labelFont = 'DAIDRR_16';
        button.labelSize = 10;
        button.textField.get_format().set_font(button.labelFont);
        button.textField.get_format().set_size(10);
        button.textField.set_pixelSnapping(false);
      }
    }
    syncArtifactSetupSelection(view, localize.t('Setup'));
    rows.get(view)?.layout();
  };
  if (skins) {
    api.around(overview, 'drawArtifactSetups', function (next, ...args) {
      const previous = [...this.setups];
      rows.get(this)?.dispose(true);
      rows.delete(this);
      const result = next(...args);
      for (const button of previous) if (!read(button, 'parent')) button.dispose();
      return result;
    });
    if (typeof overview.drawComponents === 'function')
      api.after(overview, 'drawComponents', function () {
        if (this.artifactViewDisposed) return;
        // Haxe keeps this separator in a local variable; source gives it a field.
        const separator = this.getChildAt(0);
        if (read(separator, 'height') === 1 && read(separator, 'color') === 0xaaaaaa)
          this.artifactSetupSeparator = separator;
        rows.get(this)?.layout();
      });
    api.before(overview, 'dispose', function () {
      rows.get(this)?.dispose();
      rows.delete(this);
    });
    api.defer(() => {
      for (const row of rows.values()) row.dispose(true);
      rows.clear();
    });
  }
  api.after(overview, 'drawArtifactSetups', function () {
    sync(this);
    if (skins) rows.set(this, new ArtifactSetupRow(api, this, skins));
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
