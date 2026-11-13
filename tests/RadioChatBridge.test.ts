import assert from 'node:assert/strict';
import test from 'node:test';
import { RadioChatBridge } from '../src/radio/RadioChatBridge';
import type { Raw } from '../src/api/Types';

function fixture(reverse = false) {
  let focused: unknown = null,
    active = false,
    cancelled = 0;
  const inputOwner = {},
    otherInput = {};
  const game: Raw = { isLeaving: false, blockHotkeys: false };
  const log: Raw = { visible: true },
    input: Raw = {
      visible: true,
      isActive: () => active,
      closeChat: () => {
        active = false;
      },
    },
    popup: Raw = { visible: true },
    background: Raw = { visible: true };
  const children = reverse ? [background, input, log, popup] : [background, log, input, popup];
  const original = [...children];
  let moves = 0;
  const layer: Raw = {
    get_numChildren: () => children.length,
    getChildIndex: (child: Raw) => children.indexOf(child),
    getChildAt: (index: number) => children[index],
    setChildIndex: (child: Raw, index: number) => {
      children.splice(children.indexOf(child), 1);
      children.splice(index, 0, child);
      moves++;
    },
    removeChild: () => {
      throw Error('must never detach composer');
    },
  };
  for (const child of children) child.get_parent = () => layer;
  game.messageLog = log;
  game.chatInput = input;
  const bridge = new RadioChatBridge({
    nativeInput: () => focused,
    ownsInput: (_chat, value) => value === inputOwner,
    logicalFocus: () => true,
    cancelCommands: () => {
      cancelled++;
    },
  });
  return {
    game,
    log,
    input,
    popup,
    children,
    original,
    layer,
    bridge,
    inputOwner,
    otherInput,
    focus: (value: unknown) => {
      focused = value;
    },
    activate: () => {
      active = true;
    },
    active: () => active,
    cancelled: () => cancelled,
    moves: () => moves,
  };
}

test('radio raises chat without removal and restores either original sibling order', () => {
  for (const reverse of [false, true]) {
    const f = fixture(reverse);
    f.bridge.attach(f.game, f.popup);
    assert.deepEqual(f.children.slice(-2), [f.log, f.input]);
    assert.equal(f.game.blockHotkeys, true);
    assert.equal(f.cancelled(), 1);
    assert.equal(f.bridge.allowsChat(f.game), true);
    f.bridge.detach(f.popup);
    assert.deepEqual(f.children, f.original);
    assert.equal(f.bridge.hasPopup(f.game), false);
    assert.equal(f.moves(), 4);
  }
});

test('another visible surface owns Escape and blocks chat; hidden siblings do not', () => {
  const f = fixture();
  f.bridge.attach(f.game, f.popup);
  const higher: Raw = { visible: true };
  f.children.push(higher);
  f.activate();
  f.focus(f.inputOwner);
  assert.equal(f.bridge.allowsChat(f.game), false);
  assert.equal(f.bridge.handleEscape(f.game, f.popup), true);
  assert.equal(f.active(), true);
  higher.visible = false;
  assert.equal(f.bridge.allowsChat(f.game), true);
  assert.equal(f.bridge.handleEscape(f.game, f.popup), true);
  assert.equal(f.active(), false);
  assert.equal(f.bridge.handleEscape(f.game, f.popup), false);
});

test('native input ownership overrides stale chat focus and radio input leaves chat intact', () => {
  const f = fixture();
  f.bridge.attach(f.game, f.popup);
  f.activate();
  f.focus(f.otherInput);
  assert.equal(f.bridge.chatHasFocus(f.game), false);
  assert.equal(f.bridge.otherInputHasFocus(f.game), true);
  assert.equal(f.bridge.handleEscape(f.game, f.popup), false);
  assert.equal(f.active(), true);
  f.focus(f.inputOwner);
  assert.equal(f.bridge.chatHasFocus(f.game), true);
  f.focus(null);
  assert.equal(f.bridge.chatHasFocus(f.game), true);
});

test('teardown restores chat after popup removal and ignores unrelated popup disposal', () => {
  const f = fixture();
  f.bridge.attach(f.game, f.popup);
  f.bridge.detach({});
  assert.equal(f.bridge.hasPopup(f.game), true);
  f.children.splice(f.children.indexOf(f.popup), 1);
  f.popup.get_parent = () => null;
  assert.equal(f.bridge.hasPopup(f.game), false);
  f.bridge.detach(f.popup);
  assert.deepEqual(
    f.children,
    f.original.filter((child) => child !== f.popup),
  );
});
