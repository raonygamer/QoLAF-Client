import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Display, Quad } from './fixtures/NativeGame';
import { settingsControls } from '../src/settings/NativeControls';
// @ts-expect-error extracted upstream JavaScript
import makeScrollBox from './fixtures/UpstreamScrollBox.js';

test('settings scrollbar uses source skin while native page clicks and drag cover the full range', () => {
  function NativeSprite(this: any) {
    Object.assign(this, new Display());
  }
  NativeSprite.prototype = Object.create(Display.prototype);
  const replaced: Display[] = [];
  const Scroll = makeScrollBox(
    NativeSprite,
    Quad,
    {
      scrollThumb: () => {
        const thumb = new Quad(6, 12);
        replaced.push(thumb);
        return thumb;
      },
    },
    class {},
    class {},
  );
  const defs: any = {
    'core.hud.components.ui.CheckBox': Display,
    'core.hud.components.ui.Slider': Display,
    'core.hud.components.ui.ScrollBox': Scroll,
    'starling.display.Sprite': Display,
    'starling.display.Quad': Quad,
  };
  const Container = settingsControls((name) => defs[name])['feathers.controls.ScrollContainer'];
  const container = new Container();
  let bottom = 5000;
  container.contentBottom = () => bottom;
  container.set_width(730);
  container.set_height(500);
  assert.equal(replaced[0].disposed, true);
  const thumb = container.getThumb();
  assert.equal(thumb.get_touchable(), true);
  assert.equal(thumb.get_width(), 8);
  assert.equal(thumb.get_height(), 50);
  assert.equal(container.scrollBar.get_x(), 722);
  assert.equal(thumb.getChildAt(1).get_color(), 0x707070);
  assert.equal(thumb.getChildAt(2).get_color(), 0x505050);
  assert.equal(thumb.getChildAt(0).get_width(), 12);
  const touch = (phase: string, target: any, y: number) => {
    const value = {
      get_phase: () => phase,
      get_target: () => target,
      getLocation: () => ({ x: 725, y }),
      get_id: () => 0,
    };
    container.onTouch({
      getTouches: () => ({
        iterator: () => {
          let more = true;
          return {
            hasNext: () => more,
            next: () => {
              more = false;
              return value;
            },
          };
        },
      }),
    });
  };
  touch('began', thumb.getChildAt(0), 10);
  touch('moved', thumb.getChildAt(0), 460);
  touch('ended', thumb.getChildAt(0), 460);
  assert.equal(container.get_verticalScrollPosition(), 4500);
  assert.equal(thumb.get_y(), 450);
  touch('began', container.trackQuad, 20);
  assert.equal(
    container.get_verticalScrollPosition(),
    4000,
    'track click pages upward using native handling',
  );
  bottom = 50000;
  container.arrange();
  assert.equal(thumb.get_height(), 24);
  assert.equal(
    thumb.getChildAt(2).get_height(),
    22,
    'one-pixel borders do not scale with the thumb',
  );
  bottom = 100;
  container.arrange();
  assert.equal(container.scrollBar.get_visible(), false);
  assert.equal(container.get_verticalScrollPosition(), 0);
});
