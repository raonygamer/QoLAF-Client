import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RichBitmapEditorModel } from '../src/chat/rich/RichBitmapEditorModel';
import { RichBitmapComposition } from '../src/chat/rich/RichBitmapComposition';

test('IME revisions preserve formatted suffix and confirm exactly once', () => {
  const editor = new RichBitmapEditorModel();
  editor.text = "A<font color='#ff0000'>old</font>Z";
  editor.select(1, 4);
  const composition = new RichBitmapComposition(editor);
  const session = composition.start();
  composition.update(session, 'に');
  assert.equal(editor.visibleText, 'AにZ');
  composition.update(session, '日本', 0, 2);
  assert.equal(editor.selectedVisibleText, '日本');
  assert.equal(editor.selectedColor, 0xff0000);
  composition.finish(session, '日本語');
  assert.equal(editor.visibleText, 'A日本語Z');
  assert.equal(editor.selectionActive, 4);
  assert.equal(composition.finish(session, '日本語'), false);
  assert.equal(editor.visibleText, 'A日本語Z');
});

test('rejected and filtered revisions retain the accepted composition range', () => {
  const editor = new RichBitmapEditorModel();
  editor.text = 'AZ';
  editor.select(1);
  editor.maxChars = 4;
  editor.filterText = (value) => value.replace(/[0-9]/g, '');
  const composition = new RichBitmapComposition(editor);
  const session = composition.start();
  composition.update(session, 'a1b');
  assert.equal(editor.visibleText, 'AabZ');
  composition.update(session, 'too long');
  assert.equal(editor.visibleText, 'AabZ');
  composition.update(session, 'c');
  assert.equal(editor.visibleText, 'AcZ');
  composition.finish(session, '日');
  assert.equal(editor.visibleText, 'A日Z');
});

test('cancel restores exact markup and reversed selection; old sessions cannot edit', () => {
  const editor = new RichBitmapEditorModel();
  const source = 'A<font color="#f00">BC</font>D';
  editor.text = source;
  editor.select(3, 1);
  const composition = new RichBitmapComposition(editor);
  const old = composition.start();
  composition.update(old, '仮');
  composition.cancel(old);
  assert.equal(editor.text, source);
  assert.equal(editor.selectionAnchor, 3);
  assert.equal(editor.selectionActive, 1);
  const current = composition.start();
  assert.equal(composition.update(old, 'stale'), false);
  assert.equal(composition.finish(old, 'stale'), false);
  composition.finish(current, '新');
  assert.equal(editor.visibleText, 'A新D');
});

test('composition stays literal and treats selected emoji as whole clusters', () => {
  const editor = new RichBitmapEditorModel();
  editor.text = 'A👨‍👩‍👧Z';
  editor.select(2, 3);
  const composition = new RichBitmapComposition(editor);
  const session = composition.start();
  composition.update(session, '<b>日本</b>');
  assert.equal(editor.visibleText, 'A<b>日本</b>Z');
  composition.finish(session, '<b>日本</b>');
  assert.equal(editor.visibleText, 'A<b>日本</b>Z');
});

test('discard preserves external assignments and invalidates pending confirmation', () => {
  const editor = new RichBitmapEditorModel();
  const composition = new RichBitmapComposition(editor);
  const session = composition.start();
  composition.update(session, 'draft');
  editor.text = '/echo';
  composition.discard();
  assert.equal(composition.cancel(session), false);
  assert.equal(composition.finish(session, 'late'), false);
  assert.equal(editor.text, '/echo');
});
