import assert from 'node:assert/strict';
import { test } from 'node:test';
import { installNativeChatPreferences } from '../src/chat/NativeChatPreferences';
import { DeviceSettings } from '../src/settings/DeviceSettings';
import { Display } from './fixtures/NativeGame';

test('native composer font, DPI placement, narrow window and cleanup preserve input contents', () => {
  class Input extends Display {
    textFormat: any = { font: 'Verdana', size: 12 };
    element = {
      style: { fontSize: '12px' },
      value: 'unsent draft',
      selectionStart: 3,
      selectionEnd: 5,
    };
    set_textFormat(format: any) {
      this.textFormat = format;
    }
    updatePlacement() {}
  }
  const input = new Input();
  input.set_width(300);
  input.set_height(24);
  input.set_y(24);
  const chat = Object.assign(new Display(), { input, tabs: new Display(), toggleChatMode() {} });
  chat.tabs.set_width(300);
  const stage = Object.assign(new Display(), { stageWidth: 1000, stageHeight: 800 });
  const game = { chatInput: chat, stage };
  const cleanups: Function[] = [];
  let scale = 1;
  const preferences = new DeviceSettings({ get: (_key, fallback) => fallback, set() {} });
  const api: any = {
    cls: (name: string) =>
      name === 'openfl.text.TextFormat'
        ? class {
            constructor(
              public font: string,
              public size: number,
              public color: number,
            ) {}
          }
        : name === 'core.hud.components.ui.DomOverlay'
          ? { toCss: () => ({ height: scale }) }
          : undefined,
    defer: (fn: Function) => cleanups.push(fn),
    after: (target: any, key: string, hook: Function) => {
      const original = target[key];
      target[key] = function (...args: any[]) {
        const result = original.apply(this, args);
        hook.call(this, result, ...args);
        return result;
      };
      cleanups.push(() => {
        target[key] = original;
      });
    },
  };
  const originalFormat = input.textFormat;
  installNativeChatPreferences(api, game, preferences);
  assert.equal(input.textFormat.size, 14);
  assert.equal(input.element.style.fontSize, '14px');
  assert.equal(chat.get_x(), 350);
  preferences.set('legacyChatFontSize', 22);
  assert.equal(input.element.style.fontSize, '22px');
  scale = 1.25;
  input.updatePlacement();
  assert.equal(input.element.style.fontSize, '27.5px');
  stage.stageWidth = 200;
  stage.stageHeight = 75;
  stage.dispatchEventWith('resize');
  assert.equal(input.get_width(), 180);
  assert.equal(chat.get_x(), 10);
  assert.equal(chat.get_y(), 0);
  assert.equal(input.element.value, 'unsent draft');
  assert.equal(input.element.selectionStart, 3);
  assert.equal(input.element.selectionEnd, 5);
  cleanups.reverse().forEach((fn) => fn());
  assert.equal(input.textFormat, originalFormat);
  assert.equal(input.get_width(), 300);
  assert.equal(input.element.style.fontSize, '12px');
  assert.equal(stage.listeners('resize').length, 0);
});
