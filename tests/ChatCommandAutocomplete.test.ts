import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ChatCommandAutocompleteModel } from '../src/chat/ChatCommandAutocompleteModel';
import { ChatCommandAutocompletePopup } from '../src/chat/ChatCommandAutocompletePopup';
import { ChatCommandSuggestion } from '../src/chat/ChatCommandSuggestion';
import { builtInCommandSuggestions } from '../src/chat/ChatCommandSuggestions';

const suggestion = (name: string) =>
  new ChatCommandSuggestion(name, ' [value]', 'A long explanation for this command');
test('command model filters, sorts, deduplicates custom commands and shows passive exact argument help', () => {
  const custom = [suggestion('zebra'), suggestion('echo')];
  const model = new ChatCommandAutocompleteModel(
    [suggestion('echo'), suggestion('clear')],
    128,
    () => custom,
  );
  assert.equal(model.update('hello'), false);
  model.update('/');
  assert.deepEqual(
    model.matches.map((entry) => entry.commandName),
    ['clear', 'echo', 'zebra'],
  );
  model.selectPrevious();
  assert.equal(model.complete(), '/zebra ');
  model.selectNext();
  assert.equal(model.complete(), '/clear ');
  model.update('/E');
  assert.equal(model.complete(), '/echo ');
  model.update('/echo argument');
  assert.equal(model.argumentMode, true);
  assert.equal(model.matches.length, 1);
  assert.equal(model.update('/e argument'), false);
  custom.push(suggestion('extra'));
  model.update('/ex');
  assert.equal(model.complete(), '/extra ');
  model.dismiss();
  assert.equal(model.complete(), null);
});

test('native command casing is preserved in completion', () => {
  const commands = builtInCommandSuggestions();
  assert.equal(commands.find((entry) => entry.commandName === 'getid')?.completionText, '/getId ');
  assert.equal(
    commands.find((entry) => entry.commandName === 'warptoid')?.completionText,
    '/warpToId ',
  );
  assert.equal(
    commands.some((entry) => entry.commandName === 'resync'),
    false,
  );
});

class Node {
  children: Node[] = [];
  x = 0;
  y = 0;
  width = 1;
  height = 1;
  visible = true;
  alpha = 1;
  text = '';
  disposed = false;
  listeners = new Map<string, Function>();
  parent?: Node;
  constructor(width = 1, height = 1, text = '') {
    Object.assign(this, { width, height, text });
  }
  set_name(_value: string) {}
  set_x(value: number) {
    this.x = value;
  }
  set_y(value: number) {
    this.y = value;
  }
  set_width(value: number) {
    this.width = value;
  }
  set_height(value: number) {
    this.height = value;
  }
  set_visible(value: boolean) {
    this.visible = value;
  }
  set_alpha(value: number) {
    this.alpha = value;
  }
  set_text(value: string) {
    this.text = value;
  }
  get_textBounds() {
    return { width: this.text.length * 6, height: 16 };
  }
  addChild(child: Node) {
    this.children.push(child);
    child.parent = this;
  }
  addEventListener(key: string, listener: Function) {
    this.listeners.set(key, listener);
  }
  removeEventListener(key: string) {
    this.listeners.delete(key);
  }
}
function popupFixture() {
  let cleanupCount = 0;
  const ui = {
    sprite: () => new Node(),
    quad: (w: number, h: number) => new Node(w, h),
    text: (w: number, h: number, value: string) => new Node(w, h, value),
    place(node: Node, x: number, y: number, parent?: Node) {
      node.x = x;
      node.y = y;
      parent?.addChild(node);
      return node;
    },
    touch(node: Node, listener: Function) {
      node.listeners.set('click', listener);
      return () => {
        cleanupCount++;
        node.listeners.delete('click');
      };
    },
    dispose(node: Node) {
      node.disposed = true;
    },
  };
  const model = new ChatCommandAutocompleteModel(
    Array.from({ length: 20 }, (_, index) => suggestion(`cmd${String(index).padStart(2, '0')}`)),
  );
  const completions: string[] = [];
  const popup = new ChatCommandAutocompletePopup(ui as any, model, (text) => {
    completions.push(text);
    popup.update(text);
  });
  return { popup, model, completions, cleanupCount: () => cleanupCount };
}

test('native popup preserves Enter, completes with Tab and keeps argument help passive', () => {
  const { popup, completions } = popupFixture();
  popup.update('/cmd0');
  popup.update('/cmd01');
  assert.equal(popup.height, 44, 'hidden pooled rows must not affect the anchor height');
  popup.update('/cmd0');
  assert.equal(popup.handleKey('Enter'), false);
  assert.equal(popup.handleKey('ArrowDown'), true);
  assert.equal(popup.handleKey('Tab'), true);
  assert.deepEqual(completions, ['/cmd01 ']);
  assert.equal(popup.handleKey('ArrowDown'), false);
  assert.equal(popup.handleKey('Escape'), false);
  popup.update('/cmd');
  assert.equal(popup.handleKey('Escape'), true);
  assert.equal(popup.node.visible, false);
});

test('native popup scrolls rows, ellipsizes descriptions and disposes listeners', () => {
  const { popup, model, completions, cleanupCount } = popupFixture();
  popup.layout(180, 100);
  popup.update('/cmd');
  const node = popup.node as Node;
  assert.equal(node.children[0].height, 78, 'only two rows fit above the editor');
  assert.ok(node.children[3].text.endsWith('...'));
  popup.scroll(1);
  assert.equal(node.children[2].text, '/cmd01 [value]');
  node.children[1].listeners.get('click')!();
  assert.deepEqual(completions, ['/cmd01 ']);
  popup.update('/cmd');
  popup.handleKey('ArrowUp');
  assert.equal(model.selectedIndex, 19);
  assert.equal(node.children[5].text, '/cmd19 [value]');
  popup.dispose();
  assert.equal(node.disposed, true);
  assert.equal(cleanupCount(), 8);
  assert.equal(node.children.at(-1)!.listeners.size, 0);
});
