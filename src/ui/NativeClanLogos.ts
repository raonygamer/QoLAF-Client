import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import {
  ClanClient,
  Image,
  PlayerClanLogo,
  Sprite,
  TextureLocator,
  ToolTip,
} from '../game/Bindings';
import type { Texture } from '../game/Bindings';
import type {} from '../game/ClanIdentity';

interface LogoState {
  disposed: boolean;
  tooltip: ToolTip | null;
  icon: Image | null;
  request: number;
}

/** Cache clan identity, but give each list ownership of its display objects. */
export function installNativeClanLogos(api: API): void {
  const reflection = new GameReflection(api);
  const states = new WeakMap<PlayerClanLogo, LogoState>();
  const live = new Set<LogoState>();
  let active = true;
  const clear = (state: LogoState) => {
    // Native group cleanup may already have disposed this tooltip. Its dispose
    // method is not idempotent once the target listener owner has been cleared.
    if (state.tooltip?.target) state.tooltip.dispose();
    state.tooltip = null;
    state.icon?.removeFromParent(true);
    state.icon = null;
  };
  const show = (view: PlayerClanLogo, state: LogoState) => {
    clear(state);
    const player = view.player;
    const texture = player.clanLogo?.get_texture();
    if (texture) {
      const icon = new Image(texture);
      icon.set_scaleX(0.25);
      icon.set_scaleY(0.25);
      icon.set_color(player.clanLogoColor);
      view.addChild(icon);
      state.icon = icon;
    }
    state.tooltip = new ToolTip(view.g, view, player.clanName, null, 'clan');
    view.callback?.();
  };
  reflection.around(PlayerClanLogo.prototype, 'init', function () {
    this.removeEventListener('addedToStage', reflection.bound(this, this.init));
    let state = states.get(this);
    if (!state) {
      state = { disposed: false, tooltip: null, icon: null, request: 0 };
      states.set(this, state);
      live.add(state);
    }
    if (state.disposed || !this.player?.clanId) {
      this.callback?.(false);
      return;
    }
    const player = this.player;
    const playerId = player.id;
    const clanId = player.clanId;
    if (
      player.clanIdentityPlayerId === playerId &&
      player.clanIdentityClanId === clanId &&
      player.clanName &&
      player.clanRankName != null
    ) {
      show(this, state);
      return;
    }
    const owned = state;
    const request = ++owned.request;
    ClanClient.brief(this.g, clanId, playerId, (clan) => {
      if (
        !active ||
        owned.disposed ||
        request !== owned.request ||
        !this.get_stage() ||
        this.g.get_isLeaving() ||
        this.player !== player ||
        player.id !== playerId ||
        player.clanId !== clanId
      )
        return;
      if (!clan?.name) {
        this.callback?.(false);
        return;
      }
      let texture: Texture | null = null;
      try {
        texture = TextureLocator.getService().getTextureGUIByTextureName(clan.logo);
      } catch {
        // A missing atlas entry must not discard the clan's text identity.
      }
      player.clanName = clan.name;
      player.clanRankName = clan.rankName ?? '';
      player.clanLogoColor = clan.color >>> 0;
      player.clanLogo?.dispose();
      player.clanLogo = texture ? new Image(texture) : null;
      if (player.clanLogo) {
        player.clanLogo.set_scaleX(0.25);
        player.clanLogo.set_scaleY(0.25);
        player.clanLogo.set_color(player.clanLogoColor);
        player.clanLogo.set_touchable(false);
      }
      player.clanIdentityPlayerId = playerId;
      player.clanIdentityClanId = clanId;
      show(this, owned);
    });
  });
  reflection.around(PlayerClanLogo.prototype, 'dispose', function (next) {
    const state = states.get(this);
    if (!state) return next();
    if (state.disposed) return;
    state.disposed = true;
    live.delete(state);
    clear(state);
    this.callback = null;
    // Native disposal deletes every clan tooltip, including other open lists.
    Sprite.prototype.dispose.call(this);
  });
  api.defer(() => {
    active = false;
    for (const state of live) clear(state);
    live.clear();
  });
}
