import {
  Sprite,
  Quad,
  Image,
  StarlingTextField,
  TextFormat,
  ShipFactory,
  type Texture,
  type FragmentFilter,
} from '../game/Bindings';
import { VerdanaBitmapFontRegistry } from '../ui/VerdanaBitmapFontRegistry';
import type { Resolve } from '../runtime/HaxeInterop';
import type { ChatFriendPingData } from '../chat/ChatFriendPingData';
import { ChatFriendPingFormatter } from '../chat/ChatFriendPingFormatter';

export function displayPingSystemType(value: string): string {
  switch (value?.trim().toLowerCase()) {
    case 'friendly':
      return 'Friendly';
    case 'hostile':
      return 'Hostile';
    case 'clan':
      return 'Clan Instance';
    case 'survival':
      return 'Survival';
    case 'domination':
      return 'Domination';
    case 'deathmatch':
      return 'Deathmatch';
    case 'arena':
      return 'Arena';
    default:
      return '';
  }
}

/** Source ChatFriendPingPreviewPopup geometry, labels and shared ship preview. */
export function createChatFriendPingPreviewPopup(_resolve: Resolve) {
  return class ChatFriendPingPreviewPopup extends Sprite {
    private preview: Image | null = null;
    private previewTexture: Texture | null = null;
    private paintFilter: FragmentFilter | null = null;
    private currentData: ChatFriendPingData | null = null;
    private nameField: StarlingTextField;
    private idField: StarlingTextField;
    private detailsField: StarlingTextField;
    private locationField: StarlingTextField;

    constructor() {
      super();
      this.set_touchable(false);
      const background = new Quad(276, 82, 0x121212);
      background.set_alpha(0.96);
      this.addChild(background);
      for (const [x, y, width, height] of [
        [0, 0, 276, 1],
        [0, 81, 276, 1],
        [0, 0, 1, 82],
        [275, 0, 1, 82],
      ]) {
        const border = new Quad(width, height, ChatFriendPingFormatter.PING_COLOR);
        border.set_x(x);
        border.set_y(y);
        border.set_alpha(0.8);
        border.set_touchable(false);
        this.addChild(border);
      }
      this.nameField = this.field(14, 0xffffff, 22, 3);
      this.idField = this.field(10, ChatFriendPingFormatter.PING_COLOR, 15, 24);
      this.detailsField = this.field(10, 0xc8c8c8, 15, 41);
      this.locationField = this.field(10, 0x999999, 15, 58);
      this.set_visible(false);
    }

    showFor(
      data: ChatFriendPingData | null,
      texture: Texture | null,
      preferredX: number,
      preferredY: number,
      availableWidth: number,
      availableHeight: number,
    ): void {
      if (!data) {
        this.close();
        return;
      }
      if (this.currentData !== data || this.previewTexture !== texture)
        this.updatePreview(texture, data);
      this.refreshData(data);
      let x = preferredX + 12,
        y = preferredY + 12;
      if (x + 276 > availableWidth) x = preferredX - 276 - 12;
      if (y + 82 > availableHeight) y = preferredY - 82 - 12;
      this.set_x(Math.max(0, Math.min(Math.max(0, availableWidth - 276), x)));
      this.set_y(Math.max(0, Math.min(Math.max(0, availableHeight - 82), y)));
      this.set_visible(true);
    }

    close(): void {
      this.set_visible(false);
    }

    refreshData(data: ChatFriendPingData | null): void {
      if (!data) return;
      this.currentData = data;
      this.nameField.set_text(data.name || 'Unknown player');
      this.idField.set_text(data.playerId ? 'ID: ' + data.playerId : 'Player ID unavailable');
      const details = [];
      if (data.level > 0) details.push('Level ' + data.level);
      if (data.clanName) details.push(data.clanName);
      this.detailsField.set_text(details.length ? details.join('  •  ') : 'Player');
      const location = [];
      if (data.solarSystem) location.push('In ' + data.solarSystem);
      const type = displayPingSystemType(data.systemType);
      if (type) location.push(type);
      this.locationField.set_text(location.join('  •  '));
    }

    private field(size: number, color: number, height: number, y: number): StarlingTextField {
      const field = new StarlingTextField(
        196,
        height,
        '',
        new TextFormat(VerdanaBitmapFontRegistry.fontNameForSize(size), size, color, 'left'),
      );
      field.set_x(72);
      field.set_y(y);
      field.set_touchable(false);
      this.addChild(field);
      return field;
    }

    private updatePreview(texture: Texture | null, data: ChatFriendPingData): void {
      this.clearPaintFilter();
      if (!texture) {
        if (this.preview) this.preview.set_visible(false);
        this.previewTexture = null;
        return;
      }
      if (!this.preview) {
        this.preview = new Image(texture);
        this.preview.set_touchable(false);
        this.addChildAt(this.preview, 5);
      } else if (this.previewTexture !== texture) {
        this.preview.set_texture(texture);
        this.preview.readjustSize();
      }
      this.previewTexture = texture;
      const preview = this.preview;
      preview.set_scaleX(1);
      preview.set_scaleY(1);
      const scale = Math.min(56 / preview.get_width(), 56 / preview.get_height(), 1);
      preview.set_scaleX(scale);
      preview.set_scaleY(scale);
      preview.set_x(8 + Math.round((56 - preview.get_width()) / 2));
      preview.set_y(Math.round((82 - preview.get_height()) / 2));
      if (data.shipHue || data.shipBrightness || data.shipSaturation || data.shipContrast) {
        this.paintFilter = ShipFactory.createPlayerShipColorMatrixFilter({
          shipHue: data.shipHue,
          shipBrightness: data.shipBrightness,
          shipSaturation: data.shipSaturation,
          shipContrast: data.shipContrast,
        });
        if (this.paintFilter) preview.set_filter(this.paintFilter);
      }
      preview.set_visible(true);
    }

    private clearPaintFilter(): void {
      if (this.preview) this.preview.set_filter(null);
      this.paintFilter?.dispose();
      this.paintFilter = null;
    }

    dispose(): void {
      this.clearPaintFilter();
      this.currentData = null;
      this.previewTexture = null;
      super.dispose();
    }
  };
}
