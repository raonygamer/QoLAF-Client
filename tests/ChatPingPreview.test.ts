import { bindGameClasses } from '../src/game/Bindings';
import type { Texture, GameScene } from '../src/game/Bindings';
import type { API } from '../src/api/Types';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bitmapRendererFixture } from './fixtures/BitmapRenderer';
import { Text } from './fixtures/NativeGame';
import { ChatFriendPingData } from '../src/chat/ChatFriendPingData';
import { ChatPingRoomResolver } from '../src/chat/ChatPingRoomResolver';
import {
  createChatFriendPingPreviewPopup,
  displayPingSystemType,
} from '../src/ported/ChatFriendPingPreviewPopup';
import { installNativeChatPingPreview } from '../src/chat/NativeChatPingPreview';
// @ts-expect-error actual host hooks
import { Hooks } from './fixtures/HostCore.js';

function fixture() {
  const bitmap = bitmapRendererFixture('verdana16_bitmap');
  const filters: any[] = [];
  class Image extends bitmap.Sprite {
    constructor(public texture: any) {
      super();
      this.readjustSize();
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
    if (name === 'core.ship.ShipFactory')
      return {
        createPlayerShipColorMatrixFilter: (paint: any) => {
          const filter = {
            paint,
            disposed: false,
            dispose() {
              this.disposed = true;
            },
          };
          filters.push(filter);
          return filter;
        },
      };
    return bitmap.resolve(name);
  };
  bindGameClasses({
    cls: (name: string) => {
      try {
        return resolve(name);
      } catch {
        return {};
      }
    },
  } as unknown as API);
  return { ...bitmap, resolve, filters };
}
const ping = (room = 'room') =>
  Object.assign(new ChatFriendPingData(), {
    name: 'Pilot',
    playerId: 'pilot',
    level: 90,
    clanName: 'Clan',
    solarSystem: 'Fulzar',
    solarSystemKey: 'fulzar',
    room,
  });

function fieldText(value: unknown): string {
  assert.ok(value instanceof Text);
  return value.get_text();
}

test('ping popup preserves source fields, pointer placement, ship paint ownership and lazy labels', (t) => {
  const f = fixture();
  t.after(f.cleanup);
  const Popup = createChatFriendPingPreviewPopup(f.resolve),
    popup = new Popup();
  const data = ping();
  data.shipHue = 0.4;
  let textureDisposed = false;
  const texture = {
    width: 112,
    height: 56,
    dispose: () => {
      textureDisposed = true;
    },
  };
  popup.showFor(data, texture as unknown as Texture, 675, 495, 680, 500);
  assert.equal(popup.get_width(), 276);
  assert.equal(popup.get_height(), 82);
  assert.equal(popup.get_x(), 387);
  assert.equal(popup.get_y(), 401);
  assert.equal(popup.get_touchable(), false);
  const image: any = popup.getChildAt(5);
  assert.equal(image.get_width(), 56);
  assert.equal(image.get_height(), 28);
  assert.equal(image.get_x(), 8);
  assert.equal(image.get_y(), 27);
  assert.equal(fieldText(popup.getChildAt(6)), 'Pilot');
  assert.equal(popup.getChildAt(6).get_height(), 22);
  assert.equal(fieldText(popup.getChildAt(7)), 'ID: pilot');
  assert.equal(fieldText(popup.getChildAt(8)), 'Level 90  •  Clan');
  assert.equal(fieldText(popup.getChildAt(9)), 'In Fulzar');
  data.systemType = 'clan';
  popup.refreshData(data);
  assert.equal(fieldText(popup.getChildAt(9)), 'In Fulzar  •  Clan Instance');
  assert.equal(f.filters.length, 1, 'room lookup must not rebuild the ship filter');
  popup.showFor(data, null, 10, 10, 100, 30);
  assert.equal(popup.get_x(), 0);
  assert.equal(popup.get_y(), 0);
  assert.equal(image.get_visible(), false);
  assert.equal(f.filters[0].disposed, true);
  popup.showFor(new ChatFriendPingData(), null, 0, 0, 680, 500);
  assert.equal(fieldText(popup.getChildAt(6)), 'Unknown player');
  assert.equal(fieldText(popup.getChildAt(7)), 'Player ID unavailable');
  assert.equal(fieldText(popup.getChildAt(8)), 'Player');
  assert.equal(fieldText(popup.getChildAt(9)), '');
  popup.showFor(data, texture as unknown as Texture, 0, 0, 680, 500);
  popup.dispose();
  assert.equal(f.filters.at(-1).disposed, true);
  assert.equal(textureDisposed, false);
  assert.equal(displayPingSystemType(' DOMINATION '), 'Domination');
  assert.equal(displayPingSystemType('elite'), '');
});

test('room lookup matches exact IDs, coalesces waiters, throttles failures and ignores disposed callbacks', () => {
  const calls: any[][] = [],
    resolved: ChatFriendPingData[] = [];
  let now = 0;
  const resolver = new ChatPingRoomResolver(
    { client: { multiplayer: { listRooms: (...args: any[]) => calls.push(args) } } },
    (data) => resolved.push(data),
    () => now,
  );
  const first = ping(),
    second = ping();
  resolver.resolve(first);
  resolver.resolve(second);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].slice(0, 4), ['game', { solarSystemKey: 'fulzar' }, 100, 0]);
  calls[0][4]([
    { id: 'other', data: { systemType: 'friendly' } },
    { id: 'room', data: { systemType: ' HOSTILE ' } },
  ]);
  assert.equal(first.systemType, 'hostile');
  assert.equal(second.systemType, 'hostile');
  assert.equal(resolved.length, 2);
  resolver.resolve(ping());
  assert.equal(calls.length, 1);
  const unknown = ping('unknown');
  resolver.resolve(unknown);
  calls[1][4]([{ id: 'unknown', data: { systemType: 'elite' } }]);
  assert.equal(unknown.systemType, '');
  resolver.resolve(unknown);
  assert.equal(calls.length, 2);
  now = 30000;
  resolver.resolve(unknown);
  assert.equal(calls.length, 3);
  calls[2][5](new Error('unavailable'));
  for (let index = 0; index < 5; index++) resolver.resolve(ping('pending' + index));
  assert.equal(calls.length, 7, 'at most four pending room queries');
  const changed = ping('pending0');
  resolver.resolve(changed);
  changed.room = 'moved';
  calls[3][4]([{ id: 'pending0', data: { systemType: 'arena' } }]);
  assert.equal(changed.systemType, '', 'changed snapshots cannot acquire the old room type');
  resolver.dispose();
  calls[4][4]([{ id: 'pending1', data: { systemType: 'friendly' } }]);
  assert.equal(resolved.length, 3, 'disposed callbacks do not notify');
});

test('ping hover closes without mouse motion and late room replies never reopen it', (t) => {
  const f = fixture();
  t.after(f.cleanup);
  const node = () => Object.assign(new f.Sprite(), { globalToLocal: (point: any) => point });
  const stage: any = node();
  stage.get_stage = () => stage;
  const log: any = node(),
    view: any = node(),
    scroll: any = node();
  stage.addChild(log);
  log.addChild(view);
  view.addChild(scroll);
  scroll.set_width(660);
  scroll.set_height(490);
  let position = 0;
  scroll.get_verticalScrollPosition = () => position;
  const background = node();
  background.set_width(680);
  background.set_height(500);
  view.scrollView = node();
  view.scrollView.addChild(background);
  view.scroll = scroll;
  log.advanced = view;
  log.updateTexts = () => {};
  log.getQueue = () => [];
  log.advanced.addText = () => {};
  let hit: any = scroll;
  stage.hitTest = () => hit;
  const callbacks: any[] = [];
  const gameClass = {};
  const game = {
    __class__: gameClass,
    stage,
    get_stage: () => stage,
    get_isLeaving: () => false,
    messageLog: log,
    client: { multiplayer: { listRooms: (...args: any[]) => callbacks.push(args[4]) } },
  };
  const cleanup: Function[] = [],
    hooks = new Hooks();
  let frame: any;
  const api: any = {
    cls: (name: string) => (name === 'core.scene.Game' ? gameClass : undefined),
    defer: (fn: Function) => cleanup.push(fn),
    around: (object: any, key: string, fn: Function) =>
      cleanup.push(hooks.add(object, key, 'around', fn)),
    after: (object: any, key: string, fn: Function) =>
      cleanup.push(hooks.add(object, key, 'after', fn)),
    on: (_event: string, fn: Function) => {
      frame = fn;
    },
  };
  let current: any = { row: node(), ping: ping() };
  installNativeChatPingPreview(api, game as unknown as GameScene, f.resolve, {
    pingAtStagePoint: () => current,
  });
  const popup: any = view.getChildAt(view.get_numChildren() - 1);
  const touch = (phase = 'hover') => {
    for (const listener of stage.listeners('touch'))
      listener({
        getTouch: (_stage: any, requested: string) =>
          requested === phase ? { getLocation: () => ({ x: 20, y: 20 }) } : null,
      });
  };
  touch();
  assert.equal(popup.get_visible(), true);
  assert.equal(callbacks.length, 1);
  touch('began');
  callbacks[0]([{ id: 'room', data: { systemType: 'friendly' } }]);
  assert.equal(popup.get_visible(), false);
  touch();
  assert.equal(fieldText(popup.getChildAt(8)), 'In Fulzar  •  Friendly');
  hit = stage;
  view.dispatchEventWith('enterFrame');
  assert.equal(popup.get_visible(), false);
  hit = scroll;
  touch();
  position++;
  view.dispatchEventWith('enterFrame');
  assert.equal(popup.get_visible(), false);
  touch();
  current = null;
  view.dispatchEventWith('enterFrame');
  assert.equal(popup.get_visible(), false);
  current = { row: node(), ping: ping('later') };
  touch();
  cleanup.reverse().forEach((fn) => fn());
  callbacks[1]([{ id: 'later', data: { systemType: 'clan' } }]);
  assert.equal(popup.disposed, true);
  assert.equal(stage.listeners('touch').length, 0);
});
