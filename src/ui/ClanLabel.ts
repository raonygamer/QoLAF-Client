import { read, type API, type Raw } from '../api/Types';
import { NativeUI } from './NativeUI';

/** PlayerShip's clan identification label, attached alongside the native name. */
export class ClanLabel {
  readonly node: Raw;
  private readonly name: Raw;
  private readonly role: Raw;
  private icon: Raw | null = null;
  private player: Raw | null = null;
  private playerId = '';
  private clanId = '';
  private lifecycle: unknown;
  private attempt = 0;
  private lookupStarted = 0;
  private lookupDelay = 0;
  private loaded = false;
  private disposed = false;

  constructor(
    private readonly ui: NativeUI,
    private readonly game: Raw,
    private readonly ship: Raw,
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
      this.game.isLeaving ||
      !read(this.game, 'me') ||
      player === read(this.game, 'me') ||
      !player.clanId
    ) {
      this.clear();
      return;
    }
    if (
      this.player !== player ||
      this.playerId !== player.id ||
      this.clanId !== player.clanId ||
      this.lifecycle !== this.ship.lifecycleId
    ) {
      this.clear();
      this.player = player;
      this.playerId = player.id;
      this.clanId = player.clanId;
      this.lifecycle = this.ship.lifecycleId;
    }
    const parent = read(this.ship.nameText, 'parent');
    if (read(this.node, 'parent') !== parent) {
      this.node.removeFromParent();
      parent?.addChild(this.node);
    }
    this.refresh();
    this.node.set_visible(
      this.loaded &&
        !!parent &&
        read(this.ship.nameText, 'visible') &&
        (this.ui.api.cls('core.scene.SceneBase')?.settings?.showPlayerClanIdentification ?? true),
    );
    this.layout();
  }

  private refresh(): void {
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
      this.ui
        .cls('data.DataLocator')
        .getService()
        .loadKeyFromBigDB('Clans', clanId, (clan: Raw) => {
          if (
            this.disposed ||
            !clan?.name ||
            this.game.isLeaving ||
            this.ship.player !== player ||
            player.id !== playerId ||
            player.clanId !== clanId ||
            this.ship.lifecycleId !== lifecycle ||
            this.attempt !== attempt
          )
            return;
          let texture: Raw | null = null;
          try {
            texture = this.ui.texture(clan.logo);
          } catch {
            /* Text survives a missing logo. */
          }
          this.icon?.removeFromParent(true);
          this.icon = texture ? this.ui.image(texture) : null;
          if (this.icon) {
            this.icon.set_scaleX(0.2);
            this.icon.set_scaleY(0.2);
            this.icon.set_color(clan.color >>> 0);
            this.icon.set_touchable(false);
            this.node.addChildAt(this.icon, 0);
          }
          this.name.set_text(String(clan.name));
          this.role.set_text(
            this.ui.cls('core.states.gameStates.ClanState').getMemberRankName(clan, playerId) ?? '',
          );
          this.name.get_format().set_color(clan.color >>> 0);
          this.role.get_format().set_color(clan.color >>> 0);
          this.name.set_batchable(true);
          this.role.set_batchable(true);
          this.loaded = true;
        });
    } catch {
      /* Failed DataManager lookups retry with the original bounded backoff. */
    }
  }

  private layout(): void {
    if (!read(this.node, 'visible') || !this.ship._mc) return;
    const roleHeight = read(this.role, 'text').length ? read(this.role, 'height') - 5 : 0;
    const iconWidth = this.icon ? read(this.icon, 'width') + 2 : 0;
    const height = Math.max(read(this.icon, 'height', 0), read(this.name, 'height') + roleHeight);
    const width = Math.max(read(this.name, 'width'), read(this.role, 'width'));
    if (this.icon) {
      this.icon.set_x(0);
      this.icon.set_y((height - read(this.icon, 'height')) * 0.5);
    }
    this.name.set_x(iconWidth);
    this.name.set_y(0);
    this.role.set_x(iconWidth);
    this.role.set_y(read(this.name, 'height') - 5);
    this.role.set_visible(read(this.role, 'text').length > 0);
    this.node.set_x(read(this.ship._mc, 'x') - (iconWidth + width) * 0.5);
    this.node.set_y(read(this.ship.nameText, 'y') - height);
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

export function installClanLabels(api: API, game: Raw): void {
  const prototype = api.cls('core.ship.PlayerShip')?.prototype;
  if (typeof prototype?.draw !== 'function') return;
  const ui = new NativeUI(api);
  const labels = new Map<Raw, ClanLabel>();
  api.after(prototype, 'draw', function () {
    if (this.g !== game) return;
    let label = labels.get(this);
    if (!label) {
      if (!this.player?.clanId || this.player === read(game, 'me')) return;
      label = new ClanLabel(ui, game, this);
      labels.set(this, label);
    }
    label.update();
  });
  if (typeof prototype.hideStats === 'function')
    api.after(prototype, 'hideStats', function () {
      labels.get(this)?.node.set_visible(false);
    });
  for (const method of ['removeFromCanvas', 'reset', 'destroy']) {
    if (typeof prototype[method] !== 'function') continue;
    api.after(prototype, method, function () {
      labels.get(this)?.dispose();
      labels.delete(this);
    });
  }
  api.defer(() => {
    for (const label of labels.values()) label.dispose();
    labels.clear();
  });
}
