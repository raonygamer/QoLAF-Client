import assert from 'node:assert/strict';
import { test } from 'node:test';
import { installWrapTextMeasurement } from '../src/UI/NativeWrapTextMeasurement';
import type { Raw } from '../src/Api/Types';
// @ts-expect-error actual host hook implementation
import { Hooks } from './Fixtures/HostCore.js';

test('tooltip layout uses rendered bitmap metrics and retains native extraction, fallback, and cleanup', () => {
  const fields: Field[] = [];
  class Format {
    constructor(
      public font = 'bitmap',
      public size = 11,
    ) {}
    get_font() {
      return this.font;
    }
    clone() {
      return new Format(this.font, this.size);
    }
  }
  class Field {
    static getBitmapFont(name: string) {
      return name === 'bitmap' ? {} : null;
    }
    disposed = false;
    wraps = false;
    constructor(
      public width: number,
      _height: number,
      public text: string,
      public format: Format,
    ) {
      fields.push(this);
    }
    set_autoScale() {}
    set_isHtmlText() {}
    set_autoSize() {}
    set_format(value: Format) {
      this.format = value;
    }
    set_wordWrap(value: boolean) {
      this.wraps = value;
    }
    set_width(value: number) {
      this.width = value;
    }
    set_text(value: string) {
      this.text = value;
    }
    get_textBounds() {
      const advance = this.text.length * this.format.size;
      return {
        width: this.wraps ? Math.min(this.width, advance) : advance,
        height: (this.wraps ? Math.ceil(advance / this.width) : 1) * 16,
      };
    }
    dispose() {
      this.disposed = true;
    }
  }
  class Wrap {
    extractionCalls = 0;
    field = { get_format: () => this.format, get_text: () => this.text };
    text = 'Players present';
    format = new Format();
    measure(_width: number) {
      this.extractionCalls++;
      return { width: 7, height: 8 };
    }
    dispose() {}
  }
  const hooks = new Hooks(),
    cleanups: (() => void)[] = [];
  installWrapTextMeasurement({
    cls: (name: string) => (name.endsWith('WrapText') ? Wrap : Field),
    around: (target: Raw, key: string, fn: Function) =>
      cleanups.push(hooks.add(target, key, 'around', fn)),
    before: (target: Raw, key: string, fn: Function) =>
      cleanups.push(hooks.add(target, key, 'before', fn)),
    defer: (fn: () => void) => cleanups.push(fn),
  } as any);
  const tooltip = new Wrap();
  assert.deepEqual(tooltip.measure(0), { width: 165, height: 16 });
  assert.deepEqual(tooltip.measure(55), { width: 55, height: 48 });
  assert.equal(tooltip.extractionCalls, 2);
  assert.equal(fields.length, 1, 'reuse a private measuring field');
  tooltip.format.size = 20;
  assert.equal(tooltip.measure(0).width, 300);
  assert.notEqual(fields[0].format, tooltip.format, 'measurement must not mutate visible format');
  tooltip.format.font = 'native-outline-font';
  assert.deepEqual(tooltip.measure(0), { width: 7, height: 8 });
  const second = new Wrap();
  second.measure(0);
  tooltip.dispose();
  assert.equal(fields[0].disposed, true);
  assert.equal(fields[1].disposed, false);
  cleanups.reverse().forEach((fn) => fn());
  assert.equal(fields[1].disposed, true);
  assert.deepEqual(second.measure(0), { width: 7, height: 8 });
});
