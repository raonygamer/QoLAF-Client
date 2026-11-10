import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EmojiPickerCatalog } from '../src/chat/EmojiPickerCatalog';
import { ChatEmojiPickerModel } from '../src/chat/ChatEmojiPickerModel';
import { EmojiGlyphLookup } from '../src/chat/rich/EmojiGlyphLookup';
import { createChatEmojiPicker } from '../src/ported/ChatEmojiPicker';
import { bitmapRendererFixture } from './fixtures/BitmapRenderer';

test('picker catalog covers all 1391 source atlas glyphs and model paging reaches every category', (t) => {
  const bitmap = bitmapRendererFixture('verdana48_bitmap');
  t.after(bitmap.cleanup);
  const unique = new Set<number>(),
    model = new ChatEmojiPickerModel();
  let count = 0;
  for (let category = 0; category < model.categoryCount; category++) {
    model.selectCategory(category);
    assert.equal(model.scrollRow, 0);
    for (let index = 0; index < model.categoryLength; index++) {
      const scalar = EmojiPickerCatalog.scalarAt(category, index);
      unique.add(scalar);
      count++;
      assert.ok(
        bitmap.font.getChar(EmojiGlyphLookup.glyphIdForScalar(scalar)),
        `missing atlas glyph ${scalar.toString(16)}`,
      );
    }
    model.setScrollRatio(1);
    assert.equal(model.scrollRow, model.maxScrollRow);
    assert.equal(model.scrollByRows(1), false);
    model.pageBy(-100);
    assert.equal(model.scrollRow, 0);
  }
  assert.equal(count, 1391);
  assert.equal(unique.size, 1391);
  assert.equal(model.visibleScalarAt(-1), 0);
  assert.equal(model.visibleScalarAt(60), 0);
  assert.equal(model.selectCategory(8), false);
});

test('source emoji panel draws atlas glyphs and selects categories/cells with integer indices', (t) => {
  const bitmap = bitmapRendererFixture('verdana48_bitmap');
  t.after(bitmap.cleanup);
  const definitions: Record<string, any> = {
    'starling.core.Starling': class {},
    'starling.display.Stage': bitmap.Sprite,
    'starling.events.Touch': class {},
    'starling.events.TouchEvent': { TOUCH: 'touch' },
    'starling.events.TouchPhase': {
      BEGAN: 'began',
      MOVED: 'moved',
      STATIONARY: 'stationary',
      ENDED: 'ended',
      HOVER: 'hover',
    },
    'openfl.events.MouseEvent': { MOUSE_WHEEL: 'mouseWheel' },
  };
  const Picker = createChatEmojiPicker((name) => definitions[name] ?? bitmap.resolve(name));
  const picker = new Picker();
  t.after(() => picker.dispose());
  assert.equal(picker.buttonGlyphs.meshes.length, 1);
  assert.equal(picker.panelGlyphs.meshes.length, 68);
  for (const mesh of picker.panelGlyphs.meshes) {
    assert.ok(Number.isFinite(mesh.x));
    assert.ok(Number.isFinite(mesh.y));
    assert.equal(mesh.color, 0xffffff);
  }
  picker.open();
  assert.equal(picker.isOpen, true);
  const touch = (x: number, y: number, phase = 'ended') =>
    picker.panel.dispatch({
      type: 'touch',
      target: picker.panel,
      currentTarget: picker.panel,
      setCurrentTarget() {},
      stopImmediatePropagation() {},
      getTouch: () => ({
        phase,
        cancelled: false,
        getLocation: (_target: any, point: any) => Object.assign(point, { x, y }),
      }),
    });
  touch(60, 12);
  assert.equal(picker.model.categoryIndex, 1);
  touch(369, 170, 'began');
  touch(369, 180, 'ended');
  assert.ok(picker.model.scrollRow > 0);
  touch(15, 12);
  assert.equal(picker.model.categoryIndex, 0);
  assert.equal(picker.model.scrollRow, 0);
  let selected = '';
  picker.addEventListener(Picker.EVENT_EMOJI_SELECTED, (event: any) => {
    selected = event.data;
  });
  touch(20, 45);
  assert.equal(selected, String.fromCodePoint(0x1f600));
  assert.equal(picker.isOpen, false);
  assert.equal(Picker.unicodeForScalar(0x2764), '❤️');
});
