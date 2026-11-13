import { bindGameClasses } from '../src/game/Bindings';
import type { API } from '../src/api/Types';
import { RussoBitmapFontRegistry } from '../src/ui/RussoBitmapFontRegistry';
import { VerdanaBitmapFontRegistry } from '../src/ui/VerdanaBitmapFontRegistry';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { layoutArtifactRecycle } from '../src/artifacts/ArtifactRecycleLayout';

class Label {
  x = 0;
  y = 0;
  width = 0;
  height = 16;
  text = '';
  format: any;
  wrap = false;
  autoSize = '';
  set_x(value: number) {
    this.x = value;
  }
  set_y(value: number) {
    this.y = value;
  }
  set_width(value: number) {
    this.width = value;
  }
  set_height(value: number) {
    this.height = value;
  }
  set_format(value: any) {
    this.format = value;
  }
  set_wordWrap(value: boolean) {
    this.wrap = value;
  }
  set_autoSize(value: string) {
    this.autoSize = value;
  }
  set_text(value: string) {
    this.text = value;
  }
  get_x() {
    return this.x;
  }
  get_y() {
    return this.y;
  }
  get_width() {
    return this.width;
  }
  get_height() {
    // Measure text after format, width and wrapping have been applied, as the
    // native field does. Geometry must not reuse the old unwrapped dimensions.
    return this.wrap ? Math.ceil((this.text.length * 7) / this.width) * 16 : this.height;
  }
}

for (const supporter of [false, true]) {
  for (const expanded of [false, true]) {
    test(`artifact recycle source layout: supporter=${supporter}, expanded=${expanded}`, () => {
      const classes: Record<string, any> = {
        'starling.text.TextFormat': class {
          constructor(
            public font: string,
            public size: number,
            public color: number,
            public align: string,
          ) {}
        },
        'core.text.RussoBitmapFontRegistry': { fontNameForSize: (size: number) => `Russo${size}` },
        'core.text.VerdanaBitmapFontRegistry': {
          fontNameForSize: (size: number) => `Verdana${size}`,
        },
        'generics.Localize': { t: (value: string) => `Localized ${value}` },
        'core.hud.components.Style': { COLOR_HIGHLIGHT: 0xffee44 },
      };
      const view: any = {
        expandedView: expanded,
        statsWidth: 320,
        infoWidth: 250,
        statsX: 600,
        statsY: 118,
        p: { hasSupporter: () => supporter },
      };
      for (const key of [
        'recycleText',
        'recycleTextInfo',
        'autoRecycleText',
        'autoRecycleTextInfo',
        'buySupporter',
        'autoRecycleButton',
        'autoRecycleInput',
      ])
        view[key] = new Label();
      view.autoRecycleTextInfo.text =
        'A long localized description of the automatic artifact recycling threshold.'.repeat(3);
      view.autoRecycleButton.width = 81;
      view.buySupporter.height = 24;
      bindGameClasses({ cls: (name: string) => classes[name] ?? {} } as unknown as API);
      layoutArtifactRecycle(view);
      assert.equal(view.recycleTextInfo.width, expanded ? 590 : 200);
      assert.equal(view.recycleTextInfo.format.font, VerdanaBitmapFontRegistry.fontNameForSize(13));
      assert.equal(view.recycleText.format.font, RussoBitmapFontRegistry.fontNameForSize(13));
      assert.equal(view.recycleTextInfo.format.color, 0xffffff);
      assert.equal(view.recycleTextInfo.wrap, true);
      assert.match(
        view.recycleTextInfo.text,
        /^Localized .* Favorite artifacts must be unfavorited first\.$/,
      );
      assert.equal(view.recycleTextInfo.y, 136);
      assert.equal(view.autoRecycleText.y, 146 + view.recycleTextInfo.get_height());
      assert.equal(view.autoRecycleTextInfo.y, view.autoRecycleText.y + 18);
      const controlsY = view.autoRecycleTextInfo.y + view.autoRecycleTextInfo.get_height() + 10;
      assert.equal(view.buySupporter.y, controlsY);
      assert.equal(view.autoRecycleButton.y, controlsY + (supporter ? 0 : 34));
      assert.equal(view.autoRecycleInput.y, view.autoRecycleButton.y);
      assert.equal(view.autoRecycleInput.x, (expanded ? 600 : 380) + 86);
    });
  }
}
