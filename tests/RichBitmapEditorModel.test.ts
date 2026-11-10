import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RichBitmapEditorModel as Editor } from '../src/chat/rich/RichBitmapEditorModel';

const token = '$artifact:player:item$';

test('selection formatting preserves surrounding styles, literal characters and source indices', () => {
  const editor = new Editor();
  editor.text = "A<font color='#ff0000'>BC</font>D";
  editor.select(1, 3);
  assert.equal(editor.selectedCopyText, 'BC');
  assert.equal(editor.selectedColor, 0xff0000);
  assert.equal(editor.selectedRichMarkup, "<font color='#ff0000'>BC</font>");
  assert.equal(editor.text.slice(editor.sourceSelectionBegin, editor.sourceSelectionEnd), 'BC');
  editor.applySelectionSize(100);
  assert.equal(editor.selectedSize, 48);
  editor.replaceSelection('<&');
  assert.equal(editor.visibleText, 'A<&D');
  editor.select(1, 3);
  assert.equal(editor.selectedColor, 0xff0000);
  assert.equal(editor.selectedSize, 48);
  assert.ok(editor.text.includes('&lt;&amp;'));
  editor.select(3, 1);
  editor.applySelectionColor(0x100aabbcc);
  assert.equal(editor.selectedColor, 0xaabbcc);
  assert.equal(editor.visibleText, 'A<&D');
});

test('typed fragments remain literal until valid, and closing markup restores the insertion style', () => {
  const editor = new Editor();
  editor.replaceSelection('<font color="#f00">red</font', true);
  assert.equal(editor.visibleText, '<font color="#f00">red</font');
  editor.replaceSelection('>', true);
  assert.equal(editor.visibleText, 'red');
  assert.equal(editor.selectionActive, 3);
  editor.replaceSelection(' normal', true);
  editor.select(4, 10);
  assert.equal(editor.selectedColor, 0xffffff);
  assert.equal(editor.visibleText, 'red normal');
  editor.select(0, 3);
  assert.equal(editor.selectedColor, 0xff0000);
});

test('typed promotion cannot turn a displayed example into a command or bypass global restrictions', () => {
  for (const value of ['<b>/disconnect game</b>', '<font size="13">/echo</font>']) {
    const editor = new Editor();
    editor.replaceSelection(value, true);
    assert.equal(editor.visibleText, value);
    assert.equal(editor.text.startsWith('/'), false);
  }
  const editor = new Editor();
  editor.replaceSelection('/global <font color="#f00">red</font>', true);
  assert.equal(editor.visibleText, '/global <font color="#f00">red</font>');
  editor.text = '';
  editor.filterText = (value) => value.replace(/[<>]/g, '');
  editor.replaceSelection('<font color="#f00">red</font>', true);
  assert.equal(editor.visibleText, 'font color="#f00"red/font');
});

test('artifact selections, deletion, copying and label refresh remain atomic', () => {
  let label = 'Artifact';
  const editor = new Editor(13, 0xffffff, () => ({ label, color: 0xffaa44 }));
  editor.text = `A${token}Z`;
  assert.equal(editor.visibleText, 'AArtifactZ');
  editor.select(2, 4);
  assert.equal(editor.selectedCopyText, token);
  assert.equal(editor.selectedVisibleText, 'Artifact');
  assert.equal(editor.selectedRichMarkup, token);
  label = 'A longer artifact';
  editor.refreshArtifactLabels();
  assert.equal(editor.selectedVisibleText, label);
  assert.equal(editor.selectedCopyText, token);
  editor.replaceSelection('new');
  assert.equal(editor.visibleText, 'AnewZ');
  assert.equal(editor.text.includes('$artifact'), false);
  editor.text = `A${token}Z`;
  editor.select(1);
  editor.deleteForward();
  assert.equal(editor.visibleText, 'AZ');
});

test('emoji clusters delete as a whole and maxChars counts serialized markup without blocking shortening', () => {
  const editor = new Editor();
  for (const emoji of ['😀', '☀️', '👨‍👩‍👧', '👍🏽', '🇧🇷']) {
    editor.text = `A${emoji}Z`;
    editor.select(1 + emoji.length);
    editor.backspace();
    assert.equal(editor.visibleText, 'AZ');
  }
  editor.text = 'abc';
  editor.maxChars = 3;
  editor.select(0, 3);
  assert.equal(editor.applySelectionColor(0xff0000), false);
  assert.equal(editor.text, 'abc');
  editor.text = 'over the limit';
  editor.select(0, 4);
  assert.equal(editor.replaceSelection(''), true);
  assert.equal(editor.visibleText, ' the limit');
  const before = editor.text;
  editor.select(editor.visibleText.length);
  assert.equal(editor.replaceSelection('more'), false);
  assert.equal(editor.text, before);
});

test('disabled editing, empty selection formatting and newline stripping follow source behavior', () => {
  const editor = new Editor();
  editor.replaceSelection('a\r\nb\rc\nd');
  assert.equal(editor.visibleText, 'abcd');
  assert.equal(editor.applySelectionColor(0xff0000), false);
  editor.select(0, 4);
  editor.editable = false;
  assert.equal(editor.replaceSelection('no'), false);
  assert.equal(editor.applySelectionSize(12), false);
  editor.editable = true;
  editor.enabled = false;
  assert.equal(editor.backspace(), false);
  assert.equal(editor.text, 'abcd');
});
