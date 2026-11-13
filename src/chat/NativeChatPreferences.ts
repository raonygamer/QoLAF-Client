import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { DomOverlay, NativeTextFormat, type GameScene } from '../game/Bindings';
import type { DeviceSettings } from '../settings/DeviceSettings';
import { ChatLayout } from './ChatLayout';

/** Apply legacy composer preferences to the current game's native TextEntry. */
export function installNativeChatPreferences(
  api: API,
  game: GameScene,
  preferences?: DeviceSettings,
): void {
  const chat = game.chatInput;
  const input = chat?.input;
  if (!preferences || !chat || !input) return;
  const reflection = new GameReflection(api);
  const originalFormat = input.textFormat;
  const originalWidth = input.get_width();
  const originalX = chat.get_x();
  const originalY = chat.get_y();
  const originalTabsWidth = chat.tabs.get_width();
  const element = input.element;
  const originalFontSize = element?.style.fontSize;
  const originalFontFamily = element?.style.fontFamily;
  const cssFontSize = () => {
    if (!element) return;
    const overlay = DomOverlay;
    // Use the same logical-to-CSS transform as native placement, including DPI,
    // browser zoom and a CSS-scaled canvas.
    const scale = overlay?.toCss({ x: 0, y: 0, width: 1, height: 1 }).height ?? 1;
    element.style.fontSize = `${preferences.get('legacyChatFontSize') * scale}px`;
    // A missing Verdana face otherwise falls through to the browser's default
    // serif. The full bitmap composer will replace this native input adapter.
    element.style.fontFamily = 'Verdana, Arial, sans-serif';
  };
  const layout = () => {
    const stage = game.get_stage();
    if (!stage) return;
    if (preferences.get('enableNewChatIntegrationSystem') && game.messageLog) {
      const view = ChatLayout.fit(stage.get_stageWidth(), stage.get_stageHeight());
      input.set_width(view.width);
      chat.tabs.set_width(Math.max(1, view.width - 8));
      chat.set_x(Math.max(0, Math.min(view.x, stage.get_stageWidth() - view.width - 10)));
      chat.set_y(Math.max(0, Math.min(view.y + 20 + view.height, stage.get_stageHeight() - 81)));
      cssFontSize();
      return;
    }
    const width = Math.max(1, Math.min(originalWidth, stage.get_stageWidth() - 20));
    input.set_width(width);
    chat.tabs.set_width(width);
    chat.set_x(
      Math.max(
        0,
        Math.min(stage.get_stageWidth() / 2 - width / 2, stage.get_stageWidth() - width - 10),
      ),
    );
    chat.set_y(
      Math.max(
        0,
        Math.min(
          stage.get_stageHeight() - 100,
          stage.get_stageHeight() - input.get_y() - input.get_height() - 10,
        ),
      ),
    );
    cssFontSize();
  };
  const apply = () => {
    input.set_textFormat(
      new NativeTextFormat('Verdana', preferences.get('legacyChatFontSize'), 0xffffff),
    );
    layout();
  };
  api.defer(() => {
    input.set_textFormat(originalFormat);
    input.set_width(originalWidth);
    chat.tabs.set_width(originalTabsWidth);
    chat.set_x(originalX);
    chat.set_y(originalY);
    if (element && originalFontSize !== undefined) element.style.fontSize = originalFontSize;
    if (element && originalFontFamily !== undefined) element.style.fontFamily = originalFontFamily;
  });
  api.defer(
    preferences.subscribe((key) => {
      if (
        key === 'legacyChatFontSize' ||
        key === 'dpiScale' ||
        key === 'enableNewChatIntegrationSystem'
      )
        apply();
    }),
  );
  if (typeof input.updatePlacement === 'function')
    reflection.after(input, 'updatePlacement', cssFontSize);
  if (typeof chat.toggleChatMode === 'function') reflection.after(chat, 'toggleChatMode', apply);
  // Game.resize may be a cached callback; stage events preserve native listener order.
  const stage = game.get_stage();
  if (stage?.addEventListener) {
    stage.addEventListener('resize', layout);
    api.defer(() => stage.removeEventListener('resize', layout));
  }
  apply();
}
