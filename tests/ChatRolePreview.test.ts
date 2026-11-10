import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bitmapRendererFixture } from './fixtures/BitmapRenderer';
import { Text } from './fixtures/NativeGame';
import { createChatRoleTags } from '../src/ported/ChatRoleTags';
import { createChatRolePreviewPopup } from '../src/ported/ChatRolePreviewPopup';
import { installNativeChatRolePreview } from '../src/chat/NativeChatRolePreview';
// @ts-expect-error actual host hooks
import { Hooks } from './fixtures/HostCore.js';

function fixture() {
  const bitmap = bitmapRendererFixture('verdana16_bitmap');
  const roles = createChatRoleTags(bitmap.resolve);
  const resolve = (name: string): any =>
    name === 'starling.text.TextField'
      ? Text
      : name === 'core.hud.components.chat.ChatRoleTags'
        ? roles
        : bitmap.resolve(name);
  return { ...bitmap, resolve };
}

test('source role card preserves wording, click-through behavior and small viewport fitting', (t) => {
  const bitmap = fixture();
  t.after(bitmap.cleanup);
  const Popup = createChatRolePreviewPopup(bitmap.resolve);
  const popup = new Popup();
  t.after(() => popup.dispose());
  popup.showFor('client_dev', 675, 495, 680, 500);
  assert.equal(popup.get_touchable(), false);
  assert.equal(popup.get_x(), 383);
  assert.equal(popup.get_y(), 413);
  assert.equal(popup.getChildAt(2).text, '[client_dev]');
  assert.equal(popup.getChildAt(3).text, 'QoLAF client developer.\nNot Astroflux game staff.');
  popup.showFor('mod', 10, 10, 140, 35);
  assert.equal(popup.get_scaleX(), 0.5);
  assert.equal(popup.get_scaleY(), 0.5);
  assert.equal(popup.get_x(), 0);
  assert.equal(popup.get_y(), 0);
  assert.equal(popup.getChildAt(3).text, 'Astroflux game chat moderator.');
  popup.showFor('unknown', 0, 0, 680, 500);
  assert.equal(popup.get_visible(), false);
  popup.showFor('dev', 0, 0, 0, 500);
  assert.equal(popup.get_visible(), false);
});

test('both chat views show roles on hover and close for covering UI, scroll, click and cleanup', (t) => {
  const bitmap = fixture();
  t.after(bitmap.cleanup);
  const node = () => Object.assign(new bitmap.Sprite(), { globalToLocal: (point: any) => point });
  const stage = node();
  stage.get_stage = () => stage;
  let hit: any = stage;
  (stage as any).hitTest = () => hit;
  const log: any = node();
  stage.addChild(log);
  const simple: any = node();
  simple.tf = node();
  simple.addChild(simple.tf);
  simple.set_touchable(false);
  const mask = node();
  mask.set_width(680);
  mask.set_height(500);
  simple.get_mask = () => mask;
  const advanced: any = node();
  const scroll: any = node();
  scroll.set_width(660);
  scroll.set_height(490);
  let position = 0;
  scroll.get_verticalScrollPosition = () => position;
  advanced.scroll = scroll;
  advanced.addChild(scroll);
  advanced.scrollView = node();
  const background = node();
  background.set_width(680);
  background.set_height(500);
  advanced.scrollView.addChild(background);
  log.simple = simple;
  log.advanced = advanced;
  log.addChild(simple);
  log.updateTexts = () => {};
  const game = { stage, messageLog: log, isLeaving: false };
  const hooks = new Hooks();
  const cleanup: (() => void)[] = [];
  let frame: (event: any) => void = () => {};
  const api: any = {
    after: (object: any, key: string, fn: Function) =>
      cleanup.push(hooks.add(object, key, 'after', fn)),
    on: (_event: string, fn: typeof frame) => {
      frame = fn;
    },
    defer: (fn: () => void) => cleanup.push(fn),
  };
  const requests: boolean[] = [];
  installNativeChatRolePreview(api, game, bitmap.resolve, {
    roleTagAtStagePoint: (_point, isSimple) => {
      requests.push(isSimple);
      return 'mod';
    },
  });
  const simplePopup: any = simple.getChildAt(simple.get_numChildren() - 1);
  const advancedPopup: any = advanced.getChildAt(advanced.get_numChildren() - 1);
  const touch = (phase = 'hover', x = 20, y = 20) => {
    for (const listener of stage.listeners('touch'))
      listener({
        getTouch: (_stage: any, requested: string) =>
          phase === requested ? { getLocation: () => ({ x, y }) } : null,
      });
  };
  touch();
  assert.equal(simplePopup.get_visible(), true);
  assert.equal(simple.get_touchable(), false);
  const covering = node();
  stage.addChild(covering);
  hit = covering;
  touch();
  assert.equal(simplePopup.get_visible(), false);
  stage.removeChild(covering);
  hit = stage;
  touch('began');
  assert.equal(simplePopup.get_visible(), false);
  touch('hover', 700);
  assert.equal(simplePopup.get_visible(), false);
  log.removeChild(simple);
  log.addChild(advanced);
  hit = scroll;
  touch();
  assert.equal(advancedPopup.get_visible(), true);
  assert.deepEqual(requests, [true, false]);
  hit = advanced;
  touch();
  assert.equal(advancedPopup.get_visible(), false, 'only the scroll content can own a badge hover');
  hit = scroll;
  touch();
  position++;
  frame({ game });
  assert.equal(advancedPopup.get_visible(), false);
  touch();
  log.updateTexts();
  assert.equal(advancedPopup.get_visible(), false);
  touch();
  advanced.set_visible(false);
  frame({ game });
  assert.equal(advancedPopup.get_visible(), false);
  cleanup.reverse().forEach((fn) => fn());
  assert.equal(stage.listeners('touch').length, 0);
  assert.equal(simplePopup.disposed, true);
  assert.equal(advancedPopup.disposed, true);
});
