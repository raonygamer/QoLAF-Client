import { EmojiGlyphLookup } from '../src/chat/rich/EmojiGlyphLookup';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { installNativeRichChatInput } from '../src/chat/NativeRichChatInput';
import { bitmapRendererFixture } from './fixtures/BitmapRenderer';
import { GlobalChatSanitizer } from '../src/chat/GlobalChatSanitizer';
import { ChatArtifactLinkResolver } from '../src/chat/ChatArtifactLinkResolver';
// @ts-expect-error actual host hook dispatcher
import { Hooks } from './fixtures/HostCore.js';

class Element extends EventTarget {
  value = '';
  style = { opacity: '1' };
  disabled = false;
  readOnly = false;
  selectionStart = 0;
  selectionEnd = 0;
  selectionDirection = 'forward';
  attributes = new Map([['maxlength', '150']]);
  ownerDocument = Object.assign(new EventTarget(), { activeElement: this });
  getAttribute(name: string) {
    return this.attributes.get(name) ?? null;
  }
  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }
  removeAttribute(name: string) {
    this.attributes.delete(name);
  }
  setSelectionRange(begin: number, end: number, direction = 'forward') {
    this.selectionStart = begin;
    this.selectionEnd = end;
    this.selectionDirection = direction;
  }
  getBoundingClientRect() {
    return { left: 0, width: 400 };
  }
  emit(name: string, data: Record<string, unknown> = {}) {
    const event = new Event(name, { cancelable: true });
    Object.assign(event, data);
    this.dispatchEvent(event);
    return event;
  }
}

function fixture(artifacts?: Parameters<typeof installNativeRichChatInput>[4]) {
  const bitmap = bitmapRendererFixture('verdana48_bitmap');
  bitmap.resolve('starling.text.TextField').getBitmapFont = (name: string) =>
    name === 'verdana48_bitmap' ? bitmap.font : null;
  const hooks = new Hooks();
  const cleanups: (() => void)[] = [];
  const element = new Element();
  const input = Object.assign(new bitmap.Sprite(), {
    element,
    textFormat: { size: 14, color: 0xffffff },
    restrict: '^<>=&#[]{}' as string | null,
    maxChars: 150,
    paddingLeft: 8,
    paddingTop: 3,
    get_text: () => element.value,
    get_length: () => element.value.length,
    set_text(value: string) {
      element.value = this.sanitize(value);
      return value;
    },
    sanitize(value: string) {
      return this.restrict ? value.replace(/[<>=&#\[\]{}]/g, '') : value;
    },
    set_restrict(value: string | null) {
      this.restrict = value;
      element.value = this.sanitize(this.get_text());
      return value;
    },
    set_maxChars(value: number) {
      this.maxChars = value;
      return value;
    },
    selectRange(begin: number, end: number) {
      element.setSelectionRange(begin, end);
    },
    updatePlacement() {
      return true;
    },
    set_textFormat(format: { size: number; color: number }) {
      this.textFormat = format;
    },
  });
  input.set_width(400);
  input.set_height(24);
  const chat = {
    input,
    tabs: new bitmap.Sprite(),
    chatMode: 'local',
    isActive: () => true,
    toggleChatMode() {},
    submitted: [] as string[],
    sendGlobal(value: string) {
      this.submitted.push(value);
    },
  };
  const api = {
    before: (object: any, key: string, fn: Function) => {
      const off = hooks.add(object, key, 'before', fn);
      cleanups.push(off);
      return off;
    },
    around: (object: any, key: string, fn: Function) => {
      const off = hooks.add(object, key, 'around', fn);
      cleanups.push(off);
      return off;
    },
    after: (object: any, key: string, fn: Function) => {
      const off = hooks.add(object, key, 'after', fn);
      cleanups.push(off);
      return off;
    },
    defer: (fn: () => void) => cleanups.push(fn),
  };
  const editor = installNativeRichChatInput(
    Object.freeze(api) as any,
    { chatInput: chat },
    bitmap.resolve,
    undefined,
    artifacts,
  )!;
  return {
    input,
    element,
    chat,
    editor,
    cleanup() {
      cleanups.reverse().forEach((fn) => fn());
      bitmap.cleanup();
    },
  };
}

test('native rich input exposes wire markup but projects visible text and source-offset selections', (t) => {
  const { input, element, cleanup } = fixture();
  t.after(cleanup);
  const source = "A<font color='#ff6600'>orange</font>Z";
  input.set_text(source);
  assert.equal(input.get_text(), source);
  assert.equal(element.value, 'AorangeZ');
  assert.equal(input.get_length(), source.length);
  input.selectRange(source.length, source.length);
  assert.equal(element.selectionStart, 8);
  let changes = 0;
  input.addEventListener('change', () => changes++);
  element.emit('beforeinput', { inputType: 'insertText', data: '!' });
  assert.equal(element.value, 'AorangeZ!');
  assert.equal(changes, 1);
  assert.ok(input.get_text().includes("color='#ff6600'"));
});

test('native channel restrictions, serialized length limits and formatting changes stay connected', (t) => {
  const { input, element, chat, cleanup } = fixture();
  t.after(cleanup);
  input.set_maxChars(3);
  element.emit('beforeinput', { inputType: 'insertText', data: '<font color="#f00">A</font>' });
  assert.equal(input.get_text(), '');
  element.emit('beforeinput', { inputType: 'insertText', data: 'abc' });
  assert.equal(input.get_text(), 'abc');
  input.set_text('');
  input.set_maxChars(150);
  chat.chatMode = 'global';
  chat.tabs.dispatchEventWith('change');
  element.emit('beforeinput', { inputType: 'insertText', data: '<b>Hi</b>' });
  assert.equal(element.value, 'bHi/b');
  chat.chatMode = 'local';
  input.updatePlacement();
  assert.equal(input.restrict, null);
  input.set_text('AB');
  input.set_textFormat({ size: 24, color: 0x123456 });
  const renderer = input.children[0].children[1] as any;
  assert.equal(renderer.textFormat.size, 24);
  assert.equal(renderer.characterBatch.meshes[0].color, 0x123456);
});

test('unloading restores native hooks, DOM appearance, limits and restrictions', () => {
  const { input, element, cleanup } = fixture();
  input.set_text('draft');
  const view = input.children[0];
  assert.equal(element.style.opacity, '0');
  assert.equal(element.getAttribute('maxlength'), null);
  cleanup();
  assert.equal(view.disposed, true);
  assert.equal(input.children.length, 0);
  assert.equal(input.restrict, '^<>=&#[]{}');
  assert.equal(element.style.opacity, '1');
  assert.equal(element.getAttribute('maxlength'), '150');
  input.set_text('<hello>');
  assert.equal(input.get_text(), 'hello');
  element.emit('beforeinput', { inputType: 'insertText', data: 'ignored' });
  assert.equal(input.get_text(), 'hello');
});

test('switching Global preserves the rich draft and sanitizes only the outbound global payload', (t) => {
  const { input, element, chat, cleanup } = fixture();
  t.after(cleanup);
  const source = "<font color='#ff6600'>draft</font>";
  input.set_text(source);
  chat.chatMode = 'global';
  chat.tabs.dispatchEventWith('change');
  assert.equal(input.get_text(), source);
  assert.equal(element.value, 'draft');
  chat.sendGlobal(input.get_text());
  assert.deepEqual(chat.submitted, ['draft']);
  chat.sendGlobal('<b></b>');
  assert.equal(chat.submitted.length, 1);
  assert.equal(GlobalChatSanitizer.stripHTML('<scr<script>ipt>safe'), 'safe');
  assert.equal(GlobalChatSanitizer.stripHTML('broken<tag'), 'brokentag');
});

test('native composer paints inserted emoji from the source color atlas and deletes the whole cluster', (t) => {
  const { input, element, cleanup } = fixture();
  t.after(cleanup);
  element.emit('beforeinput', { inputType: 'insertText', data: '😀' });
  assert.equal(input.get_text(), '😀');
  const view = input.getChildAt(0) as any;
  const renderer = view.getChildAt(1);
  const glyph = renderer.currentTextFormat.font.getChar(EmojiGlyphLookup.glyphIdForScalar(0x1f600));
  assert.ok(glyph);
  assert.equal(renderer.characterBatch.meshes.length, 1);
  assert.equal(renderer.characterBatch.meshes[0].texture, glyph.texture);
  element.emit('beforeinput', { inputType: 'deleteContentBackward' });
  assert.equal(input.get_text(), '');
});

test('native click counts select bitmap words and lines without DOM selection overriding them', (t) => {
  const { input, element, cleanup } = fixture();
  t.after(cleanup);
  input.set_text('one two');
  const click = element.emit('click', { button: 0, detail: 2, clientX: 10 });
  assert.equal(click.defaultPrevented, true);
  assert.deepEqual([element.selectionStart, element.selectionEnd], [0, 3]);
  assert.equal(element.emit('dblclick').defaultPrevented, true);
  element.emit('click', { button: 0, detail: 3, clientX: 10 });
  assert.deepEqual([element.selectionStart, element.selectionEnd], [0, 7]);
  element.disabled = true;
  element.emit('click', { button: 0, detail: 2, clientX: 10 });
  assert.deepEqual([element.selectionStart, element.selectionEnd], [0, 7]);
});

test('live composer resolves artifact labels without changing wire tokens or selected references', () => {
  const pending: Array<{ table: string; id: string; complete: (record: any) => void }> = [];
  const resolver = new ChatArtifactLinkResolver(
    {
      client: {
        bigDB: {
          load(table: string, id: string, complete: (record: any) => void) {
            pending.push({ table, id, complete });
          },
        },
      },
    },
    (record) => ({ ...record, stats: [{}], getColor: () => 0x123456 }),
  );
  const { input, element, editor, cleanup } = fixture(resolver);
  const token = '$artifact:player-1:item$';
  input.set_text(`A ${token} Z`);
  assert.equal(element.value, 'A [Artifact] Z');
  assert.deepEqual(
    pending.map(({ table, id }) => [table, id]),
    [['PlayerObjects', 'player-1']],
  );
  input.selectRange(2, 2 + token.length);
  assert.equal(editor.model.selectedCopyText, token);
  const renderer = input.children[0].children[1] as any;
  const initialMeshes = renderer.characterBatch.meshes.length;
  pending.shift()!.complete({ key: 'player-1', name: 'Pilot', level: 42 });
  assert.equal(pending[0].table, 'Artifacts');
  pending.shift()!.complete({
    key: 'item',
    id: 'item',
    player: 'player-1',
    revealed: true,
    name: 'Long Purple Artifact',
  });
  assert.equal(element.value, 'A [Artifact: Long Purple Artifact] Z');
  assert.equal(input.get_text(), `A ${token} Z`);
  assert.equal(editor.model.selectedCopyText, token);
  assert.equal(editor.model.selectedVisibleText, '[Artifact: Long Purple Artifact]');
  assert.deepEqual([element.selectionStart, element.selectionEnd], [2, 34]);
  assert.ok(renderer.characterBatch.meshes.length > initialMeshes);
  assert.ok(renderer.characterBatch.meshes.some((mesh: any) => mesh.color === 0x123456));

  input.set_text('$artifact:player-1:later$');
  assert.equal(pending.length, 1);
  cleanup();
  assert.equal(renderer.disposed, true);
  pending.shift()!.complete({
    key: 'later',
    id: 'later',
    player: 'player-1',
    revealed: true,
    name: 'Late result',
  });
  assert.equal(
    editor.model.visibleText,
    '[Artifact]',
    'disposed composer unsubscribes from lookup completion',
  );
  resolver.dispose();
});
