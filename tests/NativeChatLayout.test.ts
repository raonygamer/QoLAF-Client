import { bindGameClasses, type GameScene } from '../src/game/Bindings';
import type { API } from '../src/api/Types';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ChatLayout } from '../src/chat/ChatLayout';
import { installNativeChatLayout } from '../src/chat/NativeChatLayout';
import { installNativeChatPreferences } from '../src/chat/NativeChatPreferences';
import { Display } from './fixtures/NativeGame';
import { DeviceSettings } from '../src/settings/DeviceSettings';
// @ts-expect-error actual host hooks
import { Hooks } from './fixtures/HostCore.js';

test('source chat geometry keeps its desktop dimensions and fits small stages without scaling', () => {
  assert.deepEqual(ChatLayout.fit(1920, 1022), { x: 20, y: 70, width: 680, height: 500 });
  assert.deepEqual(ChatLayout.fit(320, 240), { x: 20, y: 30, width: 290, height: 80 });
  assert.deepEqual(ChatLayout.fit(8, 50), { x: 0, y: 0, width: 1, height: 1 });
  assert.deepEqual(ChatLayout.fit(NaN, 0), ChatLayout.fit(960, 720));
});

test('integrated composer follows the log, reflows rows, restores view ownership and cleans up', () => {
  const hooks = new Hooks(),
    cleanups: (() => void)[] = [];
  class Quad extends Display {
    constructor(width: number, height: number) {
      super();
      this.set_width(width);
      this.set_height(height);
    }
  }
  const tf = Object.assign(new Display(), {
    maxWidth: 500,
    text: '',
    set_maxWidth(v: number) {
      this.maxWidth = v;
    },
    set_text(text: string) {
      this.text = text;
    },
  });
  tf.set_height(600);
  const simple = Object.assign(new Display(), { tf });
  const scroll = Object.assign(new Display(), {
    position: 0,
    get_verticalScrollPosition() {
      return this.position;
    },
    get_maxVerticalScrollPosition(this: any) {
      return Math.max(0, 1000 - this.get_height());
    },
    scrollToPosition(_x: number, y: number) {
      this.position = Math.min(y, this.get_maxVerticalScrollPosition());
    },
    arrange() {},
  });
  const row = new Display();
  scroll.addChild(row);
  const scrollView = new Display(),
    background = new Quad(300, 300);
  scrollView.addChild(background);
  const advanced = Object.assign(new Display(), { scroll, scrollView });
  const log = Object.assign(new Display(), {
    simple,
    advanced,
    toggleView(this: Display, _view: string) {
      if (this.contains(advanced)) {
        this.removeChild(advanced);
        this.addChild(simple);
      } else {
        this.removeChild(simple);
        this.addChild(advanced);
      }
    },
  });
  log.addChild(simple);
  const input = Object.assign(new Display(), {
    textFormat: {},
    set_textFormat(format: object) {
      this.textFormat = format;
    },
    updatePlacement() {},
  });
  input.set_width(400);
  input.set_y(24);
  input.set_height(24);
  const tabs = Object.assign(new Display(), {
    tabHeight: 24,
    equalTabs: true,
    tabs: [new Display(), new Display()],
    set_tabHeight(v: number) {
      this.tabHeight = v;
      this.layoutTabs();
    },
    layoutTabs(this: any) {
      for (const tab of this.tabs) tab.set_width(this.get_width() / 2);
    },
  });
  tabs.set_width(400);
  const chat = Object.assign(new Display(), {
    input,
    tabs,
    active: false,
    isActive() {
      return this.active;
    },
    toggleChatMode() {
      this.active = !this.active;
    },
    closeChat() {
      this.active = false;
    },
  });
  chat.addChild(input);
  chat.addChild(tabs);
  const stage = Object.assign(new Display(), { stageWidth: 1920, stageHeight: 1022 });
  Object.assign(stage, {
    get_stageWidth: () => stage.stageWidth,
    get_stageHeight: () => stage.stageHeight,
  });
  const preferences = new DeviceSettings({ get: (_key, fallback) => fallback, set() {} });
  const api: any = {
    cls: (name: string) => (name === 'openfl.text.TextFormat' ? class {} : Quad),
    around: (object: any, key: string, fn: Function) =>
      cleanups.push(hooks.add(object, key, 'around', fn)),
    after: (object: any, key: string, fn: Function) =>
      cleanups.push(hooks.add(object, key, 'after', fn)),
    defer: (fn: () => void) => cleanups.push(fn),
  };
  const game = { messageLog: log, chatInput: chat, stage, get_stage: () => stage };
  bindGameClasses({ cls: (name: string) => api.cls(name) ?? {} } as unknown as API);
  installNativeChatPreferences(api, game as unknown as GameScene, preferences);
  installNativeChatLayout(api, game as unknown as GameScene, preferences);
  assert.equal(chat.get_x(), 20);
  assert.equal(chat.get_y(), 590);
  assert.equal(input.get_y(), 32);
  assert.equal(tabs.get_width(), 672);
  assert.equal(tf.get_y(), -100);
  assert.equal(row.get_width(), 660);
  chat.toggleChatMode();
  assert.equal(chat.get_x(), 20, 'preference hooks must not recenter the integrated composer');
  assert.equal(chat.get_y(), 590);
  assert.equal(tabs.get_width(), 672);
  preferences.set('legacyChatFontSize', 22);
  assert.equal(chat.get_y(), 590);
  assert.equal(log.contains(advanced), true);
  chat.closeChat();
  assert.equal(log.contains(simple), true);
  log.toggleView('advanced');
  chat.toggleChatMode();
  chat.closeChat();
  assert.equal(log.contains(advanced), true, 'manually opened Advanced remains open');
  stage.stageWidth = 320;
  stage.stageHeight = 240;
  stage.dispatchEventWith('resize');
  assert.equal(chat.get_y(), 130);
  assert.equal(tabs.get_width(), 282);
  assert.equal(tf.get_width(), 280);
  assert.equal(tf.get_y(), -520);
  assert.equal(background.get_height(), 80);
  preferences.set('enableNewChatIntegrationSystem', false);
  assert.equal(input.get_y(), 24);
  assert.equal(tabs.get_x(), 0);
  cleanups.reverse().forEach((fn) => fn());
  assert.equal(input.get_height(), 24);
  assert.equal(tf.maxWidth, 500);
  assert.equal(stage.listeners('resize').length, 0);
  assert.equal(chat.children.length, 2);
});
