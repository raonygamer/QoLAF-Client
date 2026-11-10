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
  const artifact = {
    name: 'Test artifact',
    bitmap: 'artifact_icon',
    level: 42,
    levelPotential: 80,
    upgraded: 2,
    stats: [{ type: 'healthAdd', value: 1000, get_isUnique: () => true }],
    getColor: () => 0xffaa44,
  };
  const data = new ChatArtifactLinkData('pilot', 'artifact', 'Pilot', artifact, 90);
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
  popup.showFor(f.data, texture, 675, 495, 680, 500);
  assert.equal(popup.get_touchable(), false);
  assert.equal(popup.get_width(), 390);
  assert.equal(popup.get_x(), 273);
  const icon = popup.getChildAt(1);
  assert.equal(icon.get_width(), 64);
  assert.equal(icon.get_height(), 32);
  assert.equal(icon.get_x(), 8);
  assert.equal(icon.get_y(), 24);
  assert.equal(popup.nameField.text, 'Test artifact');
  assert.equal(popup.nameField.format.color, f.data.color);
  assert.equal(popup.ownerField.text, 'Pilot  •  Level 90  •  pilot');
  assert.match(popup.detailsField.text, /Level 80, strength 42<br>Fitness: 2<br>2 upgrades/);
  assert.deepEqual(f.parsed, [['healthAdd', 1000, true]]);
  assert.ok(popup.detailsField.numLines > 4, 'wrapped stat lines increase height');
  assert.equal(popup.get_height(), 45 + popup.detailsField.numLines * 17 + 4 + 8);
  assert.equal(popup.get_y(), 495 - popup.get_height() - 12);
  popup.showFor(f.data, texture, 0, 0, 680, 500);
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
  const game = { stage, messageLog: log, isLeaving: false };
  log.updateTexts = () => {};
  const hooks = new Hooks();
  const cleanup: (() => void)[] = [];
  let frame: (event: any) => void = () => {};
  const api: any = {
    cls: () => ({ getService: () => ({ getTextureGUIByKey: () => null }) }),
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
    game,
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
  frame({ game });
  assert.equal(popup.get_visible(), false);
  touch();
  hit = stage;
  frame({ game });
  assert.equal(popup.get_visible(), false);
  hit = scroll;
  touch();
  assert.equal(popup.get_visible(), true);
  candidate = { ...candidate, row: node() };
  frame({ game });
  assert.equal(popup.get_visible(), false, 'replacement rows cannot inherit hover');
  touch('hover', 700);
  assert.equal(popup.get_visible(), false);
  touch();
  log.updateTexts();
  assert.equal(popup.get_visible(), false);
  touch();
  view.set_visible(false);
  frame({ game });
  assert.equal(popup.get_visible(), false);
  cleanup.reverse().forEach((fn) => fn());
  resolved(f.data);
  assert.equal(popup.get_visible(), false);
  assert.equal(popup.disposed, true);
  assert.equal(unsubscribed, true);
  assert.equal(stage.listeners('touch').length, 0);
});
