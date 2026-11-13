import type { Texture } from '../src/game/Bindings';
import { installNativeChatImageViewer } from '../src/chat/NativeChatImageViewer';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createChatImageViewerWindow } from '../src/ported/ChatImageViewerWindow';
import { createChatComposerFormatButton } from '../src/ported/ChatComposerFormatButton';
import { ChatImageCache } from '../src/chat/ChatImageCache';
import { ChatImageAsset } from '../src/chat/ChatImageAsset';
import { ChatDiscordImageLink } from '../src/chat/ChatDiscordImageLink';
import { bitmapRendererFixture } from './fixtures/BitmapRenderer';
import { Text } from './fixtures/NativeGame';

function fixture() {
  const bitmap = bitmapRendererFixture('verdana48_bitmap');
  const pending: { ok: (asset: ChatImageAsset) => void; fail: (reason: string) => void }[] = [];
  const cache = new ChatImageCache(() => ({
    loadCandidates(_urls, ok, fail) {
      pending.push({ ok, fail });
    },
  }));
  let time = 0;
  const stage = new bitmap.Sprite() as any;
  stage.stageWidth = 1280;
  stage.stageHeight = 800;
  const definitions: Record<string, any> = {
    'starling.display.Stage': bitmap.Sprite,
    'starling.text.TextField': Text,
    'starling.events.Event': {
      TRIGGERED: 'triggered',
      ADDED_TO_STAGE: 'addedToStage',
      ENTER_FRAME: 'enterFrame',
      RESIZE: 'resize',
    },
    'starling.events.Touch': class {},
    'starling.events.TouchEvent': { TOUCH: 'touch' },
    'starling.events.TouchPhase': { BEGAN: 'began', MOVED: 'moved', ENDED: 'ended' },
  };
  const resolve = (name: string): any => definitions[name] ?? bitmap.resolve(name);
  definitions['core.hud.components.chat.ChatComposerFormatButton'] =
    createChatComposerFormatButton(resolve);
  const Viewer = createChatImageViewerWindow(resolve, cache, () => time);
  const owner = {
    stage,
    isLeaving: false,
    addChildToOverlay(view: any) {
      Object.defineProperty(view, 'stage', { value: stage });
      stage.addChild(view);
      view.dispatchEventWith('addedToStage');
    },
  };
  const open = (name: string) => {
    Viewer.open(owner, ChatDiscordImageLink.parseAt(`https://example.test/${name}.gif`, 0)!);
    return stage.children.at(-1) as any;
  };
  return {
    open,
    resolve,
    cache,
    stage,
    pending,
    owner,
    tick(view: any, value: number) {
      time = value;
      view.dispatchEventWith('enterFrame');
    },
    cleanup() {
      stage.removeChildren(0, -1, true);
      cache.dispose();
      bitmap.cleanup();
    },
  };
}
const asset = () =>
  new ChatImageAsset(
    [{ dispose() {} }, { dispose() {} }] as unknown as Texture[],
    [100, 20],
    1000,
    500,
  );

test('source viewer deduplicates, constrains, animates and releases native resources', (t) => {
  const f = fixture();
  t.after(f.cleanup);
  const view = f.open('first');
  assert.equal(view.panelWidth, 700);
  assert.equal(view.panelHeight, 520);
  assert.equal(view.x, 92);
  assert.equal(view.y, 76);
  const second = f.open('second');
  assert.equal(second.x, 120);
  assert.equal(f.open('first'), view);
  assert.equal(f.pending.length, 2);
  const image = asset();
  f.pending[0].ok(image);
  assert.equal(image.refCount, 1);
  assert.equal(view.image.scaleX, 0.684);
  assert.equal(view.status.visible, false);
  assert.equal(view.title.text, 'first.gif  •  1000x500');
  f.tick(view, 99);
  assert.equal(view.image.texture, image.frames[0]);
  f.tick(view, 100);
  assert.equal(view.image.texture, image.frames[1]);
  f.stage.stageWidth = 280;
  f.stage.stageHeight = 180;
  f.stage.dispatchEventWith('resize');
  assert.equal(view.panelWidth, 280);
  assert.equal(view.panelHeight, 180);
  assert.equal(view.x, 0);
  assert.equal(view.y, 0);
  view.closeButton.dispatchEventWith('triggered');
  assert.equal(image.refCount, 0);
  assert.equal(view.parent, null);
  assert.equal(view.listeners('enterFrame').length, 0);
  second.removeFromParent(true);
  const late = asset();
  f.pending[1].ok(late);
  assert.equal(late.refCount, 0);
  assert.equal(f.stage.listeners('resize').length, 0);
});

test('source viewer keeps pointer identity while dragging and resizing', (t) => {
  const f = fixture();
  t.after(f.cleanup);
  const view = f.open('drag');
  const touch = (phase: string, target: any, x: number, y: number, id = 7) =>
    view.onTouch({
      getTouch(object: any, requested?: string) {
        if ((object !== view && object !== target) || (requested && requested !== phase))
          return null;
        return {
          phase,
          id,
          getLocation(_parent: any, result = { x: 0, y: 0 }) {
            result.x = x;
            result.y = y;
            return result;
          },
        };
      },
    });
  touch('began', view.titleBar, 100, 90);
  touch('moved', view.titleBar, 160, 130, 8);
  assert.equal(view.x, 92);
  touch('moved', view.titleBar, 160, 130);
  assert.equal(view.x, 152);
  assert.equal(view.y, 116);
  touch('ended', view.titleBar, 160, 130);
  assert.equal(view.dragMode, null);
  touch('began', view.grip, 800, 600);
  touch('moved', view.grip, 200, 100);
  assert.equal(view.panelWidth, 320);
  assert.equal(view.panelHeight, 220);
  f.pending[0].fail('offline');
  assert.equal(view.status.text, '[Image unavailable]');
});

test('native image activation respects clipping, covered chat and session disposal', (t) => {
  const f = fixture();
  t.after(f.cleanup);
  const scroll: any = {
    touchable: true,
    width: 680,
    height: 500,
    globalToLocal: (point: any) => point,
  };
  const advanced = { scroll, visible: true, alpha: 1 };
  const game = Object.assign(f.owner, { messageLog: { advanced, contains: () => true } });
  let hit: any = scroll;
  f.stage.hitTest = () => hit;
  let lookups = 0;
  const cleanups: (() => void)[] = [];
  installNativeChatImageViewer(
    { defer: (fn: () => void) => cleanups.push(fn) } as any,
    game,
    (name) => {
      // This ported class does not exist in the upstream Haxe registry.
      assert.notEqual(name, 'core.hud.components.chat.ChatComposerFormatButton');
      return f.resolve(name);
    },
    f.cache,
    {
      imageLinkAtStagePoint() {
        lookups++;
        return ChatDiscordImageLink.parseAt('https://example.test/preview.gif', 0);
      },
    },
  );
  const touch = (x: number, y: number, ended = true) =>
    f.stage.listeners('touch')[0]({
      getTouch: (_stage: any, phase: string) =>
        ended && phase === 'ended' ? { getLocation: () => ({ x, y }) } : null,
    });
  touch(10, 10, false);
  assert.equal(lookups, 0);
  touch(700, 10);
  assert.equal(lookups, 0);
  hit = {};
  touch(10, 10);
  assert.equal(lookups, 0);
  hit = scroll;
  advanced.visible = false;
  touch(10, 10);
  assert.equal(lookups, 0);
  advanced.visible = true;
  scroll.touchable = false;
  touch(10, 10);
  assert.equal(lookups, 0);
  scroll.touchable = true;
  touch(10, 10);
  assert.equal(lookups, 1);
  assert.equal(f.stage.children.length, 1);
  touch(10, 10);
  assert.equal(f.stage.children.length, 1);
  const view = f.stage.children[0];
  cleanups.forEach((fn) => fn());
  assert.equal(view.disposed, true);
  assert.equal(f.stage.children.length, 0);
  assert.equal(f.stage.listeners('touch').length, 0);
  assert.equal(f.stage.listeners('resize').length, 0);
});
