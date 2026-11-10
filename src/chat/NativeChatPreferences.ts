import { read, type API, type Raw } from '../api/Types';
import type { DeviceSettings } from '../settings/DeviceSettings';

/** Apply legacy composer preferences to the current game's native TextEntry. */
export function installNativeChatPreferences(
  api: API,
  game: Raw,
  preferences?: DeviceSettings,
): void {
  const chat = game.chatInput;
  const input = chat?.input;
  const TextFormat = api.cls('openfl.text.TextFormat') as any;
  if (!preferences || !input?.set_textFormat || !TextFormat) return;
  const originalFormat = input.textFormat;
  const originalWidth = read(input, 'width');
  const originalX = read(chat, 'x');
  const originalY = read(chat, 'y');
  const originalTabsWidth = read(chat.tabs, 'width');
  const element = input.element;
  const originalFontSize = element?.style.fontSize;
  const originalFontFamily = element?.style.fontFamily;
  const cssFontSize = () => {
    if (!element) return;
    const overlay = api.cls('core.hud.components.ui.DomOverlay');
    // Use the same logical-to-CSS transform as native placement, including DPI,
    // browser zoom and a CSS-scaled canvas.
    const scale = overlay?.toCss({ x: 0, y: 0, width: 1, height: 1 }).height ?? 1;
    element.style.fontSize = `${preferences.get('legacyChatFontSize') * scale}px`;
    // A missing Verdana face otherwise falls through to the browser's default
    // serif. The full bitmap composer will replace this native input adapter.
    element.style.fontFamily = 'Verdana, Arial, sans-serif';
  };
  const layout = () => {
    const stage = read(game, 'stage');
    if (!stage) return;
    const width = Math.max(1, Math.min(originalWidth, read(stage, 'stageWidth') - 20));
    input.set_width(width);
    chat.tabs.set_width(width);
    chat.set_x(
      Math.max(
        0,
        Math.min(read(stage, 'stageWidth') / 2 - width / 2, read(stage, 'stageWidth') - width - 10),
      ),
    );
    chat.set_y(
      Math.max(
        0,
        Math.min(
          read(stage, 'stageHeight') - 100,
          read(stage, 'stageHeight') - read(input, 'y') - read(input, 'height') - 10,
        ),
      ),
    );
    cssFontSize();
  };
  const apply = () => {
    input.set_textFormat(
      new TextFormat('Verdana', preferences.get('legacyChatFontSize'), 0xffffff),
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
      if (key === 'legacyChatFontSize' || key === 'dpiScale') apply();
    }),
  );
  if (typeof input.updatePlacement === 'function') api.after(input, 'updatePlacement', cssFontSize);
  if (typeof chat.toggleChatMode === 'function') api.after(chat, 'toggleChatMode', apply);
  // Game.resize may be a cached callback; stage events preserve native listener order.
  const stage = read(game, 'stage');
  if (stage?.addEventListener) {
    stage.addEventListener('resize', layout);
    api.defer(() => stage.removeEventListener('resize', layout));
  }
  apply();
}
