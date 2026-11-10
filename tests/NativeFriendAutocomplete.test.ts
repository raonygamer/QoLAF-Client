import assert from 'node:assert/strict';
import { test } from 'node:test';
import { installCommandAutocomplete } from '../src/chat/ChatCommandAutocompletePopup';
import { RichBitmapEditorModel } from '../src/chat/rich/RichBitmapEditorModel';
import { Display, Text, Quad, Format, Image } from './fixtures/NativeGame';

test('native friend completion replaces rich ranges, keeps command help and excludes IPC rosters', (t) => {
  const originalWindow = globalThis.window;
  const events = new Map<string, Function>();
  globalThis.window = {
    addEventListener: (type: string, callback: Function) => events.set(type, callback),
    removeEventListener: (type: string) => events.delete(type),
  } as any;
  const cleanups: Function[] = [];
  const model = new RichBitmapEditorModel();
  let focused = 0,
    requests = 0,
    composing = false;
  const input = Object.assign(new Display(), {
    element: {},
    get_text: () => model.text,
    setFocus: () => focused++,
    set_text: (text: string) => {
      model.text = text;
    },
    selectRange: (begin: number, end: number) => model.select(begin, end),
  });
  input.set_width(508);
  const chat = Object.assign(new Display(), {
    input,
    isActive: () => true,
    previous() {},
    next() {},
  });
  chat.set_y(650);
  chat.addChild(input);
  const classes: any = {
    'starling.display.Sprite': Display,
    'starling.display.Quad': Quad,
    'starling.display.Image': Image,
    'starling.text.TextField': Text,
    'starling.text.TextFormat': Format,
    'core.player.Player': {
      onlineFriends: [{ id: 'pilot-id', name: 'Pilot', isOnline: true }],
      friends: [{ id: 'other-id', name: 'Pilot Two' }],
    },
  };
  const api: any = {
    cls: (name: string) => classes[name],
    after() {},
    on() {},
    defer: (fn: Function) => cleanups.push(fn),
  };
  installCommandAutocomplete(
    api,
    {
      chatInput: chat,
      playerManager: { players: [] },
      friendManager: {
        updateOnlineFriends(callback: Function) {
          requests++;
          callback();
        },
      },
    },
    () => false,
    {
      editor: {
        model,
        binding: {
          get isComposing() {
            return composing;
          },
          project() {},
        },
      } as any,
      resolve: () => Text,
    },
  );
  t.after(() => {
    try {
      cleanups.reverse().forEach((fn) => fn());
    } finally {
      globalThis.window = originalWindow;
    }
  });
  const popup = (name: string) => chat.children.find((child) => child.get_name() === name)!;
  const friends = popup('qolaf.friendAutocomplete');
  const command = popup('qolaf.commandAutocomplete');
  const seed = (text: string) => {
    model.text = text;
    model.select(model.visibleText.length);
    input.dispatchEventWith('change', true);
  };
  const key = (key: string) => {
    let prevented = false;
    events.get('keydown')!({
      key,
      target: input.element,
      preventDefault() {
        prevented = true;
      },
      stopImmediatePropagation() {},
    });
    return prevented;
  };
  seed("<font color='#ff0000'>Hi @Pil</font>");
  assert.equal(friends.get_visible(), true);
  assert.equal(requests, 1, 'synchronous service callback does not recurse into another request');
  assert.equal(key('Enter'), false, 'autocomplete never submits chat');
  assert.equal(key('ArrowDown'), true);
  assert.equal(key('Tab'), true);
  assert.equal(model.visibleText, 'Hi @Pilot Two ');
  model.select(3, model.visibleText.length);
  assert.equal(model.selectedColor, 0xff0000);
  assert.equal(focused, 1);
  seed('/echo @Pil');
  assert.equal(command.get_visible(), true);
  assert.equal(friends.get_visible(), true);
  assert.ok(command.get_y() < friends.get_y());
  seed('/ssv @Pil');
  assert.equal(friends.get_visible(), false);
  composing = true;
  seed('@Pil');
  assert.equal(friends.get_visible(), false);
  composing = false;
  input.dispatchEventWith('change', true);
  assert.equal(friends.get_visible(), true);
  assert.equal(key('Escape'), true);
  assert.equal(friends.get_visible(), false);
});
