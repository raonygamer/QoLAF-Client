import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseHTML } from 'linkedom';
import { pickAutomationFile } from '../src/Automation/AutomationFilePicker';

test('browser automation file dialog resolves selection or cancellation and removes its input', async (t) => {
  const { document, Event } = parseHTML('<html><body></body></html>');
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: document });
  t.after(() =>
    previous
      ? Object.defineProperty(globalThis, 'document', previous)
      : delete (globalThis as any).document,
  );
  const selected = new AbortController();
  const pending = pickAutomationFile(selected.signal);
  const input = document.querySelector('input')!;
  const file = { name: 'Module.js', text: async () => 'export default class Module {}' };
  Object.defineProperty(input, 'files', { value: [file] });
  input.dispatchEvent(new Event('change'));
  assert.equal(await pending, file);
  assert.equal(document.querySelector('input'), null);
  const cancelled = pickAutomationFile(new AbortController().signal);
  document.querySelector('input')!.dispatchEvent(new Event('cancel'));
  assert.equal(await cancelled, null);
  const controller = new AbortController();
  const closed = pickAutomationFile(controller.signal);
  controller.abort();
  assert.equal(await closed, null);
  assert.equal(document.querySelector('input'), null);
  assert.equal(await pickAutomationFile(controller.signal), null);
});
