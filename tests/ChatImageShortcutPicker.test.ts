import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createChatImageShortcutPicker } from '../src/ported/ChatImageShortcutPicker';
import { createChatComposerFormatButton } from '../src/ported/ChatComposerFormatButton';
import { ChatImageShortcutStore } from '../src/chat/ChatImageShortcutStore';
import { bitmapRendererFixture } from './fixtures/BitmapRenderer';
import { Text } from './fixtures/NativeGame';

function fixture() {
  const bitmap = bitmapRendererFixture('verdana48_bitmap');
  class Input extends bitmap.Sprite {
    text = '';
    prompt = '';
    hasFocus = false;
    clearFocus() {
      this.hasFocus = false;
    }
  }
  const definitions: Record<string, any> = {
    'starling.display.Stage': bitmap.Sprite,
    'starling.text.TextField': Text,
    'starling.events.Event': { TRIGGERED: 'triggered', REMOVED_FROM_STAGE: 'removedFromStage' },
    'starling.events.Touch': class {},
    'starling.events.TouchEvent': { TOUCH: 'touch' },
    'starling.events.TouchPhase': { BEGAN: 'began', ENDED: 'ended' },
    'core.hud.components.chat.rich.RichBitmapChatTextInput': Input,
  };
  const resolve = (name: string): any => definitions[name] ?? bitmap.resolve(name);
  definitions['core.hud.components.chat.ChatComposerFormatButton'] =
    createChatComposerFormatButton(resolve);
  const warmed: string[] = [];
  const prefetch = (link: { rawUrl: string }) => warmed.push(link.rawUrl);
  const store = new ChatImageShortcutStore(
    { get: (_key, fallback) => fallback, set() {} },
    prefetch,
  );
  const Picker = createChatImageShortcutPicker(resolve, prefetch);
  const picker = new Picker(store);
  const stage = new bitmap.Sprite();
  Object.defineProperty(picker, 'stage', { value: stage });
  return {
    picker,
    store,
    stage,
    warmed,
    cleanup() {
      picker.dispose();
      bitmap.cleanup();
    },
  };
}

test('original image picker geometry, bitmap input contract and validation feedback', (t) => {
  const f = fixture();
  t.after(f.cleanup);
  const { picker } = f;
  assert.equal(picker.panel.x, -394);
  assert.equal(picker.panel.y, -242);
  assert.equal(picker.panel.children[0].width, 430);
  assert.equal(picker.panel.children[0].height, 236);
  assert.equal(picker.aliasInput.width, 105);
  assert.equal(picker.aliasInput.prompt, 'shortcut');
  assert.equal(picker.aliasInput.maxChars, 32);
  assert.equal(picker.urlInput.x, 117);
  assert.equal(picker.urlInput.width, 232);
  assert.equal(picker.urlInput.maxChars, 4096);
  assert.equal(picker.isOpen, false);
  picker.button.dispatchEventWith('triggered');
  assert.equal(picker.isOpen, true);
  assert.equal(picker.status.text, 'Add a shortcut, then use :name: or click it.');
  picker.aliasInput.text = 'bad name';
  picker.urlInput.text = 'https://example.test/a.png';
  picker.saveButton.dispatchEventWith('triggered');
  assert.match(picker.status.text, /Shortcut must/);
  assert.equal(picker.aliasInput.text, 'bad name');
  picker.aliasInput.text = ' Cat ';
  picker.saveButton.dispatchEventWith('triggered');
  assert.equal(picker.status.text, 'Saved :cat:');
  assert.equal(picker.aliasInput.text, '');
  assert.equal(picker.urlInput.text, '');
  assert.equal(picker.rowSprites[0].children[0].label.text, ':cat:');
  assert.equal(f.store.resolve('cat'), 'https://example.test/a.png');
  picker.aliasInput.hasFocus = true;
  picker.enabled = false;
  assert.equal(picker.isOpen, false);
  assert.equal(picker.aliasInput.hasFocus, false);
  picker.open();
  assert.equal(picker.isOpen, false);
});

test('picker pagination, selection, removal and outside-click lifecycle preserve source behavior', (t) => {
  const f = fixture();
  t.after(f.cleanup);
  const { picker, store, stage } = f;
  for (let i = 0; i < 7; i++) store.save(`image${i}`, `https://example.test/${i}.gif`);
  picker.open();
  assert.equal(picker.rowSprites.length, 5);
  assert.equal(picker.status.text, 'Page 1/2  •  7 saved');
  assert.equal(picker.prevButton.enabled, false);
  assert.equal(picker.nextButton.enabled, true);
  picker.nextButton.dispatchEventWith('triggered');
  assert.equal(picker.rowSprites.length, 2);
  assert.equal(picker.nextButton.enabled, false);
  assert.equal(picker.rowSprites[0].y, 46);
  assert.equal(picker.rowSprites[1].y, 76);
  picker.aliasInput.text = 'image6';
  picker.urlInput.text = 'https://example.test/replaced.gif';
  picker.saveButton.dispatchEventWith('triggered');
  assert.equal(picker.page, 1); // AS3 int division, not fractional 6 / 5.
  let selected = '';
  picker.addEventListener('imageShortcutSelected', (event: any) => (selected = event.data));
  picker.rowSprites[1].children[0].dispatchEventWith('triggered');
  assert.equal(selected, 'https://example.test/replaced.gif');
  assert.equal(picker.isOpen, false);
  assert.equal(stage.listeners('touch').length, 0);
  picker.open();
  const oldRow = picker.rowSprites[0];
  oldRow.children[2].dispatchEventWith('triggered');
  assert.equal(store.resolve('image0'), null);
  assert.equal(oldRow.disposed, true);
  assert.equal(picker.status.text, 'Removed :image0:');
  const outsideTouch = (target: any) =>
    stage.dispatch({
      type: 'touch',
      currentTarget: stage,
      setCurrentTarget() {},
      getTouch: () => ({ target }),
    });
  outsideTouch(picker.aliasInput);
  assert.equal(picker.isOpen, true);
  outsideTouch(stage);
  assert.equal(picker.isOpen, false);
  assert.equal(stage.listeners('touch').length, 0);
});
