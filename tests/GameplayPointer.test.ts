import assert from 'node:assert/strict';
import test from 'node:test';
import type { API } from '../src/api/Types';
import type { GameScene } from '../src/game/Bindings';
import { installGameplayPointer } from '../src/runtime/GameplayPointer';
// @ts-expect-error actual host dispatcher
import { Hooks } from './fixtures/HostCore.js';

test('world clicks preserve targeting and native press edges without accepting HUD clicks', () => {
  class Display {
    constructor(readonly parent: Display | null = null) {}
    get_parent() {
      return this.parent;
    }
  }
  class Stage extends Display {}
  const stage = new Stage();
  const canvas = new Display(stage);
  const unit = new Display(new Display(canvas));
  const hud = new Display(stage);
  let actions = 0;
  const input = {
    _isMousePressed: false,
    _mouseJustPressed: false,
    mouseDown(event: { target: Display }) {
      actions++;
      if (event.target instanceof Stage) {
        this._isMousePressed = true;
        this._mouseJustPressed = true;
      }
    },
    mouseUp() {
      this._isMousePressed = false;
    },
    reset() {
      this._mouseJustPressed = false;
    },
  };
  const hooks = new Hooks();
  const cleanup: Array<() => void> = [];
  const api = {
    cls: (name: string) => (name === 'starling.display.DisplayObject' ? Display : undefined),
    after: (target: object, name: string, callback: Function) =>
      cleanup.push(hooks.add(target, name, 'after', callback)),
  } as unknown as API;
  installGameplayPointer(api, {
    canvas,
    gameStateMachine: { inputManager: input },
  } as unknown as GameScene);
  const click = (target: Display) => {
    input.mouseUp();
    input.reset();
    input.mouseDown({ target });
  };
  for (const target of [stage, canvas, unit]) {
    click(target);
    assert.equal(input._isMousePressed, true);
    assert.equal(input._mouseJustPressed, true);
    input.reset();
    assert.equal(input._isMousePressed, true, 'fixed-tick reset preserves the held press');
    assert.equal(input._mouseJustPressed, false);
    input.mouseUp();
    assert.equal(input._isMousePressed, false);
  }
  click(hud);
  assert.equal(input._isMousePressed, false);
  assert.equal(input._mouseJustPressed, false);
  assert.equal(actions, 4, 'native activity notification occurs exactly once per click');
  cleanup.reverse().forEach((off) => off());
  click(unit);
  assert.equal(input._isMousePressed, false, 'unload restores the native stage-only path');
  click(stage);
  assert.equal(input._isMousePressed, true);
});
