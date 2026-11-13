import { bindGameClasses, type GameScene } from '../src/game/Bindings';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { installNativeChatTheme } from '../src/chat/NativeChatTheme';
import { DeviceSettings } from '../src/settings/DeviceSettings';
import { Display } from './fixtures/NativeGame';
// @ts-expect-error actual host hooks
import { Hooks } from './fixtures/HostCore.js';

test('source chat skins track selection, hover, press, focus and preference changes without replacing controls', () => {
  const cleanups: (() => void)[] = [];
  const hooks = new Hooks();
  class Quad extends Display {
    color: number;
    constructor(width: number, height: number, color: number) {
      super();
      this.color = color;
      this.set_width(width);
      this.set_height(height);
    }
    set_color(value: number) {
      this.color = value;
    }
  }
  class Button extends Display {
    skinLayer = new Display();
    enabled = true;
    down = false;
    hover = false;
    selectedValue = false;
    labelPadding = 10;
    format = {
      get_font() {
        return this.font;
      },
      get_size() {
        return this.size;
      },
      get_color() {
        return this.color;
      },
      font: 'original',
      size: 12,
      color: 0xffffff,
      set_font(v: string) {
        this.font = v;
      },
      set_size(v: number) {
        this.size = v;
      },
      set_color(v: number) {
        this.color = v;
      },
    };
    textField = { get_format: () => this.format };
    constructor() {
      super();
      this.addChild(this.skinLayer);
      this.set_height(28);
    }
    showSkin() {}
    relayout() {}
    labelWidth() {
      return 30;
    }
    set_width(value: number) {
      super.set_width(value);
      this.showSkin();
      return value;
    }
  }
  const buttons = [new Button(), new Button()];
  buttons[0].selectedValue = true;
  const tabs = Object.assign(new Display(), {
    tabs: buttons,
    equalTabs: false,
    layoutTabs() {
      for (const [index, button] of buttons.entries()) {
        button.set_width(60);
        button.set_x(index * 60);
      }
    },
  });
  tabs.set_width(672);
  const document: { activeElement: unknown } = { activeElement: null };
  const element = { disabled: false, ownerDocument: document };
  let appliedPadding = -1;
  const input = Object.assign(new Display(), {
    skinLayer: new Display(),
    element,
    paddingRight: 0,
    paddingBottom: 0,
    showSkin() {},
    updatePlacement() {
      appliedPadding = this.paddingRight;
    },
  });
  input.addChild(input.skinLayer);
  input.set_width(584);
  input.set_height(39);
  const preferences = new DeviceSettings({ get: (_key, fallback) => fallback, set() {} });
  const api: any = {
    cls: () => Button,
    after: (object: any, key: string, fn: Function) => {
      const cleanup = hooks.add(object, key, 'after', fn);
      cleanups.push(cleanup);
      return cleanup;
    },
    defer: (fn: () => void) => cleanups.push(fn),
  };
  bindGameClasses({
    ...api,
    cls: (name: string) => (name === 'starling.display.Quad' ? Quad : Button),
  });
  installNativeChatTheme(
    api,
    { chatInput: { input, tabs } } as unknown as Pick<GameScene, 'chatInput'>,
    preferences,
  );
  const selected = buttons[0].getChildAt(0) as Quad,
    other = buttons[1].getChildAt(0) as Quad;
  assert.equal(selected.color, 0x3b3b3b);
  assert.equal(selected.get_alpha(), 0.86);
  assert.equal(other.color, 0x191919);
  assert.equal(buttons[1].format.color, 0xbdbdbd);
  assert.equal(buttons[0].format.font, 'DAIDRR_16');
  assert.equal(buttons[0].get_width(), 100);
  assert.equal(buttons[1].get_x(), 103);
  assert.equal(selected.get_width(), 100);
  buttons[1].labelWidth = () => 120;
  tabs.layoutTabs();
  assert.equal(buttons[1].get_width(), 144);
  // Explicitly distributed tabs may be narrower than the natural skin width.
  tabs.equalTabs = true;
  tabs.set_width(153);
  tabs.layoutTabs();
  assert.equal(buttons[0].get_width(), 75);
  assert.equal(buttons[1].get_width(), 75);
  assert.equal(buttons[1].get_x(), 78);
  assert.equal(selected.get_width(), 75);
  buttons[1].hover = true;
  buttons[1].showSkin();
  assert.equal(other.color, 0x292929);
  buttons[1].down = true;
  buttons[1].showSkin();
  assert.equal(other.color, 0x333333);
  buttons[1].enabled = false;
  buttons[1].showSkin();
  assert.equal(other.color, 0x111111);
  assert.equal(buttons[1].format.color, 0x666666);
  const background = input.getChildAt(0) as Quad;
  assert.equal(background.color, 0x191919);
  document.activeElement = element;
  input.dispatchEventWith('focusIn');
  assert.equal(background.color, 0x292929);
  element.disabled = true;
  input.showSkin();
  assert.equal(background.color, 0x111111);
  preferences.set('enableNewChatIntegrationSystem', false);
  assert.equal(selected.get_visible(), false);
  assert.equal(buttons[0].skinLayer.get_visible(), true);
  assert.equal(buttons[0].format.font, 'original');
  preferences.set('enableNewChatIntegrationSystem', true);
  cleanups.reverse().forEach((fn) => fn());
  assert.equal(input.skinLayer.get_visible(), true);
  assert.equal(input.paddingRight, 0);
  assert.equal(appliedPadding, 0, 'native editor placement must use restored padding');
  assert.equal(buttons[0].get_width(), 60);
  assert.equal(buttons[1].get_x(), 60);
  assert.equal(buttons[0].format.font, 'original');
  assert.equal(input.listeners('focusIn').length, 0);
  assert.equal(background.disposed, true);
  assert.equal(selected.disposed, true);
  assert.equal(buttons[0].get_numChildren(), 1);
});
