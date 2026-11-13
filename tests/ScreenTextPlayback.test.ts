import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ScreenTextPlayback,
  type ScreenTextHost,
  type ScreenTextClock,
} from '../src/ui/ScreenTextPlayback';

function fixture() {
  const tasks: Array<{
    delay: number;
    count: number;
    tick(): void;
    complete(): void;
    cancelled: boolean;
  }> = [];
  const clock: ScreenTextClock = {
    repeat(delay, count, tick, complete) {
      const task = { delay, count, tick, complete, cancelled: false };
      tasks.push(task);
      return () => {
        task.cancelled = true;
      };
    },
    delay(delay, complete) {
      return this.repeat(delay, 1, () => {}, complete);
    },
  };
  const sounds: Array<() => void> = [];
  const texts: string[] = [];
  const events: string[] = [];
  const host: ScreenTextHost = {
    pages: [['ab', 'cd'], ['ef']],
    duration: 500,
    period: 10,
    caretIncrement: 1,
    randomCharAmount: 0,
    fadeOutDelay: 1,
    caretDelay: 10,
    paragraphReadTime: 20,
    pageReadTime: 30,
    paragraphInitTime: 10,
    newRowTime: 10,
    fadeOutTime: 20,
    prepare() {},
    cacheSound(callback) {
      sounds.push(callback);
    },
    sound() {},
    text(value) {
      texts.push(value);
    },
    caret(value) {
      texts.push(value);
    },
    random() {
      return '';
    },
    resetStyle() {},
    fade() {},
    clearStyle() {},
    emit(event) {
      events.push(event);
    },
  };
  const controller = new ScreenTextPlayback(host, clock);
  const step = () => {
    const task = tasks.shift();
    assert.ok(task, 'a scheduled phase exists');
    if (!task.cancelled) {
      for (let i = 0; i < Math.max(1, Math.trunc(task.count)); i++) task.tick();
      task.complete();
    }
    return task;
  };
  const drain = () => {
    let budget = 100;
    while (tasks.length && budget-- > 0) step();
    assert.ok(budget > 0);
  };
  return { host, controller, tasks, sounds, texts, events, step, drain };
}

test('restart ignores old sound completion and does not accumulate duration scaling', () => {
  const f = fixture();
  f.controller.start();
  f.sounds[0]();
  const initial = f.tasks[0];
  f.controller.start();
  f.sounds[0]();
  assert.equal(f.tasks.length, 1);
  assert.equal(initial.cancelled, true);
  f.sounds[1]();
  assert.equal(f.tasks[1].count, initial.count);
  assert.equal(f.host.paragraphInitTime, 10);
  assert.equal(f.host.pageReadTime, 30);
});

test('pages reveal in order with paragraph, fade and completion events', () => {
  const f = fixture();
  f.controller.start(null, false);
  f.sounds[0]();
  f.drain();
  assert.deepEqual(f.events, [
    'paragraphFinished',
    'beforeFadeOut',
    'pageFinished',
    'beforeFadeOut',
    'pageFinished',
    'animationFinished',
  ]);
  assert.ok(f.texts.includes('ab\n\ncd'));
  assert.ok(f.texts.includes('ef'));
});

test('stop followed by fade emits pageFinished without restarting the old pages', () => {
  const f = fixture();
  f.controller.start(null, false);
  f.sounds[0]();
  f.controller.stop();
  f.controller.fadeOut();
  f.drain();
  assert.deepEqual(f.events, ['pageFinished']);
});

test('stopping from beforeFadeOut prevents scheduling the read or fade phase', () => {
  const f = fixture();
  f.host.emit = (event) => {
    f.events.push(event);
    if (event === 'beforeFadeOut') f.controller.stop();
  };
  f.controller.start([['x']], false);
  f.sounds[0]();
  f.drain();
  assert.deepEqual(f.events, ['beforeFadeOut']);
});

test('dispose cancels delayed fades and rejects stale timer callbacks even if delivered', () => {
  const f = fixture();
  f.controller.start([['x']], false);
  f.sounds[0]();
  f.step();
  f.step();
  f.step();
  const delayed = f.tasks[0];
  assert.equal(delayed.delay, 1000);
  f.controller.dispose();
  const previous = [...f.texts];
  delayed.tick();
  delayed.complete();
  f.sounds[0]();
  f.controller.start();
  f.controller.play();
  f.controller.fadeOut();
  assert.deepEqual(f.texts, previous);
  assert.equal(delayed.cancelled, true);
  assert.equal(f.sounds.length, 1);
});
