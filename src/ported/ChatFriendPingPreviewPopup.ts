import type { Raw } from '../api/Types';
import type { Resolve } from '../runtime/As3';
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
export function createChatFriendPingPreviewPopup(resolve: Resolve): any {
  const Sprite = resolve('starling.display.Sprite');
  const Quad = resolve('starling.display.Quad');
  const Image = resolve('starling.display.Image');
  const TextField = resolve('starling.text.TextField');
  const TextFormat = resolve('starling.text.TextFormat');
  const Fonts = resolve('core.text.VerdanaBitmapFontRegistry');
  const ShipFactory = resolve('core.ship.ShipFactory');
  return class ChatFriendPingPreviewPopup extends Sprite {
    private preview: Raw | null = null;
    private previewTexture: Raw | null = null;
    private paintFilter: Raw | null = null;
    private currentData: ChatFriendPingData | null = null;
    private nameField: Raw;
    private idField: Raw;
    private detailsField: Raw;
    private locationField: Raw;

    constructor() {
      super();
      this.touchable = false;
      const background = new Quad(276, 82, 0x121212);
      background.alpha = 0.96;
      this.addChild(background);
      for (const [x, y, width, height] of [
        [0, 0, 276, 1],
        [0, 81, 276, 1],
        [0, 0, 1, 82],
        [275, 0, 1, 82],
      ]) {
        const border = new Quad(width, height, ChatFriendPingFormatter.PING_COLOR);
        Object.assign(border, { x, y, alpha: 0.8, touchable: false });
        this.addChild(border);
      }
      this.nameField = this.field(14, 0xffffff, 22, 3);
      this.idField = this.field(10, ChatFriendPingFormatter.PING_COLOR, 15, 24);
      this.detailsField = this.field(10, 0xc8c8c8, 15, 41);
      this.locationField = this.field(10, 0x999999, 15, 58);
      this.visible = false;
    }

    showFor(
      data: ChatFriendPingData | null,
      texture: Raw | null,
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
      this.x = Math.max(0, Math.min(Math.max(0, availableWidth - 276), x));
      this.y = Math.max(0, Math.min(Math.max(0, availableHeight - 82), y));
      this.visible = true;
    }

    close(): void {
      this.visible = false;
    }

    refreshData(data: ChatFriendPingData | null): void {
      if (!data) return;
      this.currentData = data;
      this.nameField.text = data.name || 'Unknown player';
      this.idField.text = data.playerId ? 'ID: ' + data.playerId : 'Player ID unavailable';
      const details = [];
      if (data.level > 0) details.push('Level ' + data.level);
      if (data.clanName) details.push(data.clanName);
      this.detailsField.text = details.length ? details.join('  •  ') : 'Player';
      const location = [];
      if (data.solarSystem) location.push('In ' + data.solarSystem);
      const type = displayPingSystemType(data.systemType);
      if (type) location.push(type);
      this.locationField.text = location.join('  •  ');
    }

    private field(size: number, color: number, height: number, y: number): Raw {
      const field = new TextField(
        196,
        height,
        '',
        new TextFormat(Fonts.fontNameForSize(size), size, color, 'left'),
      );
      Object.assign(field, { x: 72, y, touchable: false });
      this.addChild(field);
      return field;
    }

    private updatePreview(texture: Raw | null, data: ChatFriendPingData): void {
      this.clearPaintFilter();
      if (!texture) {
        if (this.preview) this.preview.visible = false;
        this.previewTexture = null;
        return;
      }
      if (!this.preview) {
        this.preview = new Image(texture);
        this.preview!.touchable = false;
        this.addChildAt(this.preview, 5);
      } else if (this.previewTexture !== texture) {
        this.preview.texture = texture;
        this.preview.readjustSize();
      }
      this.previewTexture = texture;
      const preview = this.preview!;
      preview.scaleX = preview.scaleY = 1;
      preview.scaleX = preview.scaleY = Math.min(56 / preview.width, 56 / preview.height, 1);
      preview.x = 8 + Math.round((56 - preview.width) / 2);
      preview.y = Math.round((82 - preview.height) / 2);
      if (data.shipHue || data.shipBrightness || data.shipSaturation || data.shipContrast) {
        this.paintFilter = ShipFactory.createPlayerShipColorMatrixFilter({
          shipHue: data.shipHue,
          shipBrightness: data.shipBrightness,
          shipSaturation: data.shipSaturation,
          shipContrast: data.shipContrast,
        });
        if (this.paintFilter) preview.filter = this.paintFilter;
      }
      preview.visible = true;
    }

    private clearPaintFilter(): void {
      if (this.preview) this.preview.filter = null;
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
