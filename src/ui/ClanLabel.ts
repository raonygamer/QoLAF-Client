import { ClientErrorDiagnostics } from '../diagnostics/ClientErrorDiagnostics';
import type { ClanBrief } from '../game/ClanIdentity';
import type { RenderedGameObject } from '../game/RenderedGameObject';
import { GameReflection } from '../api/GameReflection';
import type {
  GameScene,
  Player,
  PlayerShip,
  Sprite,
  TextBitmap,
  Image,
  Texture,
} from '../game/Bindings';
import { type API } from '../api/Types';
import { NativeUI } from './NativeUI';

/** PlayerShip's clan identification label, attached alongside the native name. */
export class ClanLabel {
  readonly node: Sprite;
  private readonly name: TextBitmap;
  private readonly role: TextBitmap;
  private icon: Image | null = null;
  private player: Player | null = null;
  private playerId = '';
  private clanId = '';
  private lifecycle: number | undefined;
  private attempt = 0;
  private lookupStarted = 0;
  private lookupDelay = 0;
  private loaded = false;
  private disposed = false;

  constructor(
    private readonly ui: NativeUI,
    private readonly game: GameScene,
    private readonly ship: PlayerShip & RenderedGameObject,
    private readonly now: () => number = () => performance.now(),
  ) {
    this.node = ui.sprite();
    this.node.set_touchable(false);
    this.node.set_visible(false);
    const TextBitmap = ui.cls('core.hud.components.TextBitmap');
    this.name = new TextBitmap(0, 0, '', 13);
    this.role = new TextBitmap(0, 0, '', 11);
    for (const text of [this.name, this.role]) {
      text.get_format().set_font('DAIDRR_COMBAT');
      text.set_alpha(1);
      text.get_format().set_horizontalAlign('left');
      text.set_batchable(true);
      text.set_blendMode('normal');
      this.node.addChild(text);
    }
  }

  update(): void {
    if (this.disposed) return;
    const player = this.ship.player;
    if (
      !player ||
      this.game.get_isLeaving() ||
      !this.game.get_me() ||
      player === this.game.get_me() ||
      !player.clanId
    ) {
      this.clear();
      return;
    }
    if (
      this.player !== player ||
      this.playerId !== player.id ||
      this.clanId !== player.clanId ||
      this.lifecycle !== this.ship.get_lifecycleId?.()
    ) {
      this.clear();
      this.player = player;
      this.playerId = player.id;
      this.clanId = player.clanId;
      this.lifecycle = this.ship.get_lifecycleId?.();
    }
    const parent = this.ship.nameText.get_parent();
    if (this.node.get_parent() !== parent) {
      this.node.removeFromParent();
      parent?.addChild(this.node);
    }
    this.refresh();
    this.updateVisibility();
    this.layout();
  }

  private refresh(): void {
    const cached = this.player;
    if (
      cached?.clanIdentityPlayerId === cached?.id &&
      cached?.clanIdentityClanId === cached?.clanId &&
      cached?.clanName &&
      cached.clanRankName != null
    ) {
      if (
        !this.loaded ||
        this.name.get_text() !== cached.clanName ||
        this.role.get_text() !== cached.clanRankName ||
        this.name.get_format().get_color() !== cached.clanLogoColor
      ) {
        this.apply(
          cached.clanLogo?.get_texture() ?? null,
          cached.clanName,
          cached.clanRankName,
          cached.clanLogoColor,
        );
      }
      return;
    }
    if (this.loaded || (this.lookupDelay > 0 && this.now() - this.lookupStarted < this.lookupDelay))
      return;
    this.lookupStarted = this.now();
    this.lookupDelay = this.lookupDelay === 0 ? 10000 : Math.min(60000, this.lookupDelay * 2);
    const player = this.player!;
    const playerId = this.playerId;
    const clanId = this.clanId;
    const lifecycle = this.lifecycle;
    const attempt = ++this.attempt;
    try {
      this.ui.cls('core.clan.ClanClient').brief(
        this.game,
        clanId,
        playerId,
        (clan: ClanBrief | null) => {
          try {
            if (
              this.disposed ||
              !clan?.name ||
              this.game.get_isLeaving() ||
              this.ship.player !== player ||
              player.id !== playerId ||
              player.clanId !== clanId ||
              this.ship.get_lifecycleId?.() !== lifecycle ||
              this.attempt !== attempt
            )
              return;
            let texture: Texture | null = null;
            try {
              texture = this.ui.texture(clan.logo);
            } catch {
              /* Text survives a missing logo. */
            }
            player.clanName = String(clan.name);
            player.clanRankName = clan.rankName ?? '';
            player.clanLogoColor = clan.color >>> 0;
            player.clanLogo?.dispose();
            player.clanLogo = texture ? this.ui.image(texture) : null;
            if (player.clanLogo) {
              player.clanLogo.set_scaleX(0.25);
              player.clanLogo.set_scaleY(0.25);
              player.clanLogo.set_color(player.clanLogoColor);
              player.clanLogo.set_touchable(false);
            }
            player.clanIdentityPlayerId = playerId;
            player.clanIdentityClanId = clanId;
            this.apply(texture, player.clanName, player.clanRankName, player.clanLogoColor);
          } catch (error) {
            ClientErrorDiagnostics.record(error, 'Clan label rendering');
            this.ui.api.log('Clan label update failed', error);
          }
        },
      );
    } catch (error) {
      ClientErrorDiagnostics.record(error, 'Clan label lookup');
      // Failed lookups retry with the original bounded backoff.
    }
  }

  private apply(texture: Texture | null, name: string, rank: string, color: number): void {
    this.icon?.removeFromParent(true);
    this.icon = texture ? this.ui.image(texture) : null;
    if (this.icon) {
      this.icon.set_scaleX(0.2);
      this.icon.set_scaleY(0.2);
      this.icon.set_color(color);
      this.icon.set_touchable(false);
      this.node.addChildAt(this.icon, 0);
    }
    this.name.set_text(name);
    this.role.set_text(rank);
    this.name.get_format().set_color(color);
    this.role.get_format().set_color(color);
    this.loaded = true;
    this.updateVisibility();
    this.layout();
  }

  private updateVisibility(): void {
    const parent = this.ship.nameText.get_parent();
    this.node.set_visible(
      this.loaded &&
        this.name.get_text().length > 0 &&
        !!parent &&
        this.node.get_parent() === parent &&
        this.ship.nameText.get_visible() &&
        this.player === this.ship.player &&
        this.playerId === this.player?.id &&
        this.clanId === this.player?.clanId &&
        (this.ui.cls('core.scene.SceneBase').settings?.showPlayerClanIdentification ?? true),
    );
  }

  private layout(): void {
    if (!this.node.get_visible() || !this.ship._mc) return;
    const roleHeight = this.role.get_text().length ? this.role.get_height() - 5 : 0;
    const iconWidth = this.icon ? this.icon.get_width() + 2 : 0;
    const height = Math.max(this.icon?.get_height() ?? 0, this.name.get_height() + roleHeight);
    const width = Math.max(this.name.get_width(), this.role.get_width());
    if (this.icon) {
      this.icon.set_x(0);
      this.icon.set_y((height - this.icon.get_height()) * 0.5);
    }
    this.name.set_x(iconWidth);
    this.name.set_y(0);
    this.role.set_x(iconWidth);
    this.role.set_y(this.name.get_height() - 5);
    this.role.set_visible(this.role.get_text().length > 0);
    this.node.set_x(this.ship._mc.get_x() - (iconWidth + width) * 0.5);
    this.node.set_y(this.ship.nameText.get_y() - height);
  }

  private clear(): void {
    this.attempt++;
    this.player = null;
    this.playerId = this.clanId = '';
    this.loaded = false;
    this.lookupStarted = this.lookupDelay = 0;
    this.node.set_visible(false);
    this.name.set_text('');
    this.role.set_text('');
    this.icon?.removeFromParent(true);
    this.icon = null;
  }

  dispose(): void {
    this.disposed = true;
    this.attempt++;
    this.ui.dispose(this.node);
  }
}

export function installClanLabels(api: API, game: GameScene): void {
  const reflection = new GameReflection(api);
  const prototype = reflection.require('core.ship.PlayerShip').prototype;
  const ui = new NativeUI(api);
  const labels = new Map<PlayerShip, ClanLabel>();
  reflection.after(prototype, 'draw', function () {
    if (this.g !== game) return;
    let label = labels.get(this);
    if (!label) {
      if (!this.player?.clanId || this.player === game.get_me()) return;
      label = new ClanLabel(ui, game, this);
      labels.set(this, label);
    }
    label.update();
  });
  reflection.after(prototype, 'hideStats', function () {
    labels.get(this)?.node.set_visible(false);
  });
  for (const method of ['removeFromCanvas', 'reset', 'destroy'] as const) {
    reflection.after(prototype, method, function () {
      labels.get(this)?.dispose();
      labels.delete(this);
    });
  }
  api.defer(() => {
    for (const label of labels.values()) label.dispose();
    labels.clear();
  });
}
