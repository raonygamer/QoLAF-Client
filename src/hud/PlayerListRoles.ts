import { killOnSightMarker } from '../ship/KillOnSightLabels';
import type { API } from '../api/Types';
import { PlayerListItem, TextBitmap, type GameScene } from '../game/Bindings';
import type { Resolve } from '../runtime/HaxeInterop';
import type { createChatRoleTags } from '../ported/ChatRoleTags';
import type { createClientDeveloperTagColor } from '../ported/ClientDeveloperTagColor';
import { isClientDeveloper } from '../visuals/ClientVisualAuthority';

/** Original role labels share the native level row, leaving game staff labels intact. */
export function installPlayerListRoles(api: API, game: GameScene, resolve: Resolve): void {
  const roles = resolve('core.hud.components.chat.ChatRoleTags') as ReturnType<
    typeof createChatRoleTags
  >;
  const colors = resolve('core.hud.components.ClientDeveloperTagColor') as ReturnType<
    typeof createClientDeveloperTagColor
  >;
  const rows = new Map<
    PlayerListItem,
    { level: TextBitmap; x: number; labels: TextBitmap[]; animated?: TextBitmap; color: number }
  >();
  const clear = (row: PlayerListItem) => {
    const owned = rows.get(row);
    if (!owned) return;
    rows.delete(row);
    if (owned.level.get_parent() === row) owned.level.set_x(owned.x);
    for (const label of owned.labels) if (label.get_parent()) label.removeFromParent(true);
  };
  api.after(PlayerListItem.prototype, 'update', function () {
    if (this.g !== game || !this.player) return;
    // Native update only refreshes buttons; its constructor builds the labels.
    // Keep composed glyphs while that same level field is still attached.
    if (rows.get(this)?.level.get_parent() === this) return;
    clear(this);
    const player = this.player;
    const developer = !player.isDeveloper && !player.isModerator && isClientDeveloper(player.id);
    const role = roles.forPlayer(player.id);
    const marker = killOnSightMarker(player.id);
    if (!developer && !role && !marker) return;
    // Native construction creates the level at the troons column (280, 26).
    let level: TextBitmap | undefined;
    for (let index = 0; index < this.get_numChildren(); index++) {
      const child = this.getChildAt(index);
      if (child instanceof TextBitmap && child.get_x() === 280 && child.get_y() === 26) {
        level = child;
        break;
      }
    }
    if (!level) return;
    const owned: {
      level: TextBitmap;
      x: number;
      labels: TextBitmap[];
      animated?: TextBitmap;
      color: number;
    } = {
      level,
      x: level.get_x(),
      labels: [],
      color: colors.currentColor,
    };
    rows.set(this, owned);
    const add = (text: string, color: number) => {
      const label = new TextBitmap(level.get_x(), level.get_y(), text, level.get_size());
      label.set_touchable(false);
      level.set_x(level.get_x() + label.get_textBounds().width + 6);
      label.get_style().set_color(color);
      this.addChild(label);
      owned.labels.push(label);
      return label;
    };
    if (developer) owned.animated = add('client dev', owned.color);
    if (role) add(role.label, role.color);
    if (marker) add(marker.text.trim(), marker.color);
  });
  api.before(PlayerListItem.prototype, 'dispose', function () {
    clear(this);
  });
  api.on('frame', ({ game: current }) => {
    if (current !== game) return;
    const color = colors.currentColor;
    for (const owned of rows.values()) {
      if (!owned.animated || owned.color === color) continue;
      owned.animated.get_style().set_color(color);
      owned.color = color;
    }
  });
  api.defer(() => {
    for (const row of rows.keys()) clear(row);
  });
}
