import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSettingsKeybind } from '../src/ported/SettingsKeybind';
import { aliasProperties } from '../src/runtime/As3';
import { Display, Stage } from './fixtures/NativeGame';

test('source keybinding rows cancel, bind mouse buttons, and detach capture listeners after removal', (t) => {
  const cleanup: (() => void)[] = [];
  aliasProperties({ defer: (fn: () => void) => cleanup.push(fn) } as any, Display);
  t.after(() => cleanup.reverse().forEach((fn) => fn()));
  class Label extends Display {
    text = '';
  }
  class Button extends Label {
    constructor(
      public callback: Function,
      text: string,
    ) {
      super();
      this.text = text;
    }
  }
  const definitions: Record<string, any> = {
    'core.hud.components.Box': Display,
    'core.hud.components.Text': Label,
    'core.hud.components.Button': Button,
    'data.KeyBinds': {},
    'generics.Localize': { t: (text: string) => text },
    'starling.display.Sprite': Display,
    'starling.display.Stage': Stage,
    'starling.events.Event': {},
    'starling.events.KeyboardEvent': {},
    'starling.events.TouchEvent': {},
  };
  const Row = createSettingsKeybind((name) => {
    assert.ok(definitions[name], name);
    return definitions[name];
  });
  const changes: number[][] = [];
  const bindings = {
    getName: () => 'Accelerate',
    getKeyName: () => 'W',
    setBindKey: (...args: number[]) => changes.push(args),
  };
  const stage = new Stage();
  const row = new Row(bindings, 11, 20, 40);
  stage.addChild(row);
  const touch = { interactsWith: (button: any) => button === row.buttonOne };
  row.buttonOne.callback(touch);
  assert.equal(row.buttonOne.text, 'Push a Button');
  for (const type of ['keyDown', 'touch', 'rightClick'])
    assert.equal(stage.listeners(type).length, 1);
  stage.dispatch({
    type: 'keyDown',
    keyCode: 27,
    setCurrentTarget() {},
    stopImmediatePropagation() {},
  });
  assert.equal(row.buttonOne.text, 'W');
  assert.deepEqual(changes, []);
  row.buttonOne.callback(touch);
  row.buttonOne.callback(touch);
  assert.deepEqual(changes, [[-2, 11, 1]]);
  row.buttonOne.callback(touch);
  stage.dispatch({ type: 'rightClick', setCurrentTarget() {} });
  assert.deepEqual(changes, [
    [-2, 11, 1],
    [-3, 11, 1],
  ]);
  row.buttonOne.callback(touch);
  row.removeFromParent(true);
  assert.equal(row.get_stage(), null);
  for (const type of ['keyDown', 'touch', 'rightClick'])
    assert.equal(stage.listeners(type).length, 0);
  row.dispose();
  assert.equal(changes.length, 2);
});
