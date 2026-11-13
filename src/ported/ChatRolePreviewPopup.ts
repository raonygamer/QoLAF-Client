// Source port of core/hud/components/chat/ChatRolePreviewPopup.as.
import type { Resolve } from '../runtime/HaxeInterop';

export function createChatRolePreviewPopup(resolve: Resolve): any {
  const Sprite = resolve('starling.display.Sprite');
  const Quad = resolve('starling.display.Quad');
  const TextField = resolve('starling.text.TextField');
  const TextFormat = resolve('starling.text.TextFormat');
  const Fonts = resolve('core.text.VerdanaBitmapFontRegistry');
  const Roles = resolve('core.hud.components.chat.ChatRoleTags');

  return class ChatRolePreviewPopup extends Sprite {
    private titleField: any;
    private explanationField: any;
    private currentRole: string | null = null;

    constructor() {
      super();
      this.touchable = false;
      const border = new Quad(280, 70, 0x666666);
      border.alpha = 0.9;
      this.addChild(border);
      const background = new Quad(278, 68, 0x121212);
      background.x = background.y = 1;
      background.alpha = 0.97;
      this.addChild(background);
      this.titleField = this.field(12, 0xffffff, 6, 20);
      this.explanationField = this.field(11, 0xcccccc, 29, 35);
      this.visible = false;
    }

    showFor(
      role: string | null,
      preferredX: number,
      preferredY: number,
      availableWidth: number,
      availableHeight: number,
    ): void {
      const explanation = Roles.explanation(role);
      if (explanation == null || availableWidth <= 0 || availableHeight <= 0) {
        this.close();
        return;
      }
      if (this.currentRole !== role) {
        this.currentRole = role;
        this.titleField.text = '[' + role + ']';
        this.explanationField.text = explanation;
      }
      this.scaleX = this.scaleY = Math.min(1, availableWidth / 280, availableHeight / 70);
      const width = 280 * this.scaleX;
      const height = 70 * this.scaleY;
      let x = preferredX + 12;
      let y = preferredY + 12;
      if (x + width > availableWidth) x = preferredX - width - 12;
      if (y + height > availableHeight) y = preferredY - height - 12;
      this.x = Math.max(0, Math.min(availableWidth - width, x));
      this.y = Math.max(0, Math.min(availableHeight - height, y));
      this.visible = true;
    }

    close(): void {
      this.visible = false;
    }

    private field(size: number, color: number, top: number, height: number): any {
      const field = new TextField(
        262,
        height,
        '',
        new TextFormat(Fonts.fontNameForSize(size), size, color, 'left', 'top'),
      );
      field.x = 9;
      field.y = top;
      field.touchable = false;
      this.addChild(field);
      return field;
    }
  };
}
