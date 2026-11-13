import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { API } from '../src/api/Types';
import { bindGameClasses } from '../src/game/Bindings';
import { installLoadingCover } from '../src/login/LoadingCover';
// @ts-expect-error actual host dispatcher
import { Hooks } from './fixtures/HostCore.js';

test('loading cover stays above newly entered HUD and fades in without delaying scene completion', (t) => {
  let now = 0;
  t.mock.method(performance, 'now', () => now);
  class Node {
    visible = false;
    alpha = 0;
    get_visible() {
      return this.visible;
    }
    set_visible(value: boolean) {
      this.visible = value;
    }
    get_alpha() {
      return this.alpha;
    }
    set_alpha(value: number) {
      this.alpha = value;
    }
    play() {}
    stop() {}
  }
  class Stage {
    children: Node[] = [];
    listeners = new Set<() => void>();
    contains(node: Node) {
      return this.children.includes(node);
    }
    addChild(node: Node) {
      if (!this.contains(node)) this.children.push(node);
    }
    get_numChildren() {
      return this.children.length;
    }
    getChildAt(index: number) {
      return this.children[index];
    }
    setChildIndex(node: Node, index: number) {
      this.children.splice(this.children.indexOf(node), 1);
      this.children.splice(index, 0, node);
    }
    addEventListener(_name: string, fn: () => void) {
      this.listeners.add(fn);
    }
    removeEventListener(_name: string, fn: () => void) {
      this.listeners.delete(fn);
    }
    frame() {
      for (const fn of [...this.listeners]) fn();
    }
  }
  const stage = new Stage();
  const timer = () => ({ stop() {}, reset() {} });
  class Cover {
    stage = stage;
    screen = new Node();
    screenText = new Node();
    loadingText = new Node();
    loadingImage = new Node();
    loadingImage2 = new Node();
    fadeInTimer = timer();
    fadeOutTimer = timer();
    show() {
      stage.addChild(this.screen);
      this.screen.visible = true;
      this.screen.alpha = 1;
    }
    fadeIn() {
      this.show();
    }
    fadeOut() {}
    showHighscore() {}
    repositionScreen() {}
    onFadeOutTimerUpdate() {}
    onFadeOutTimerComplete() {
      this.screen.visible = false;
    }
    update() {}
    dispose() {}
    dispatchEvent() {}
  }
  class Renderer {
    static get_current() {
      return renderer;
    }
    get_stage() {
      return stage;
    }
    get_nativeOverlay() {
      return null;
    }
    render() {
      return stage.children.at(-1);
    }
  }
  const renderer = new Renderer();
  const classes: Record<string, unknown> = {
    'core.hud.components.FadeScreen': Cover,
    'starling.core.Starling': Renderer,
    Login: { START_SETUP_IS_ACTIVE: false },
  };
  const hooks = new Hooks((error: unknown) => {
    throw error;
  });
  const cleanups: Array<() => void> = [];
  const register = (kind: string) => (owner: object, key: string, fn: unknown) => {
    const off = hooks.add(owner, key, kind, fn);
    cleanups.push(off);
    return off;
  };
  const api = {
    cls: (name: string) => classes[name] ?? {},
    around: register('around'),
    before: register('before'),
    after: register('after'),
    defer: (fn: () => void) => cleanups.push(fn),
  } as unknown as API;
  bindGameClasses(api);
  installLoadingCover(api);
  t.after(() => cleanups.reverse().forEach((off) => off()));
  const cover = new Cover();
  cover.show();
  assert.equal(cover.screen.alpha, 0);
  now = 125;
  stage.frame();
  assert.equal(cover.screen.alpha, 0.75);
  const hud = new Node();
  stage.addChild(hud);
  assert.equal(renderer.render(), cover.screen, 'late HUD insertion stays behind cover');
  now = 250;
  stage.frame();
  assert.equal(cover.screen.alpha, 1);
  cover.fadeOut();
  now = 500;
  stage.frame();
  assert.equal(cover.screen.visible, false);
  stage.addChild(new Node());
  assert.notEqual(renderer.render(), cover.screen, 'finished cover releases layer ownership');
});
