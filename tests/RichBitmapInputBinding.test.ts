import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RichBitmapEditorModel } from '../src/chat/rich/RichBitmapEditorModel';
import { RichBitmapInputBinding } from '../src/chat/rich/RichBitmapInputBinding';

class Input extends EventTarget {
  value = '';
  selectionStart = 0;
  selectionEnd = 0;
  selectionDirection = 'forward';
  ownerDocument = Object.assign(new EventTarget(), { activeElement: this });
  setSelectionRange(begin: number, end: number, direction = 'forward'): void {
    this.selectionStart = begin;
    this.selectionEnd = end;
    this.selectionDirection = direction;
  }
  emit(name: string, properties: Record<string, unknown> = {}): Event {
    const event = new Event(name, { cancelable: true });
    Object.assign(event, properties);
    this.dispatchEvent(event);
    return event;
  }
}

function fixture(source = '', resolver: Function | null = null) {
  const model = new RichBitmapEditorModel(13, 0xffffff, resolver);
  model.text = source;
  const input = new Input();
  let changes = 0;
  const binding = new RichBitmapInputBinding(
    model,
    input as unknown as HTMLInputElement,
    () => changes++,
  );
  const type = (data: string) => input.emit('beforeinput', { inputType: 'insertText', data });
  return { model, input, binding, type, changes: () => changes };
}

test('browser typing edits visible selections while preserving source styles and continuation', () => {
  const { model, input, type, changes } = fixture("A<font color='#ff0000'>BC</font>Z");
  input.setSelectionRange(1, 3, 'backward');
  assert.equal(type('日本').defaultPrevented, true);
  assert.equal(input.value, 'A日本Z');
  model.select(1, 3);
  assert.equal(model.selectedColor, 0xff0000);
  assert.equal(changes(), 1);

  const second = fixture();
  second.type('<font color="#f00">red</font');
  second.type('>');
  second.input.emit('select');
  second.type(' normal');
  second.model.select(4, 10);
  assert.equal(second.model.selectedColor, 0xffffff);
  assert.equal(second.input.value, 'red normal');
});

test('composition leaves native provisional buffer alone and confirms one source edit', () => {
  const { input, model, changes } = fixture('AZ');
  input.setSelectionRange(1, 1);
  input.emit('compositionstart');
  let nativeEnter = 0;
  input.addEventListener('keydown', () => nativeEnter++);
  const confirmation = input.emit('keydown', { key: 'Enter', isComposing: true });
  assert.equal(confirmation.defaultPrevented, false);
  assert.equal(nativeEnter, 0);
  input.emit('compositionupdate', { data: 'に' });
  assert.equal(input.value, 'AZ');
  input.value = 'AにZ';
  input.emit('input', { isComposing: true });
  input.emit('compositionupdate', { data: '日本' });
  input.value = 'A日本Z';
  input.emit('input', { isComposing: true });
  input.emit('compositionend', { data: '日本' });
  const count = changes();
  input.emit('input', { isComposing: false });
  assert.equal(model.visibleText, 'A日本Z');
  assert.equal(changes(), count);
  assert.equal(input.selectionStart, 3);
});

test('clipboard copies atomic artifact tokens and paste inherits selected formatting', () => {
  const token = '$artifact:player:item$';
  const { model, input } = fixture(`A${token}Z`, () => ({ label: 'Artifact', color: 0xffaa44 }));
  const clipboard = new Map<string, string>();
  const clipboardData = {
    setData: (type: string, value: string) => clipboard.set(type, value),
    getData: (type: string) => clipboard.get(type) ?? '',
  };
  input.setSelectionRange(2, 4);
  input.emit('copy', { clipboardData });
  assert.equal(clipboard.get('text/plain'), token);
  input.emit('cut', { clipboardData });
  assert.equal(model.visibleText, 'AZ');
  input.emit('paste', { clipboardData });
  assert.equal(model.visibleText, 'AArtifactZ');
  assert.equal(model.text, `A${token}Z`);
});

test('noncancelable input preserves surrounding formatting and rejected edits restore buffer', () => {
  const { model, input } = fixture("A<font color='#ff0000'>old</font>Z");
  input.value = 'AnewZ';
  input.emit('input', { inputType: 'insertReplacementText' });
  model.select(1, 4);
  assert.equal(model.selectedColor, 0xff0000);
  model.maxChars = model.text.length;
  input.value = 'AnewZ plus too much';
  input.emit('input');
  assert.equal(input.value, 'AnewZ');
});

test('external assignment invalidates composition and disposal removes event handlers', () => {
  const { input, model, binding, changes, type } = fixture();
  input.emit('compositionstart');
  input.emit('compositionupdate', { data: 'draft' });
  binding.setText('/echo');
  input.emit('compositionend', { data: 'late' });
  assert.equal(input.value, '/echo');
  assert.equal(model.text, '/echo');
  const count = changes();
  binding.dispose();
  binding.dispose();
  type('ignored');
  assert.equal(changes(), count);
  assert.equal(model.text, '/echo');
});

test('native replacement diffs do not split common emoji prefixes or artifact labels', () => {
  const { model, input } = fixture('A😀Z');
  input.value = 'A😁Z';
  input.emit('input');
  assert.equal(model.visibleText, 'A😁Z');
  const artifact = fixture('A$artifact:player:item$Z', () => ({
    label: 'Artifact',
    color: 0xffffff,
  }));
  artifact.input.value = 'AArtXfactZ';
  artifact.input.emit('input');
  assert.equal(artifact.model.visibleText, 'AArtXfactZ');
  assert.equal(artifact.model.text.includes('$artifact'), false);
});

test('password fields cannot copy or cut and read-only fields cannot paste', () => {
  const { input, model } = fixture('secret');
  input.setSelectionRange(0, 6);
  model.password = true;
  let copied = false;
  const clipboardData = {
    setData: () => {
      copied = true;
    },
    getData: () => 'replace',
  };
  assert.equal(input.emit('cut', { clipboardData }).defaultPrevented, true);
  assert.equal(copied, false);
  assert.equal(model.text, 'secret');
  model.editable = false;
  input.emit('paste', { clipboardData });
  assert.equal(model.text, 'secret');
});
