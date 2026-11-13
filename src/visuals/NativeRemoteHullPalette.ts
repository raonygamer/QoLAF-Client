import { read, type API, type Raw } from '../api/Types';
import type { Resolve } from '../runtime/HaxeInterop';
import { ClientDevVisual } from './ClientDevVisual';
import { isClientDeveloper } from './ClientVisualAuthority';
import { ShipVisualStateStore } from './ShipVisualStateStore';
import { createClientDevVisualStyles } from './ClientDevVisualStyle';
import type { HullPalette } from './NativePhaseBlade';

interface OwnedPalette {
  clip: Raw;
  style: Raw;
  previousStyle: Raw;
  previousFilter: Raw | null;
  palette: HullPalette;
}

/** Remote settings never confer developer identity; authorization uses the native player ID. */
export function installNativeRemoteHullPalette(
  api: API,
  game: Raw,
  resolve: Resolve,
): (ship: Raw) => HullPalette | null {
  const store = ShipVisualStateStore.forGame(game);
  const owned = new Map<Raw, OwnedPalette>();
  const palettes = new WeakMap<Raw, HullPalette>();
  let styles: ReturnType<typeof createClientDevVisualStyles> | undefined;
  const paletteFor = (ship: Raw): HullPalette | null => {
    const player = ship?.player;
    if (
      !ship ||
      ship.g !== game ||
      ship === read(game, 'me')?.ship ||
      !player ||
      player.ship !== ship ||
      !isClientDeveloper(player.id) ||
      !ClientDevVisual.supportsTexture(ship.imgObj?.textureName)
    )
      return null;
    const state = store.remote(player.id);
    if (!state || state.devvis === 'default') return null;
    let palette = palettes.get(state);
    if (!palette) {
      palette = {
        mode: ClientDevVisual.MODES.indexOf(state.devvis),
        settings: state.devvisSettings,
      };
      palettes.set(state, palette);
    }
    return palette;
  };
  const release = (ship: Raw) => {
    const previous = owned.get(ship);
    if (!previous) return;
    if (read(previous.clip, 'style') === previous.style)
      previous.clip.setStyle(previous.previousStyle);
    if (read(previous.clip, 'filter') == null) previous.clip.set_filter(previous.previousFilter);
    owned.delete(ship);
  };
  const prototype = api.cls('core.ship.PlayerShip')?.prototype;
  if (prototype) {
    api.after(prototype, 'draw', function () {
      if (this.g !== game || this === read(game, 'me')?.ship) return;
      const palette = paletteFor(this),
        clip = read(this, 'movieClip');
      if (!palette || !clip || !this.alive || read(game, 'isLeaving')) {
        release(this);
        return;
      }
      const previous = owned.get(this);
      if (!previous || previous.clip !== clip || previous.palette !== palette) {
        release(this);
        styles ??= createClientDevVisualStyles(resolve);
        const style = new styles.ClientDevVisualStyle(palette.mode, palette.settings);
        owned.set(this, {
          clip,
          style,
          palette,
          previousStyle: read(clip, 'style'),
          previousFilter: read(clip, 'filter', null),
        });
        clip.setStyle(style);
        clip.set_filter(null);
      }
      clip.setRequiresRedraw();
    });
    for (const method of ['reset', 'destroy', 'switchTexturesByObj'])
      api.before(prototype, method, function () {
        release(this);
      });
  }
  api.defer(() => {
    for (const ship of owned.keys()) release(ship);
  });
  return paletteFor;
}
