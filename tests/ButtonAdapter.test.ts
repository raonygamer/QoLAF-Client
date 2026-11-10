import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createButtonAdapter } from '../src/ui/ButtonAdapter';

test('source button height resizes its surfaces without stretching glyphs and selects the sized atlas', () => {
  class Surface {
    height = 26;
    set_height(value: number) {
      this.height = value;
    }
    get_height() {
      return this.height;
    }
  }
  class NativeButton {
    styleImage = new Surface();
    hoverImage = new Surface();
    scaleY = 1;
    tf: any;
    constructor(_callback: Function, _text: string, _style: string, size: number, font: string) {
      const format = {
        size,
        font,
        set_size(value: number) {
          this.size = value;
        },
        set_font(value: string) {
          this.font = value;
        },
      };
      this.tf = Object.assign(new Surface(), { get_format: () => format });
    }
    update() {}
  }
  const Button = createButtonAdapter(NativeButton, (name) => ({
    fontNameForSize: (size: number) => `${name.includes('Verdana') ? 'Verdana' : 'Russo'}:${size}`,
  }));
  const button = new Button(() => {}, 'General', 'normal', 13, 'Verdana');
  assert.equal(button.tf.get_format().font, 'Verdana:13');
  button.set_height(32);
  assert.equal(button.get_height(), 32);
  assert.equal(button.styleImage.height, 32);
  assert.equal(button.hoverImage.height, 32);
  assert.equal(button.scaleY, 1);
  assert.equal(button.tf.get_format().size, 13);
  button.set_size(20);
  assert.equal(button.tf.get_format().font, 'Verdana:20');
  const normal = new Button(() => {});
  assert.equal(normal.tf.get_format().font, 'Russo:13');
});
