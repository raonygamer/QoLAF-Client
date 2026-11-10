import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createChatComposerFormatButton } from '../src/ported/ChatComposerFormatButton';
import { createChatSelectionValueSlider } from '../src/ported/ChatSelectionValueSlider';
import { createChatSelectionFormatPopup } from '../src/ported/ChatSelectionFormatPopup';
import { bitmapRendererFixture } from './fixtures/BitmapRenderer';
import { Text } from './fixtures/NativeGame';

function fixture() {
  const bitmap = bitmapRendererFixture('verdana16_bitmap');
  class Sprite extends bitmap.Sprite {
    getChildByName(name: string) {
      return this.children.find((child) => child.name === name);
    }
    localToGlobal(point: any) {
      return { x: point.x + this.get_x(), y: point.y + this.get_y() };
    }
    globalToLocal(point: any) {
      return { x: point.x - this.get_x(), y: point.y - this.get_y() };
    }
  }
  // The native hex-field adapter is not connected yet. Exercise its contract,
  // while preview glyph rendering and all three ported controls are real.
  class HexInput extends Sprite {
    text = '';
    hasFocus = false;
    textEditorProperties = {};
    validate() {}
    setFocus() {
      this.hasFocus = true;
    }
    clearFocus() {
      this.hasFocus = false;
    }
    selectRange() {}
  }
  const definitions: Record<string, any> = {
    'starling.display.Sprite': Sprite,
    'starling.display.Stage': Sprite,
    'starling.text.TextField': Text,
    'starling.events.Event': {
      CHANGE: 'change',
      TRIGGERED: 'triggered',
      ADDED_TO_STAGE: 'addedToStage',
      REMOVED_FROM_STAGE: 'removedFromStage',
    },
    'starling.events.Touch': class {},
    'starling.events.TouchEvent': { TOUCH: 'touch' },
    'starling.events.TouchPhase': {
      BEGAN: 'began',
      MOVED: 'moved',
      STATIONARY: 'stationary',
      ENDED: 'ended',
      HOVER: 'hover',
    },
    'openfl.events.EventDispatcher': class {},
    'openfl.events.KeyboardEvent': { KEY_DOWN: 'keyDown' },
    'openfl.ui.Keyboard': { ENTER: 13, NUMPAD_ENTER: 108, UP: 38, DOWN: 40, TAB: 9 },
    'core.hud.components.chat.rich.RichBitmapChatTextInput': HexInput,
    'core.hud.components.chat.rich.RichBitmapFontTextEditor': class {},
  };
  const resolve = (name: string): any => definitions[name] ?? bitmap.resolve(name);
  const Slider = createChatSelectionValueSlider(resolve);
  definitions['core.hud.components.chat.ChatSelectionValueSlider'] = Slider;
  return {
    Slider,
    Button: createChatComposerFormatButton(resolve),
    Popup: createChatSelectionFormatPopup(resolve),
    cleanup: bitmap.cleanup,
  };
}

function touch(target: any, phase: string, x = 0, y = 0, cancelled = false) {
  let stopped = false;
  const point = {
    id: 7,
    phase,
    cancelled,
    getLocation: (_target: any, output: any) => Object.assign(output, { x, y }),
  };
  target.dispatch({
    type: 'touch',
    target,
    currentTarget: target,
    setCurrentTarget() {},
    stopImmediatePropagation() {
      stopped = true;
    },
    getTouch: () => point,
  });
  return stopped;
}

test('source format button preserves native colors, disabled state and touch isolation', (t) => {
  const f = fixture();
  t.after(f.cleanup);
  const button = new f.Button(48, 32, 'Color');
  t.after(() => button.dispose());
  let triggered = 0;
  button.addEventListener('triggered', () => triggered++);
  assert.equal(button.background.color, 0x252525);
  assert.equal(touch(button, 'hover'), true);
  assert.equal(button.background.color, 0x333333);
  touch(button, 'began');
  assert.equal(button.background.color, 0x454545);
  touch(button, 'ended', 0, 0, true);
  assert.equal(triggered, 0);
  touch(button, 'ended');
  assert.equal(triggered, 1);
  button.enabled = false;
  touch(button, 'ended');
  assert.equal(triggered, 1);
  assert.equal(button.background.color, 0x171717);
  assert.equal(button.label.format.color, 0x666666);
});

test('source slider has full-height hit area, snapped drag values and silent programmatic updates', (t) => {
  const f = fixture();
  t.after(f.cleanup);
  const slider = new f.Slider(12, 48, 1, 250, 24);
  t.after(() => slider.dispose());
  let changes = 0;
  slider.addEventListener('change', () => changes++);
  assert.equal(slider.interactionArea.height, 24);
  assert.equal(slider.interactionArea.alpha, 0.001);
  slider.value = NaN;
  assert.equal(slider.value, 12);
  slider.value = 999;
  assert.equal(slider.value, 48);
  assert.equal(changes, 0);
  touch(slider, 'began', 125, 2);
  assert.equal(slider.value, 30);
  assert.equal(slider.knob.x, 119);
  assert.equal(changes, 1);
  touch(slider, 'moved', -50, 2);
  assert.equal(slider.value, 12);
  touch(slider, 'ended');
  assert.equal(slider.activeTouchID, -1);
});

test('format popup preserves mixed preview styles, bounds and hexadecimal editing contract', (t) => {
  const f = fixture();
  t.after(f.cleanup);
  const popup = new f.Popup();
  t.after(() => popup.dispose());
  assert.equal(popup.menuRows.length, 4);
  assert.equal(popup.menuIndexAt(2, 35.5), 1);
  popup.setValues(0x112233, 14);
  popup.setSelectionPreview("<font size='24' color='#ff0000'>A</font>B");
  popup.showColorPanel();
  assert.equal(popup.detailBackground.height, 228);
  assert.equal(popup.hexInput.text, '112233');
  assert.ok(popup.previewRenderer.text.includes("size='24'"));
  assert.equal(popup.previewRenderer.characterBatch.meshes[0].color, 0x112233);
  let selectedColor = 0;
  popup.addEventListener(f.Popup.COLOR_CHANGE, (event: any) => (selectedColor = event.data));
  popup.hexInput.text = 'abcdef';
  popup.hexInput.dispatchEventWith('change');
  assert.equal(selectedColor, 0xabcdef);
  popup.hexInput.text = 'bad';
  popup.hexInput.dispatchEventWith('focusOut');
  assert.equal(popup.hexInput.text, 'ABCDEF');
  popup.showSizePanel();
  assert.equal(popup.detailBackground.height, 166);
  assert.equal(popup.hexInput.visible, false);
  assert.equal(popup.previewRenderer.characterBatch.meshes[0].color, 0xff0000);
  popup.showMenu(10, 20);
  assert.equal(popup.menuPanel.x, 10);
  assert.equal(popup.isOpen, true);
  popup.close();
  assert.equal(popup.isOpen, false);
});

test('format detail panels flip above the composer and clamp to the stage', (t) => {
  const f = fixture();
  t.after(f.cleanup);
  const popup = new f.Popup();
  t.after(() => popup.dispose());
  const listeners = new Set<Function>();
  Object.defineProperty(popup, 'stage', {
    value: {
      stageWidth: 500,
      stageHeight: 400,
      addEventListener: (_name: string, fn: Function) => listeners.add(fn),
      removeEventListener: (_name: string, fn: Function) => listeners.delete(fn),
    },
  });
  popup.setPanelAnchor(460, 390, 360);
  popup.setValues(0xffffff, 24.8);
  assert.equal(popup.selectedSize, 24);
  popup.showSizePanel();
  assert.equal(popup.detailPanel.x, 164);
  assert.equal(popup.detailPanel.y, 194);
  assert.equal(listeners.size, 1);
  popup.selectedSize = NaN;
  assert.equal(popup.selectedSize, 12);
  popup.close();
  assert.equal(listeners.size, 0);
});
