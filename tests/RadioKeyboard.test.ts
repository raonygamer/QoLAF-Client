import assert from 'node:assert/strict';
import test from 'node:test';
import { installRadioKeyboard } from '../src/radio/RadioKeyboard';
import { RadioChatBridge } from '../src/radio/RadioChatBridge';

function fixture() {
  const target = new EventTarget();
  let focused: unknown = null,
    active = false,
    toggles = 0,
    closes = 0;
  const game: any = { isLeaving: false };
  const input = {
    visible: true,
    isActive: () => active,
    closeChat: () => {
      active = false;
    },
    toggleChatMode: () => {
      active = !active;
      toggles++;
    },
  };
  const log = { visible: true };
  const popup: any = {
    visible: true,
    dismiss: () => {
      closes++;
      bridge.detach(popup);
    },
  };
  const children: any[] = [log, input, popup];
  const layer = {
    get_numChildren: () => children.length,
    getChildIndex: (child: unknown) => children.indexOf(child),
    getChildAt: (index: number) => children[index],
    setChildIndex: (child: unknown, index: number) => {
      children.splice(children.indexOf(child), 1);
      children.splice(index, 0, child);
    },
  };
  for (const child of children) child.parent = layer;
  game.chatInput = input;
  game.messageLog = log;
  const bridge = new RadioChatBridge({
    nativeInput: () => focused,
    ownsInput: (_chat, value) => value === input,
    logicalFocus: () => active,
    cancelCommands: () => {},
  });
  bridge.attach(game, popup);
  const cleanup = installRadioKeyboard(target as unknown as Window, game, bridge, () => popup);
  const key = (type: string, value: string, extra = {}) => {
    const event = new Event(type, { cancelable: true });
    Object.assign(event, { key: value, ...extra });
    target.dispatchEvent(event);
    return event.defaultPrevented;
  };
  return {
    children,
    key,
    cleanup,
    toggles: () => toggles,
    closes: () => closes,
    active: () => active,
    focus: (value: unknown) => {
      focused = value;
    },
  };
}

test('radio Enter opens/submits once per press and Escape closes composer before popup', () => {
  const f = fixture();
  assert.equal(f.key('keydown', 'Enter'), true);
  assert.equal(f.key('keydown', 'Enter', { repeat: true }), true);
  assert.equal(f.toggles(), 1);
  assert.equal(f.key('keyup', 'Enter'), true);
  f.key('keydown', 'Escape');
  f.key('keyup', 'Escape');
  assert.equal(f.active(), false);
  assert.equal(f.closes(), 0);
  f.key('keydown', 'Escape');
  assert.equal(f.closes(), 1);
  assert.equal(f.key('keyup', 'Escape'), true);
  f.cleanup();
  assert.equal(f.key('keydown', 'Enter'), false);
});

test('radio leaves editors, IME and higher dialogs in control of their own keys', () => {
  const f = fixture();
  f.focus({});
  assert.equal(f.key('keydown', 'Enter'), false);
  f.focus(null);
  assert.equal(f.key('keydown', 'Enter', { isComposing: true }), false);
  f.children.push({ visible: true });
  assert.equal(f.key('keydown', 'Enter'), false);
  assert.equal(f.key('keydown', 'Escape'), false);
  assert.equal(f.closes(), 0);
  assert.equal(f.toggles(), 0);
  f.cleanup();
});
