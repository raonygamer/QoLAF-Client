import { bindGameClasses } from '../src/game/Bindings';
import assert from 'node:assert/strict';
import { test } from 'node:test';
// @ts-expect-error actual host hook dispatcher
import { Hooks } from './fixtures/HostCore.js';
import { installCommandAutocomplete } from '../src/chat/ChatCommandAutocompletePopup';
import { RichBitmapEditorModel } from '../src/chat/rich/RichBitmapEditorModel';
import { ChatCommandSuggestion } from '../src/chat/ChatCommandSuggestion';
import { Display, Text, Quad, Format, Image } from './fixtures/NativeGame';

test('native friend completion replaces rich ranges, keeps command help and excludes IPC rosters', (t) => {
  const originalWindow = globalThis.window;
  const events = new Map<string, Function>();
  globalThis.window = {
    addEventListener: (type: string, callback: Function) => events.set(type, callback),
    removeEventListener: (type: string) => events.delete(type),
  } as any;
  const cleanups: Function[] = [];
  const hooks = new Hooks();
  let tabPrevented = false;
  let completingWithTab = false;
  const model = new RichBitmapEditorModel();
  let focused = 0,
    closed = 0,
    requests = 0,
    composing = false;
  const input = Object.assign(new Display(), {
    element: Object.assign(new EventTarget(), {
      ownerDocument: { activeElement: null as unknown },
    }),
    get_text: () => model.text,
    setFocus: () => {
      if (completingWithTab)
        assert.equal(tabPrevented, true, 'Tab is consumed before completion restores focus');
      focused++;
    },
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
    closeChat() {
      closed++;
      input.set_text('');
    },
  });
  chat.set_y(650);
  chat.addChild(input);
  const gameClass = {};
  const classes: any = {
    'core.scene.Game': gameClass,
    'starling.display.Sprite': Display,
    'starling.display.Quad': Quad,
    'starling.display.Image': Image,
    'starling.text.TextField': Text,
    'starling.text.TextFormat': Format,
    'core.hud.components.chat.MessageLog': { textQueue: [] },
    'core.player.Player': {
      onlineFriends: [{ id: 'pilot-id', name: 'Pilot', isOnline: true }],
      friends: [{ id: 'other-id', name: 'Pilot Two' }],
    },
  };
  bindGameClasses({ cls: (name: string) => classes[name] ?? {} } as any);
  const api: any = {
    cls: (name: string) => classes[name],
    around: (target: object, name: string, callback: Function) => {
      const remove = hooks.add(target, name, 'around', callback);
      cleanups.push(remove);
      return remove;
    },
    on() {},
    defer: (fn: Function) => cleanups.push(fn),
  };
  installCommandAutocomplete(
    api,
    {
      __class__: gameClass,
      chatInput: chat,
      playerManager: { get_players: () => [], get_playersById: () => ({ h: {} }) },
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
    tabPrevented = false;
    completingWithTab = key === 'Tab';
    events.get('keydown')!({
      key,
      target: input.element,
      preventDefault() {
        prevented = true;
        if (key === 'Tab') tabPrevented = true;
      },
      stopImmediatePropagation() {},
    });
    completingWithTab = false;
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
  seed('ordinary draft');
  assert.equal(key('Tab'), true, 'Tab keeps focus even without a suggestion');
  cleanups.push(
    hooks.add(chat, 'previous', 'around', () => {
      seed('@Pil');
      assert.equal(
        friends.get_visible(),
        false,
        'history replacement does not briefly reopen suggestions',
      );
    }),
  );
  assert.equal(key('ArrowUp'), true);
  assert.equal(model.text, '@Pil');
  assert.equal(friends.get_visible(), false);
  seed('/echo @Pil');
  assert.equal(command.get_visible(), true);
  assert.equal(friends.get_visible(), true);
  assert.ok(command.get_y() < friends.get_y());
  seed('/ssv @Pil');
  assert.equal(friends.get_visible(), false);
  composing = true;
  seed('@Pil');
  assert.equal(friends.get_visible(), false);
  assert.equal(key('Escape'), false, 'active IME owns Escape even without event.isComposing');
  assert.equal(closed, 0);
  composing = false;
  input.dispatchEventWith('change', true);
  assert.equal(friends.get_visible(), true);
  assert.equal(key('Escape'), true);
  assert.equal(friends.get_visible(), false);
  assert.equal(closed, 1, 'Escape closes the composer instead of only dismissing its list');
  assert.equal(model.text, '', 'native close discards the main draft, matching the source');
  seed('ordinary draft');
  assert.equal(key('Escape'), true);
  assert.equal(closed, 2, 'Escape also closes without an active suggestion');
  cleanups
    .splice(0)
    .reverse()
    .forEach((fn) => fn());
  const isolated = installCommandAutocomplete(
    api,
    { __class__: gameClass, chatInput: chat },
    () => false,
    undefined,
    [new ChatCommandSuggestion('global', ' [message]', 'Global chat')],
  );
  seed('/g');
  const isolatedCommand = popup('qolaf.commandAutocomplete');
  assert.equal(
    isolatedCommand.get_visible(),
    false,
    'an unfocused floating draft cannot show suggestions',
  );
  input.element.ownerDocument.activeElement = input.element;
  input.element.dispatchEvent(new Event('focus'));
  assert.equal(isolatedCommand.get_visible(), true);
  isolated!.close();
  assert.equal(isolatedCommand.get_visible(), false);
  seed('/echo');
  assert.equal(
    isolatedCommand.get_visible(),
    false,
    'floating suggestions exclude main client commands',
  );
  seed('/g');
  assert.equal(isolatedCommand.get_visible(), true);
  input.element.ownerDocument.activeElement = null;
  input.element.dispatchEvent(new Event('blur'));
  assert.equal(
    isolatedCommand.get_visible(),
    false,
    'blur closes suggestions without clearing the draft',
  );
  assert.equal(model.text, '/g');
});
