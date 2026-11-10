import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRadioMarqueeTextRenderer } from '../src/radio/RadioMarqueeTextRenderer';
import { createRadioPopup } from '../src/radio/RadioPopup';
import { createRadioSlider } from '../src/radio/RadioSlider';
import { bitmapRendererFixture } from './fixtures/BitmapRenderer';
import { Display, Quad } from './fixtures/NativeGame';
// @ts-expect-error extracted native runtime
import makeSlider from './fixtures/UpstreamSlider.js';

// Uses the real bitmap layout and atlas metrics: repeated validation must retain
// the derived draw override, otherwise overflow resumes painting past the mask.
test('Radio marquee keeps clipping and animation after data/width changes', () => {
  const fixture = bitmapRendererFixture('verdana48_bitmap');
  try {
    const Marquee = createRadioMarqueeTextRenderer(fixture.resolve);
    const field: any = new Marquee();
    field.textFormat = new fixture.BitmapFormat(fixture.font, 12, 0xffffff);
    field.width = 80;
    field.height = 24;
    field.text = 'A long song title requiring a moving clipped viewport';
    field.validate();
    assert.ok(field.overflow > 80);
    assert.equal(field.mask.width, 80);
    field.width = 40;
    field.text += ' — changed';
    field.validate();
    assert.equal(field.mask.width, 40, 'base bound getter must not replace derived draw');
    Object.defineProperty(field, 'stage', { value: {}, configurable: true });
    field.added(null);
    for (let frame = 0; frame < 180; frame++) field.advance({ get_passedTime: () => 1 / 120 });
    assert.ok(field.elapsed > 1.25);
    assert.ok(Marquee.offsetAt(field.elapsed, field.overflow) < 0);
    field.visible = false;
    field.advance({ get_passedTime: () => 1 / 120 });
    assert.equal(field.elapsed, 0);
    field.text = 'a';
    field.validate();
    assert.equal(field.mask, null);
    field.dispose();
  } finally {
    fixture.cleanup();
  }
});

test('Radio seek sends one request on release and rejects a changed playback revision', () => {
  const Popup = createRadioPopup(() => Display, Display, {} as any);
  const view: any = Object.create(Popup.prototype);
  const calls: number[] = [];
  view.disposed = false;
  view.syncing = false;
  view.seeking = false;
  view.service = {
    available: true,
    rooms: { controller: true, state: { roomId: 'a', queue: [{}], playbackRevision: 1 } },
    seek: (value: number) => calls.push(value),
  };
  view.seekBar = { value: 1000, maximum: 20000 };
  view.timeLabel = { text: '' };
  Object.defineProperty(view, 'sync', { value: () => {} });
  view.beginSeek({});
  view.changeSeek({});
  view.seekBar.value = 9000;
  view.changeSeek({});
  assert.deepEqual(calls, []);
  view.endSeek({});
  assert.deepEqual(calls, [9000]);
  view.beginSeek({});
  view.seekBar.value = 12000;
  view.changeSeek({});
  view.service.rooms.state.playbackRevision++;
  view.endSeek({});
  assert.deepEqual(calls, [9000]);
  view.service.rooms.controller = false;
  view.changeSeek({});
  assert.deepEqual(calls, [9000]);
});

test('native Radio slider brackets changes with original begin/end events', () => {
  function NativeSprite(this: any) {
    Object.assign(this, new Display());
  }
  NativeSprite.prototype = Object.create(Display.prototype);
  const NativeSlider = makeSlider(NativeSprite, Quad, {
    sliderTrack: () => new Quad(152, 4),
    sliderThumb: () => new Quad(13, 13),
  });
  const Slider = createRadioSlider((name) =>
    name.endsWith('.Slider') ? NativeSlider : name.endsWith('.Quad') ? Quad : Display,
  );
  const slider = new Slider();
  slider.maximum = 180000;
  slider.step = 1000;
  slider.set_width(200);
  const events: string[] = [];
  for (const type of ['beginInteraction', 'change', 'endInteraction'])
    slider.addEventListener(type, () => events.push(type));
  const touch = (phase: string, x: number) =>
    slider.onTouch({
      getTouch: () => ({ get_phase: () => phase, getLocation: () => ({ x, y: 0 }) }),
    });
  touch('began', 50);
  touch('moved', 100);
  touch('ended', 100);
  assert.deepEqual(events, ['beginInteraction', 'change', 'change', 'endInteraction']);
  assert.equal(slider.get_value(), 90000);
  slider.isEnabled = false;
  touch('began', 150);
  assert.equal(slider.get_value(), 90000);
  slider.dispose();
});

test('Radio listener/leader controls preserve source queue and request routing', () => {
  const Popup = createRadioPopup(() => Display, Display, {} as any);
  const view: any = Object.create(Popup.prototype);
  const calls: any[] = [];
  view.disposed = false;
  Object.defineProperty(view, 'sync', { value: () => {} });
  view.service = {
    available: true,
    rooms: {
      host: false,
      joined: true,
      state: { shuffle: true, repeatMode: 'all', keepFinished: true },
    },
    acceptRequest: (id: string) => calls.push(['accept', id]),
    add: (query: string) => calls.push(['add', query]),
    setQueueModes: (...args: any[]) => calls.push(['modes', ...args]),
  };
  view.requestList = { selectedItem: { id: 'r' } };
  view.query = { text: '  ' };
  view.add(null);
  view.accept(null);
  assert.deepEqual(calls, []);
  view.query.text = 'https://www.youtube.com/watch?v=abcdefghijk';
  view.add(null);
  assert.equal(view.query.text, '');
  assert.deepEqual(calls[0], ['add', 'https://www.youtube.com/watch?v=abcdefghijk']);
  view.service.rooms.host = true;
  view.accept(null);
  view.toggleKeep(null);
  assert.deepEqual(calls.slice(1), [
    ['accept', 'r'],
    ['modes', true, 'off', false],
  ]);
});
