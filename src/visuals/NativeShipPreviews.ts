import { read, type API, type Raw } from '../api/Types';
import { ShipVisualCatalog } from './ShipVisualCatalog';
import { ShipVisualStateStore } from './ShipVisualStateStore';

/** PlayerListItem.as previews the selected representative hull at the native 40px size. */
export function installNativeShipPreviews(api: API, game: Raw): void {
  const Item = api.cls('core.hud.components.playerList.PlayerListItem')?.prototype;
  const MovieClip = api.cls('starling.display.MovieClip') as any;
  const Factory = api.cls('core.ship.ShipFactory');
  const textures = api.cls('textures.TextureLocator')?.getService();
  const swapFrames = api.cls('core.GameObject')?.prototype.swapFrames;
  if (!Item || !MovieClip || !Factory || !textures || !swapFrames) return;
  const catalog = new ShipVisualCatalog(game.dataManager);
  const store = ShipVisualStateStore.forGame(game);
  const rows = new Set<Raw>();
  const signatures = new WeakMap<Raw, string>();
  const previewState = (player: Raw): Raw | null => {
    const state = player === read(game, 'me') ? store.local() : store.remote(player.id);
    if (!state) return null;
    const match = state.enabled ? catalog.resolve(state) : catalog.current(player);
    if (!match || !game.dataManager.loadKey('Images', String(match.visual.bitmap))) return null;
    return { visual: match.visual, originalColor: state.originalColor };
  };
  const update = (row: Raw, vanilla = false) => {
    if (row.g !== game || !row.player) return;
    let clip: Raw | null = null,
      index = -1;
    for (let child = 0; child < read(row, 'numChildren'); child++) {
      const candidate = row.getChildAt(child);
      if (candidate instanceof MovieClip) {
        clip = candidate;
        index = child;
        break;
      }
    }
    if (!clip) return;
    const selected = vanilla ? null : previewState(row.player);
    const visual = selected?.visual ?? catalog.current(row.player)?.visual;
    if (!visual) return;
    const fleet = row.player.getActiveFleetObj();
    if (!fleet) return;
    const signature = JSON.stringify([
      visual.bitmap,
      !!visual.blendModeAdd,
      !!selected?.originalColor,
      fleet.shipHue,
      fleet.shipBrightness,
      fleet.shipSaturation,
      fleet.shipContrast,
    ]);
    if (signatures.get(row) === signature) return;
    const frames = textures.getTexturesMainByKey(visual.bitmap);
    if (!frames?.length) return;
    swapFrames.call({}, clip, frames);
    clip.set_scaleX(1);
    clip.set_scaleY(1);
    clip.readjustSize();
    clip.set_pivotX(read(clip, 'width') / 2);
    clip.set_pivotY(read(clip, 'height') / 2);
    if (read(clip, 'width') > 40) {
      const scale = 40 / read(clip, 'width');
      clip.set_scaleX(scale);
      clip.set_scaleY(scale);
    }
    clip.set_x(40 + read(clip, 'width') / 2);
    clip.set_y(16);
    const oldFilter = read(clip, 'filter');
    clip.set_filter(null);
    oldFilter?.dispose();
    if (!selected?.originalColor && (fleet.shipHue || fleet.shipBrightness))
      clip.set_filter(Factory.createPlayerShipColorMatrixFilter(fleet));
    clip.set_blendMode(visual.blendModeAdd ? 'add' : 'normal');
    if (row.player.hasSupporter() && index + 1 < read(row, 'numChildren')) {
      const badge = row.getChildAt(index + 1);
      if (read(badge, 'y') === 8) badge.set_x(read(clip, 'x') + read(clip, 'width') / 2 + 5);
    }
    signatures.set(row, signature);
    rows.add(row);
  };
  api.after(Item, 'update', function () {
    update(this);
  });
  api.before(Item, 'dispose', function () {
    rows.delete(this);
    signatures.delete(this);
  });
  api.defer(
    store.onChange(() => {
      for (const row of rows) update(row);
    }),
  );
  const chat = game.chatInput;
  const previous = Object.getOwnPropertyDescriptor(chat, 'getSynchronizedPlayerPreviewState');
  chat.getSynchronizedPlayerPreviewState = previewState;
  api.defer(() => {
    for (const row of rows) update(row, true);
    rows.clear();
    if (previous) Object.defineProperty(chat, 'getSynchronizedPlayerPreviewState', previous);
    else delete chat.getSynchronizedPlayerPreviewState;
  });
}
