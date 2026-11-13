import assert from 'node:assert/strict';
import test from 'node:test';
import { createRadioInput } from '../src/radio/RadioInput';

function fixture(query: boolean) {
  class Node {
    x = 0;
    y = 0;
    visible = true;
    touchable = true;
    alpha = 1;
    parent: Node | null = null;
    children: Node[] = [];
    addChild(node: Node) {
      node.parent = this;
      this.children.push(node);
      return node;
    }
    removeFromParent(dispose = false) {
      if (this.parent) {
        this.parent.children.splice(this.parent.children.indexOf(this), 1);
        this.parent = null;
      }
      if (dispose) this.dispose();
    }
    dispose() {
      for (const child of [...this.children]) child.removeFromParent(true);
    }
  }
  class Entry extends Node {
    width = 0;
    height = 0;
    text = '';
    enabled = true;
    displayAsPassword = false;
    element = {
      ownerDocument: { activeElement: null as unknown },
      style: { opacity: '1' },
      placeholder: '',
      selectionStart: 0,
      selectionEnd: 0,
    };
    listeners = new Map<string, Function[]>();
    set_x(v: number) {
      this.x = v;
    }
    set_y(v: number) {
      this.y = v;
    }
    set_width(v: number) {
      this.width = v;
    }
    set_height(v: number) {
      this.height = v;
    }
    get_width() {
      return this.width;
    }
    get_height() {
      return this.height;
    }
    get_text() {
      return this.text;
    }
    get_isEnabled() {
      return this.enabled;
    }
    set_textFormat() {}
    applyPadding() {}
    setBackground(node: Node) {
      this.addChild(node);
    }
    updatePlacement() {
      return false;
    }
    addEventListener(type: string, fn: Function) {
      this.listeners.set(type, [...(this.listeners.get(type) ?? []), fn]);
    }
    removeEventListener(type: string, fn: Function) {
      this.listeners.set(
        type,
        (this.listeners.get(type) ?? []).filter((f) => f !== fn),
      );
    }
    emit(type: string) {
      for (const fn of this.listeners.get(type) ?? []) fn();
    }
  }
  class Text extends Node {
    text = '';
    color = 0;
    get width() {
      return this.text.length * 8;
    }
    height = 12;
  }
  class Quad extends Node {
    constructor(
      public width: number,
      public height: number,
      public color: number,
    ) {
      super();
    }
  }
  const resolve = (name: string): any =>
    name.endsWith('.TextEntry')
      ? Entry
      : name.endsWith('.Text')
        ? Text
        : name.endsWith('.Quad')
          ? Quad
          : class {};
  const Input = createRadioInput(resolve, query);
  return new Input(0, 0, 100, 30) as any;
}

test('query preview preserves the one-pixel asset border and full native text/selection', () => {
  const input = fixture(true);
  input.text = 'https://www.youtube.com/watch?v=abcdefghijk';
  input.element.selectionStart = 7;
  input.element.selectionEnd = 19;
  input.emit('enterFrame');
  assert.equal(input.surface.color, 0x343b41);
  assert.equal(input.surface.touchable, false);
  assert.equal(input.previewBackground.color, 0x161a1d);
  assert.equal(input.previewBackground.x, 1);
  assert.equal(input.previewBackground.y, 1);
  assert.equal(input.previewBackground.width, 98);
  assert.equal(input.previewBackground.height, 28);
  assert.match(input.preview.text, /…$/);
  assert.equal(input.text, 'https://www.youtube.com/watch?v=abcdefghijk');
  input.element.ownerDocument.activeElement = input.element;
  input.emit('focusIn');
  assert.equal(input.preview.visible, false);
  assert.equal(input.previewBackground.visible, false);
  assert.equal(input.element.style.opacity, '1');
  assert.equal(input.element.selectionStart, 7);
  assert.equal(input.element.selectionEnd, 19);
  input.element.ownerDocument.activeElement = null;
  input.emit('focusOut');
  assert.equal(input.previewBackground.visible, true);
  input.set_width(160);
  input.emit('enterFrame');
  assert.equal(input.previewBackground.width, 158);
  input.dispose();
  input.dispose();
  assert.equal([...input.listeners.values()].flat().length, 0);
});

test('ordinary group fields retain native text and password rendering without the query cover', () => {
  const input = fixture(false);
  input.prompt = 'Group name';
  assert.equal(input.preview.text, 'Group name');
  assert.equal(input.previewBackground.visible, false);
  assert.equal(input.paddingLeft, 5);
  input.displayAsPassword = true;
  input.text = 'secret';
  input.emit('enterFrame');
  assert.equal(input.element.style.opacity, '1');
  assert.equal(input.preview.visible, false);
  assert.equal(input.previewBackground.visible, false);
  input.dispose();
});
