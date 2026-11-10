import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createClientHelpPopup } from '../src/dialogs/ClientHelpPopup';

class Node {
  width = 100;
  height = 24;
  x = 0;
  y = 0;
  visible = true;
  children: Node[] = [];
  addChild(child: Node) {
    this.children.push(child);
    return child;
  }
  removeFromParent() {}
  addEventListener() {}
  arrange() {}
  scrollToPosition() {}
}
class Button extends Node {
  constructor(public callback: () => void) {
    super();
  }
  trigger() {
    this.callback();
  }
}
class NativePopup extends Node {
  box = new Node();
  textField = new Node();
  closeButton = new Node();
  closed = 0;
  close() {
    this.closed++;
  }
}

test('a native Close button invokes the popup receiver rather than calling itself recursively', () => {
  const Popup = createClientHelpPopup((name) => {
    if (name === 'core.hud.components.dialogs.PopupMessage') return NativePopup;
    if (name === 'core.hud.components.Button') return Button;
    return Node;
  });
  const popup = new Popup([]);
  popup.closeButton.trigger();
  assert.equal(popup.closed, 1);
  assert.equal(popup.closeButton.closed, undefined);
});
