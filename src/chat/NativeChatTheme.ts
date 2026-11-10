import { read, type API, type Raw } from '../api/Types';
import type { Resolve } from '../runtime/As3';
import type { DeviceSettings } from '../settings/DeviceSettings';

/** AstroTheme.integratedChatTab and bitmapChatInput on native controls. */
export function installNativeChatTheme(
  api: API,
  game: Raw,
  resolve: Resolve,
  preferences?: DeviceSettings,
): void {
  const input = game.chatInput?.input,
    tabs = game.chatInput?.tabs;
  if (!input?.skinLayer || !tabs?.tabs) return;
  const Quad = resolve('starling.display.Quad');
  const Fonts = resolve('core.text.RussoBitmapFontRegistry');
  const PressButton = api.cls('core.hud.components.ui.PressButton');
  if (!PressButton) return;
  const integrated = () => preferences?.get('enableNewChatIntegrationSystem') ?? true;
  const entries = new Map<
    Raw,
    {
      background: Raw;
      skinVisible: boolean;
      font: string;
      size: number;
      color: number;
      padding: number;
    }
  >();
  const paintTab = (button: Raw) => {
    const entry = entries.get(button);
    if (!entry) return;
    const enabled = integrated();
    entry.background.set_visible(enabled);
    button.skinLayer.set_visible(enabled ? false : entry.skinVisible);
    const format = button.textField.get_format();
    format.set_font(enabled ? Fonts.fontNameForSize(12) : entry.font);
    format.set_size(enabled ? 12 : entry.size);
    format.set_color(
      enabled
        ? !button.enabled
          ? 0x666666
          : button.selectedValue
            ? 0xffffff
            : 0xbdbdbd
        : entry.color,
    );
    button.labelPadding = enabled ? 12 : entry.padding;
    if (enabled) {
      const color = !button.enabled
        ? 0x111111
        : button.down
          ? 0x333333
          : button.hover
            ? 0x292929
            : button.selectedValue
              ? 0x3b3b3b
              : 0x191919;
      entry.background.set_color(color);
      entry.background.set_width(read(button, 'width'));
      entry.background.set_height(read(button, 'height'));
    }
    button.relayout();
  };
  const restoreTab = (button: Raw) => {
    const entry = entries.get(button);
    if (!entry) return;
    entries.delete(button);
    entry.background.removeFromParent(true);
    button.skinLayer.set_visible(entry.skinVisible);
    const format = button.textField.get_format();
    format.set_font(entry.font);
    format.set_size(entry.size);
    format.set_color(entry.color);
    button.labelPadding = entry.padding;
    button.relayout();
  };
  const layoutTabs = () => {
    const buttons: Raw[] = tabs.tabs;
    for (const button of [...entries.keys()]) if (!buttons.includes(button)) restoreTab(button);
    let x = 0;
    for (const button of buttons) {
      if (!entries.has(button)) {
        const format = button.textField.get_format();
        const background = new Quad(1, 1, 0x191919);
        background.set_alpha(0.86);
        background.set_touchable(false);
        entries.set(button, {
          background,
          skinVisible: read(button.skinLayer, 'visible'),
          font: read(format, 'font'),
          size: read(format, 'size'),
          color: read(format, 'color'),
          padding: button.labelPadding,
        });
        button.addChildAt(background, 0);
      }
      paintTab(button);
      if (integrated()) {
        const width = tabs.equalTabs
          ? Math.max(
              1,
              (read(tabs, 'width') - Math.max(0, buttons.length - 1) * 3) / buttons.length,
            )
          : // Source ImageSkin(null) inherits Image's 100px width, which
            // Feathers Button.autoSizeIfNeeded includes in its natural size.
            Math.max(100, button.labelWidth() + 24);
        button.set_width(width);
        button.set_x(x);
        x += width + 3;
      }
    }
  };
  api.after(PressButton.prototype, 'showSkin', function () {
    paintTab(this);
  });
  api.after(tabs, 'layoutTabs', layoutTabs);

  const inputBackground = new Quad(1, 1, 0x191919);
  inputBackground.set_alpha(0.86);
  inputBackground.set_touchable(false);
  input.addChildAt(inputBackground, 0);
  const skinVisible = read(input.skinLayer, 'visible');
  const paddingRight = input.paddingRight,
    paddingBottom = input.paddingBottom;
  input.paddingRight = 8;
  input.paddingBottom = 3;
  const paintInput = () => {
    input.skinLayer.set_visible(false);
    inputBackground.set_width(read(input, 'width'));
    inputBackground.set_height(read(input, 'height'));
    const element = input.element;
    inputBackground.set_color(
      element?.disabled
        ? 0x111111
        : element?.ownerDocument?.activeElement === element
          ? 0x292929
          : 0x191919,
    );
  };
  api.after(input, 'showSkin', paintInput);
  input.addEventListener('focusIn', paintInput);
  input.addEventListener('focusOut', paintInput);
  if (preferences)
    api.defer(
      preferences.subscribe((key) => {
        if (key === 'enableNewChatIntegrationSystem') tabs.layoutTabs();
      }),
    );
  api.defer(() => {
    input.removeEventListener('focusIn', paintInput);
    input.removeEventListener('focusOut', paintInput);
    inputBackground.removeFromParent(true);
    input.skinLayer.set_visible(skinVisible);
    input.paddingRight = paddingRight;
    input.paddingBottom = paddingBottom;
    for (const button of [...entries.keys()]) restoreTab(button);
  });
  layoutTabs();
  paintInput();
  input.updatePlacement();
}
