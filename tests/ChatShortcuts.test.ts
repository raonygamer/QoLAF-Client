import type { ChatInputText } from '../src/game/Bindings';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ChatEmojiAutocompleteParser as Parser } from '../src/chat/ChatEmojiAutocompleteParser';
import { ChatImageShortcutStore } from '../src/chat/ChatImageShortcutStore';
import { installNativeChatShortcuts } from '../src/chat/NativeChatShortcuts';
import { RichBitmapEditorModel } from '../src/chat/rich/RichBitmapEditorModel';
import { RichBitmapInputBinding } from '../src/chat/rich/RichBitmapInputBinding';
import { Display } from './fixtures/NativeGame';

class Input extends EventTarget {
  value = '';
  selectionStart = 0;
  selectionEnd = 0;
  selectionDirection = 'forward';
  ownerDocument = Object.assign(new EventTarget(), { activeElement: this });
  setSelectionRange(begin: number, end: number, direction = 'forward') {
    this.selectionStart = begin;
    this.selectionEnd = end;
    this.selectionDirection = direction;
  }
  emit(type: string, properties: Record<string, unknown> = {}) {
    const event = Object.assign(new Event(type, { cancelable: true }), properties);
    this.dispatchEvent(event);
  }
}

test('source shortcode boundaries distinguish aliases from URLs, paths and selections', () => {
  for (const text of [
    'https://x/:ship:',
    'namespace:ship:',
    'x_:ship:',
    '+:ship:',
    '\\:ship:',
    '::ship:',
    ':bad name:',
  ]) {
    assert.equal(Parser.find(text, text.length, text.length), null, text);
  }
  assert.deepEqual(Parser.find('(:Ship_1:)', 9, 9), {
    beginIndex: 1,
    endIndex: 9,
    query: 'Ship_1',
    closed: true,
  });
  assert.deepEqual(Parser.find(':shi', 4, 4), {
    beginIndex: 0,
    endIndex: 4,
    query: 'shi',
    closed: false,
  });
  assert.equal(Parser.find(':ship:', 0, 6), null);
  assert.equal(Parser.find(':ship:', 7, 7), null);
});

test('native alias expansion preserves styles, waits for IME and leaves disallowed channels alone', (t) => {
  const element = new Input();
  let focused = 0;
  const input = Object.assign(new Display(), {
    element,
    setFocus() {
      focused++;
    },
  });
  const chat = {
    input,
    chatMode: 'clan',
    visible: true,
    get_visible() {
      return this.visible;
    },
    isActive: () => true,
  };
  const model = new RichBitmapEditorModel();
  const binding = new RichBitmapInputBinding(model, element as unknown as HTMLInputElement, () =>
    input.dispatchEventWith('change', true),
  );
  const shortcuts = new ChatImageShortcutStore(
    { get: (_key, fallback) => fallback, set() {} },
    () => {},
  );
  const url = 'https://example.test/ship.png';
  shortcuts.save('ship', url);
  const cleanups: (() => void)[] = [];
  installNativeChatShortcuts(
    { defer: (fn: () => void) => cleanups.push(fn) } as any,
    chat as unknown as ChatInputText,
    { model, binding } as any,
    shortcuts,
  );
  t.after(() => {
    cleanups.forEach((fn) => fn());
    binding.dispose();
  });
  const seed = (text: string) => {
    binding.setText(text);
    model.select(model.visibleText.length);
    binding.project();
  };
  const type = (text: string) =>
    element.emit('beforeinput', { inputType: 'insertText', data: text });
  seed("<font color='#ff0000'>Pilot :ship</font>");
  type(':');
  assert.equal(model.visibleText, 'Pilot ' + url);
  model.select(6, model.visibleText.length);
  assert.equal(model.selectedColor, 0xff0000);
  assert.equal(element.value, 'Pilot ' + url);
  assert.equal(focused, 1);
  for (const mode of ['local', 'global', 'group']) {
    chat.chatMode = mode;
    seed(':ship');
    type(':');
    assert.equal(model.visibleText, ':ship:');
  }
  chat.chatMode = 'privateSaved';
  seed(':ship');
  type(':');
  assert.equal(model.visibleText, url);
  seed(':unknown');
  type(':');
  assert.equal(model.visibleText, ':unknown:');
  seed(':ship');
  element.emit('compositionstart');
  element.emit('compositionupdate', { data: ':' });
  assert.equal(binding.isComposing, true);
  assert.notEqual(model.visibleText, url);
  element.emit('compositionend', { data: ':' });
  assert.equal(binding.isComposing, false);
  assert.equal(model.visibleText, url);
  cleanups.splice(0).forEach((fn) => fn());
  seed(':ship');
  type(':');
  assert.equal(model.visibleText, ':ship:');
});
