import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSettingsAutomations } from '../src/Ported/SettingsAutomations';
import { AutomationManager } from '../src/Automation/AutomationManager';
import { Display } from './Fixtures/NativeGame';
import { aliasProperties } from '../src/Runtime/As3';

test('source automation page selects, starts, stops, confirms removal and detaches asynchronous UI', async (t) => {
  const cleanups: Function[] = [];
  aliasProperties({ defer: (fn: Function) => cleanups.push(fn) } as any, Display);
  t.after(() => cleanups.reverse().forEach((fn) => fn()));
  class Label extends Display {
    text = '';
    constructor(x = 0, y = 0) {
      super();
      this.set_x(x);
      this.set_y(y);
      this.set_height(24);
    }
  }
  class Button extends Label {
    constructor(
      public click: Function,
      public caption: string,
    ) {
      super();
    }
  }
  class Input extends Label {
    input = { element: { placeholder: '', style: {} } };
  }
  class List extends Display {
    rows: any[] = [];
    items: any[] = [];
    selected: any;
    set_rowHeight() {}
    set_labelField() {}
    set_dataProvider(items: any[]) {
      this.items = items;
      this.selected = null;
      this.dispatchEventWith('change');
    }
    set_selectedItem(item: any) {
      this.selected = item;
      this.dispatchEventWith('change');
    }
    get_selectedItem() {
      return this.selected;
    }
    rebuild() {}
  }
  const messages: string[] = [];
  let confirm: Function = () => {},
    finishImport!: (value: any) => void;
  const first = {
    id: 'one',
    running: false,
    fileName: 'One.js',
    lastError: '',
    info: {
      name: 'One',
      version: '1',
      authors: ['A'],
      min_client_version: 1,
      website: '',
      description: '<safe>',
    },
  };
  const second = { ...first, id: 'two', info: { ...first.info, name: 'Two' } };
  const listeners = new Set<Function>();
  const calls: string[] = [];
  const manager: any = {
    modules: [first, second],
    storagePath: 'Browser storage',
    addEventListener(type: string, fn: Function) {
      assert.equal(type, AutomationManager.CHANGED);
      listeners.add(fn);
    },
    removeEventListener(_type: string, fn: Function) {
      listeners.delete(fn);
    },
    start(id: string) {
      calls.push('start:' + id);
      second.running = true;
      listeners.forEach((fn) => fn());
    },
    stop(id: string) {
      calls.push('stop:' + id);
      second.running = false;
      listeners.forEach((fn) => fn());
    },
    remove(id: string) {
      calls.push('remove:' + id);
      this.modules = this.modules.filter((m: any) => m.id !== id);
      listeners.forEach((fn) => fn());
    },
    importURL() {
      return new Promise((resolve) => (finishImport = resolve));
    },
  };
  const game = {
    automationManager: manager,
    showMessageDialog(text: string) {
      messages.push(text);
    },
    showErrorDialog(text: string) {
      messages.push(text);
    },
    showConfirmDialog(_text: string, accept: Function) {
      confirm = accept;
    },
  };
  const definitions: any = {
    'starling.display.Sprite': Display,
    'starling.events.Event': { CHANGE: 'change' },
    'core.hud.components.Text': Label,
    'core.hud.components.InputText': Input,
    'core.hud.components.Button': Button,
    'core.hud.components.ui.ScrollBox': Display,
    'core.hud.components.ui.ItemList': List,
    'core.text.RussoBitmapFontRegistry': {},
    'generics.Localize': { t: (text: string) => text },
  };
  const Page = createSettingsAutomations((name) => definitions[name] ?? {});
  const page = new Page(game);
  assert.equal(page.moduleList.get_width(), 398);
  assert.equal(page.moduleList.get_selectedItem(), first);
  page.moduleList.set_selectedItem(second);
  page.startButton.click();
  assert.equal(page.selectedModule, second);
  assert.equal(page.startButton.enabled, false);
  assert.equal(page.stopButton.enabled, true);
  page.stopButton.click();
  page.removeButton.click();
  assert.equal(manager.modules.length, 2, 'removal waits for native confirmation');
  confirm();
  assert.equal(manager.modules.length, 1);
  assert.equal(page.selectedModule, first);
  assert.deepEqual(calls, ['start:two', 'stop:two', 'remove:two']);
  const pending = page.importURL();
  page.removeButton.click();
  page.dispose();
  assert.equal(listeners.size, 0);
  confirm();
  finishImport(second);
  await pending;
  assert.equal(messages.length, 0, 'completion after page disposal cannot show dialogs');
  assert.equal(manager.modules.length, 1, 'stale confirmation cannot remove a module');
  const empty = new Page({ ...game, automationManager: { ...manager, modules: [] } });
  assert.equal(empty.emptyText.visible, true);
  assert.equal(empty.moduleList.visible, false);
  empty.dispose();
});
