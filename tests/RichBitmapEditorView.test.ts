import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RichBitmapEditorView } from '../src/chat/rich/RichBitmapEditorView';
import { RichBitmapEditorModel } from '../src/chat/rich/RichBitmapEditorModel';
import { bitmapRendererFixture } from './fixtures/BitmapRenderer';

test('bitmap editor draws source styles and uses actual atlas advances for cursor and selection', (t) => {
  const fixture = bitmapRendererFixture('verdana16_bitmap');
  t.after(fixture.cleanup);
  const model = new RichBitmapEditorModel(16);
  model.text = "A<font color='#ff0000'>B</font>C";
  const view = new RichBitmapEditorView(
    fixture.resolve,
    model,
    new fixture.BitmapFormat(fixture.font, 16),
  );
  t.after(() => view.dispose());
  view.setBounds(200, 30);
  view.setFocus(true);
  const [selection, renderer, cursor] = view.node.children;
  assert.deepEqual(
    renderer.characterBatch.meshes.map((mesh: any) => mesh.color),
    [0xffffff, 0xff0000, 0xffffff],
  );
  const advanceA = fixture.font.getChar(65).xAdvance;
  const advanceB = fixture.font.getChar(66).xAdvance;
  view.selectAt(advanceA + advanceB * 0.2);
  assert.equal(model.selectionActive, 1);
  assert.equal(cursor.get_x(), Math.round(advanceA));
  assert.equal(cursor.get_visible(), true);
  view.selectAt(advanceA + advanceB * 0.8, true);
  assert.equal(model.selectedVisibleText, 'B');
  assert.equal(selection.get_x(), advanceA);
  assert.equal(selection.get_width(), advanceB);
  assert.equal(selection.get_visible(), true);
  assert.equal(cursor.get_visible(), false);
  view.setFocus(false);
  assert.equal(selection.get_visible(), false);
});

test('caret scrolling, clipped selection and resizing share the source two-pixel margin', (t) => {
  const fixture = bitmapRendererFixture('verdana16_bitmap');
  t.after(fixture.cleanup);
  const model = new RichBitmapEditorModel(16);
  model.text = 'AAAAAAAAAA';
  model.select(10);
  const view = new RichBitmapEditorView(
    fixture.resolve,
    model,
    new fixture.BitmapFormat(fixture.font, 16),
  );
  t.after(() => view.dispose());
  view.setBounds(40, 30);
  view.setFocus(true);
  const [selection, renderer, cursor] = view.node.children;
  assert.equal(cursor.get_x(), 38);
  assert.ok(renderer.get_x() < 0);
  model.select(0, 10);
  view.refresh();
  assert.equal(selection.get_x(), 0);
  assert.equal(selection.get_width(), 38);
  view.selectAt(38);
  assert.equal(model.selectionActive, 10);
  view.setBounds(1000, 30);
  assert.equal(Math.abs(renderer.get_x()), 0);
  assert.equal(cursor.get_x(), Math.round(10 * fixture.font.getChar(65).xAdvance));
  view.selectAt(0);
  assert.equal(model.selectionActive, 0);
});

test('password view masks whole clusters and disposes its separate clipping mask', (t) => {
  const fixture = bitmapRendererFixture('verdana16_bitmap');
  t.after(fixture.cleanup);
  const model = new RichBitmapEditorModel(16);
  model.text = 'A👨‍👩‍👧B';
  model.password = true;
  const view = new RichBitmapEditorView(
    fixture.resolve,
    model,
    new fixture.BitmapFormat(fixture.font, 16),
  );
  view.setBounds(200, 30);
  const renderer = view.node.children[1];
  const mask = view.node.get_mask();
  assert.equal(renderer.text, '***');
  view.dispose();
  view.dispose();
  assert.equal(mask.disposed, true);
  assert.equal(renderer.disposed, true);
  assert.equal(view.node.get_mask(), null);
});
