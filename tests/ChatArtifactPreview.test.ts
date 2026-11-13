import { bindGameClasses } from '../src/game/Bindings';
import type { Artifact, Texture, GameScene } from '../src/game/Bindings';
import type { API } from '../src/api/Types';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bitmapRendererFixture } from './fixtures/BitmapRenderer';
import { Text } from './fixtures/NativeGame';
import { ChatArtifactLinkData } from '../src/chat/ChatArtifactLinkData';
import { createChatArtifactPreviewPopup } from '../src/ported/ChatArtifactPreviewPopup';
import { installNativeChatArtifactPreview } from '../src/chat/NativeChatArtifactPreview';
// @ts-expect-error actual host hooks
import { Hooks } from './fixtures/HostCore.js';

function fixture() {
  const bitmap = bitmapRendererFixture('verdana16_bitmap');
  const parsed: unknown[][] = [];
  class Image extends bitmap.Sprite {
    constructor(public texture: any) {
      super();
      this.readjustSize();
    }
    set_color(value: number) {
      this.color = value;
      return value;
    }
    set_textureSmoothing(value: string) {
      this.textureSmoothing = value;
      return value;
    }
    get_texture() {
      return this.texture;
    }
    set_texture(texture: unknown) {
      this.texture = texture;
    }
    readjustSize() {
      this.set_width(this.texture.width);
      this.set_height(this.texture.height);
    }
  }
  const resolve = (name: string): any => {
    if (name === 'starling.text.TextField') return Text;
    if (name === 'starling.display.Image') return Image;
    if (name === 'generics.Localize') return { t: (text: string) => text };
    if (name === 'core.artifact.ArtifactStat')
      return {
        parseTextFromStatType: (...args: unknown[]) => {
          parsed.push(args);
          return "<font color='#ffaa44'>A long modifier with wrapped descriptive text repeated for layout verification</font>";
        },
      };
    return bitmap.resolve(name);
  };
  bindGameClasses({
    cls: (name: string) => {
      if (name === 'starling.text.TextField') return bitmap.resolve(name);
      try {
        return resolve(name);
      } catch {
        return {};
      }
    },
  } as unknown as API);
  const artifact = {
    name: 'Test artifact',
    bitmap: 'artifact_icon',
    level: 42,
    levelPotential: 80,
    upgraded: 2,
    stats: [{ type: 'healthAdd', value: 1000, get_isUnique: () => true }],
    getColor: () => 0xffaa44,
  };
  const data = new ChatArtifactLinkData(
    'pilot',
    'artifact',
    'Pilot',
    artifact as unknown as Artifact,
    90,
  );
  return { ...bitmap, resolve, parsed, data };
}

test('artifact card uses source geometry, rich wrapped stats, fitness and borrowed atlas icon', (t) => {
  const f = fixture();
  t.after(f.cleanup);
  const Popup = createChatArtifactPreviewPopup(f.resolve);
  const popup = new Popup();
  let disposed = false;
  const texture = {
    width: 128,
    height: 64,
    dispose: () => {
      disposed = true;
    },
  };
  popup.showFor(f.data, texture as unknown as Texture, 675, 495, 680, 500);
  assert.equal(popup.get_touchable(), false);
  assert.equal(popup.get_width(), 390);
  assert.equal(popup.get_x(), 273);
  const icon = popup.getChildAt(1);
  assert.equal(icon.get_width(), 64);
  assert.equal(icon.get_height(), 32);
  assert.equal(icon.get_x(), 8);
  assert.equal(icon.get_y(), 24);
  const nameField = popup.getChildAt(2);
  const ownerField = popup.getChildAt(3);
  const detailsField = popup.getChildAt(4);
  assert.ok(nameField instanceof Text);
  assert.ok(ownerField instanceof Text);
  assert.ok(detailsField instanceof f.Renderer);
  assert.equal(nameField.get_text(), 'Test artifact');
  assert.equal(nameField.get_format().color, f.data.color);
  assert.equal(ownerField.get_text(), 'Pilot  •  Level 90  •  pilot');
  assert.match(detailsField.text, /Level 80, strength 42<br>Fitness: 2<br>2 upgrades/);
  assert.deepEqual(f.parsed, [['healthAdd', 1000, true]]);
  assert.ok(detailsField.numLines > 4, 'wrapped stat lines increase height');
  assert.equal(popup.get_height(), 45 + detailsField.numLines * 17 + 4 + 8);
  assert.equal(popup.get_y(), 495 - popup.get_height() - 12);
  popup.showFor(f.data, texture as unknown as Texture, 0, 0, 680, 500);
  assert.equal(f.parsed.length, 1, 'pointer movement does not rebuild unchanged stats');
  popup.showFor(f.data, null, 0, 0, 100, 50);
  assert.equal(icon.get_visible(), false);
  assert.equal(popup.get_x(), 0);
  assert.equal(popup.get_y(), 0);
  popup.showFor(null, null, 0, 0, 680, 500);
  assert.equal(popup.get_visible(), false);
  popup.dispose();
  assert.equal(disposed, false, 'shared atlas texture must survive popup disposal');
});

test('artifact hover revalidates delayed data, scroll, covering UI and row identity before opening', (t) => {
  const f = fixture();
  t.after(f.cleanup);
  const node = () => Object.assign(new f.Sprite(), { globalToLocal: (point: any) => point });
  const stage: any = node();
  stage.get_stage = () => stage;
  const log: any = node();
  stage.addChild(log);
  const view: any = node();
  log.addChild(view);
  log.advanced = view;
  const scroll: any = node();
  view.addChild(scroll);
  view.scroll = scroll;
  scroll.set_width(660);
  scroll.set_height(490);
  let position = 0;
  scroll.get_verticalScrollPosition = () => position;
  view.scrollView = node();
  const background = node();
  background.set_width(680);
  background.set_height(500);
  view.scrollView.addChild(background);
  const row = node();
  scroll.addChild(row);
  let hit: any = scroll;
  stage.hitTest = () => hit;
  const game = {
    stage,
    messageLog: log,
    isLeaving: false,
    get_stage: () => stage,
    get_isLeaving: () => game.isLeaving,
  };
  log.updateTexts = () => {};
  log.getQueue = () => [];
  log.advanced.addText = () => {};
  const hooks = new Hooks();
  const cleanup: (() => void)[] = [];
  let frame: (event: any) => void = () => {};
  const api: any = {
    cls: () => ({ getService: () => ({ getTextureGUIByKey: () => null }) }),
    around: (object: any, key: string, fn: Function) =>
      cleanup.push(hooks.add(object, key, 'around', fn)),
    after: (object: any, key: string, fn: Function) =>
      cleanup.push(hooks.add(object, key, 'after', fn)),
    on: (_name: string, fn: typeof frame) => {
      frame = fn;
    },
    defer: (fn: () => void) => cleanup.push(fn),
  };
  let ready: any = null;
  let resolved: (data: any) => void = () => {};
  let requests = 0;
  let unsubscribed = false;
  const resolver: any = {
    cached: () => ready,
    resolve: () => {
      requests++;
    },
    onResolved: (fn: typeof resolved) => {
      resolved = fn;
      return () => {
        unsubscribed = true;
      };
    },
  };
  let candidate: any = {
    row,
    token: { playerId: 'pilot', artifactId: 'artifact', sourceBegin: 0 },
  };
  installNativeChatArtifactPreview(
    api,
    game as unknown as GameScene,
    f.resolve,
    { artifactAtStagePoint: () => candidate },
    resolver,
  );
  const popup: any = view.getChildAt(view.get_numChildren() - 1);
  const touch = (phase = 'hover', x = 20) => {
    for (const listener of stage.listeners('touch'))
      listener({
        getTouch: (_stage: any, requested: string) =>
          phase === requested ? { getLocation: () => ({ x, y: 20 }) } : null,
      });
  };
  touch();
  assert.equal(requests, 1);
  assert.equal(popup.get_visible(), false);
  touch('began');
  resolved(f.data);
  assert.equal(popup.get_visible(), false);
  touch();
  ready = f.data;
  resolved(f.data);
  assert.equal(popup.get_visible(), true);
  position++;
  view.dispatchEventWith('enterFrame');
  assert.equal(popup.get_visible(), false);
  touch();
  hit = stage;
  view.dispatchEventWith('enterFrame');
  assert.equal(popup.get_visible(), false);
  hit = scroll;
  touch();
  assert.equal(popup.get_visible(), true);
  candidate = { ...candidate, row: node() };
  view.dispatchEventWith('enterFrame');
  assert.equal(popup.get_visible(), false, 'replacement rows cannot inherit hover');
  touch('hover', 700);
  assert.equal(popup.get_visible(), false);
  touch();
  log.updateTexts();
  assert.equal(popup.get_visible(), false);
  touch();
  view.set_visible(false);
  view.dispatchEventWith('enterFrame');
  assert.equal(popup.get_visible(), false);
  cleanup.reverse().forEach((fn) => fn());
  resolved(f.data);
  assert.equal(popup.get_visible(), false);
  assert.equal(popup.disposed, true);
  assert.equal(unsubscribed, true);
  assert.equal(stage.listeners('touch').length, 0);
});
